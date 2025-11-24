/**
 * Detecção de Suporte e Resistência
 * Combina detecção automática (máximos/mínimos locais) com níveis psicológicos (preços redondos)
 */

import { PriceData } from './technical-indicators'

export interface SupportResistanceLevel {
  price: number;
  strength: number; // 1-5, onde 5 é mais forte
  type: 'support' | 'resistance' | 'psychological';
  touches: number; // Quantas vezes o preço tocou esse nível
}

export interface SupportResistanceResult {
  supportLevels: SupportResistanceLevel[];
  resistanceLevels: SupportResistanceLevel[];
  psychologicalLevels: SupportResistanceLevel[];
}

/**
 * Detecta níveis de suporte e resistência automaticamente
 * Baseado em máximos e mínimos locais
 */
export function detectSupportResistance(
  prices: PriceData[],
  lookbackPeriod: number = 20,
  minTouches: number = 2
): { supportLevels: SupportResistanceLevel[]; resistanceLevels: SupportResistanceLevel[] } {
  if (prices.length < lookbackPeriod * 2) {
    return { supportLevels: [], resistanceLevels: [] };
  }

  const supportLevels: Map<number, { price: number; touches: number }> = new Map();
  const resistanceLevels: Map<number, { price: number; touches: number }> = new Map();

  // Encontrar máximos e mínimos locais
  for (let i = lookbackPeriod; i < prices.length - lookbackPeriod; i++) {
    const currentHigh = prices[i].high;
    const currentLow = prices[i].low;

    // Verificar se é um máximo local
    let isLocalMax = true;
    let isLocalMin = true;

    for (let j = i - lookbackPeriod; j <= i + lookbackPeriod; j++) {
      if (j !== i) {
        if (prices[j].high > currentHigh) {
          isLocalMax = false;
        }
        if (prices[j].low < currentLow) {
          isLocalMin = false;
        }
      }
    }

    // Agrupar níveis próximos (tolerância de 1%)
    const tolerance = 0.01;

    if (isLocalMax) {
      const existingLevel = Array.from(resistanceLevels.keys()).find(
        level => Math.abs(level - currentHigh) / level < tolerance
      );

      if (existingLevel) {
        const existing = resistanceLevels.get(existingLevel)!;
        existing.touches++;
      } else {
        resistanceLevels.set(currentHigh, { price: currentHigh, touches: 1 });
      }
    }

    if (isLocalMin) {
      const existingLevel = Array.from(supportLevels.keys()).find(
        level => Math.abs(level - currentLow) / level < tolerance
      );

      if (existingLevel) {
        const existing = supportLevels.get(existingLevel)!;
        existing.touches++;
      } else {
        supportLevels.set(currentLow, { price: currentLow, touches: 1 });
      }
    }
  }

  // Filtrar níveis com mínimo de toques e calcular força
  const support: SupportResistanceLevel[] = Array.from(supportLevels.values())
    .filter(level => level.touches >= minTouches)
    .map(level => ({
      price: Number(level.price.toFixed(4)),
      strength: Math.min(5, level.touches),
      type: 'support' as const,
      touches: level.touches
    }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5); // Top 5 níveis de suporte

  const resistance: SupportResistanceLevel[] = Array.from(resistanceLevels.values())
    .filter(level => level.touches >= minTouches)
    .map(level => ({
      price: Number(level.price.toFixed(4)),
      strength: Math.min(5, level.touches),
      type: 'resistance' as const,
      touches: level.touches
    }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5); // Top 5 níveis de resistência

  return { supportLevels: support, resistanceLevels: resistance };
}

/**
 * Detecta níveis psicológicos (preços redondos)
 * Preços como 10.00, 25.00, 50.00, 100.00 são psicologicamente importantes
 */
export function detectPsychologicalLevels(
  currentPrice: number,
  range: number = 0.3 // 30% acima e abaixo do preço atual
): SupportResistanceLevel[] {
  const levels: SupportResistanceLevel[] = [];
  
  // Determinar ordem de grandeza
  const magnitude = Math.pow(10, Math.floor(Math.log10(currentPrice)));
  
  // Níveis psicológicos baseados na ordem de grandeza
  const psychologicalMultipliers = [0.5, 1, 1.5, 2, 2.5, 5, 10, 15, 20, 25, 50, 75, 100];
  
  for (const multiplier of psychologicalMultipliers) {
    const level = magnitude * multiplier;
    const distance = Math.abs(level - currentPrice) / currentPrice;
    
    // Apenas níveis dentro do range especificado
    if (distance <= range && level > 0) {
      // Calcular força baseada na proximidade e "redondez" do número
      let strength = 3; // Base
      if (multiplier % 1 === 0) strength++; // Números inteiros são mais fortes
      if (multiplier % 5 === 0) strength++; // Múltiplos de 5 são mais fortes
      if (multiplier % 10 === 0) strength++; // Múltiplos de 10 são mais fortes
      
      // Ajustar força pela proximidade
      if (distance < 0.05) strength++; // Muito próximo
      if (distance < 0.02) strength++; // Extremamente próximo
      
      levels.push({
        price: Number(level.toFixed(2)),
        strength: Math.min(5, strength),
        type: 'psychological',
        touches: 0 // Níveis psicológicos não têm toques históricos
      });
    }
  }
  
  // Ordenar por força e retornar top 5
  return levels
    .sort((a, b) => {
      // Primeiro por força, depois por proximidade
      if (b.strength !== a.strength) {
        return b.strength - a.strength;
      }
      return Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice);
    })
    .slice(0, 5);
}

/**
 * Combina níveis automáticos e psicológicos
 * IMPORTANTE: Usa apenas dados recentes (últimos 24 meses) para evitar níveis muito antigos
 */
export function combineLevels(
  prices: PriceData[],
  lookbackPeriod: number = 20,
  currentPriceOverride?: number
): SupportResistanceResult {
  const currentPrice = currentPriceOverride ?? (prices.length > 0 ? prices[prices.length - 1].close : 0);
  
  // IMPORTANTE: Usar apenas os últimos 24 meses para detecção de suporte/resistência
  // Isso evita níveis muito antigos que não são mais relevantes
  const recentMonths = 24;
  const recentPrices = prices.length > recentMonths 
    ? prices.slice(-recentMonths) 
    : prices;
  
  // Detectar níveis automáticos apenas nos dados recentes
  const { supportLevels, resistanceLevels } = detectSupportResistance(recentPrices, Math.min(lookbackPeriod, 12));
  
  // Filtrar níveis muito distantes do preço atual (mais de 50% de diferença)
  const maxDistance = 0.5; // 50% acima ou abaixo
  const filteredSupport = supportLevels.filter(level => {
    const distance = Math.abs(level.price - currentPrice) / currentPrice;
    return distance <= maxDistance && level.price < currentPrice * 1.1; // Suporte deve estar abaixo ou próximo
  });
  
  const filteredResistance = resistanceLevels.filter(level => {
    const distance = Math.abs(level.price - currentPrice) / currentPrice;
    return distance <= maxDistance && level.price > currentPrice * 0.9; // Resistência deve estar acima ou próximo
  });
  
  // Detectar níveis psicológicos
  const psychologicalLevels = detectPsychologicalLevels(currentPrice, 0.3); // 30% de range
  
  // Classificar níveis psicológicos como suporte ou resistência
  const psychologicalSupport: SupportResistanceLevel[] = [];
  const psychologicalResistance: SupportResistanceLevel[] = [];
  
  for (const level of psychologicalLevels) {
    if (level.price < currentPrice) {
      psychologicalSupport.push(level);
    } else {
      psychologicalResistance.push(level);
    }
  }
  
  // Combinar e ordenar
  const allSupport = [...filteredSupport, ...psychologicalSupport]
    .sort((a, b) => {
      // Ordenar por proximidade ao preço atual primeiro, depois por força
      const distanceA = Math.abs(a.price - currentPrice);
      const distanceB = Math.abs(b.price - currentPrice);
      if (Math.abs(distanceA - distanceB) / currentPrice > 0.1) {
        return distanceA - distanceB; // Mais próximo primeiro
      }
      return b.strength - a.strength; // Depois por força
    })
    .slice(0, 5);
  
  const allResistance = [...filteredResistance, ...psychologicalResistance]
    .sort((a, b) => {
      // Ordenar por proximidade ao preço atual primeiro, depois por força
      const distanceA = Math.abs(a.price - currentPrice);
      const distanceB = Math.abs(b.price - currentPrice);
      if (Math.abs(distanceA - distanceB) / currentPrice > 0.1) {
        return distanceA - distanceB; // Mais próximo primeiro
      }
      return b.strength - a.strength; // Depois por força
    })
    .slice(0, 5);
  
  return {
    supportLevels: allSupport,
    resistanceLevels: allResistance,
    psychologicalLevels
  };
}

