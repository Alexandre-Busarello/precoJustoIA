/**
 * PRICE VARIATION SERVICE
 * 
 * Serviço para detectar variações de preço e determinar se devem gerar relatórios
 */

import { getTickerPrice, getYahooHistoricalPrice } from './quote-service';
import { prisma } from './prisma';

export interface PriceVariation {
  days: number;
  variation: number; // Percentual (ex: -5.5 para queda de 5.5%)
  currentPrice: number;
  previousPrice: number;
  date: Date;
}

export interface PriceVariationCheck {
  companyId: number;
  ticker: string;
  variations: PriceVariation[];
  triggered: boolean;
  triggerReason?: {
    days: number;
    variation: number;
    threshold: number;
  };
}

/**
 * Verifica variações de preço para uma empresa
 * Retorna variações para 1 dia, 5 dias, 30 dias e 365 dias
 */
export async function checkPriceVariations(
  companyId: number,
  ticker: string
): Promise<PriceVariationCheck> {
  const variations: PriceVariation[] = [];
  const thresholds = {
    '1': parseFloat(process.env.PRICE_DROP_1D || '5'),
    '5': parseFloat(process.env.PRICE_DROP_5D || '8'),
    '30': parseFloat(process.env.PRICE_DROP_30D || '20'),
    '365': parseFloat(process.env.PRICE_DROP_1Y || '50'),
  };

  // Preço atual
  const currentPriceData = await getTickerPrice(ticker);
  if (!currentPriceData) {
    throw new Error(`Não foi possível obter preço atual para ${ticker}`);
  }
  const currentPrice = currentPriceData.price;
  const currentDate = currentPriceData.timestamp;

  // Verificar variações para cada janela de tempo
  const timeWindows = [1, 5, 30, 365];
  let triggered = false;
  let triggerReason: PriceVariationCheck['triggerReason'] | undefined;

  for (const days of timeWindows) {
    try {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - days);

      const previousPrice = await getYahooHistoricalPrice(ticker, previousDate);

      if (previousPrice && previousPrice > 0) {
        const variation = ((currentPrice - previousPrice) / previousPrice) * 100;
        const threshold = thresholds[days.toString() as keyof typeof thresholds];

        variations.push({
          days,
          variation,
          currentPrice,
          previousPrice,
          date: previousDate,
        });

        // Verificar se atingiu threshold (queda negativa)
        // variation <= -threshold significa: variação negativa maior ou igual ao threshold
        // Exemplo: variation = -2.5%, threshold = 1% -> -2.5 <= -1 -> true (dispara)
        // Nota: variações positivas (subidas) nunca disparam, apenas quedas
        if (variation <= -threshold && !triggered) {
          triggered = true;
          triggerReason = {
            days,
            variation,
            threshold,
          };
        }
      }
    } catch (error) {
      console.error(`Erro ao calcular variação de ${days} dias para ${ticker}:`, error);
      // Continuar com outras janelas mesmo se uma falhar
    }
  }

  return {
    companyId,
    ticker,
    variations,
    triggered,
    triggerReason,
  };
}

/**
 * Verifica se uma variação deve gerar relatório
 */
export function shouldTriggerReport(
  variation: number,
  threshold: number
): boolean {
  // Variação negativa (queda) maior ou igual ao threshold
  return variation <= -threshold;
}

/**
 * Calcula variação de preço para um ticker em um número específico de dias
 */
export async function calculatePriceChange(
  ticker: string,
  days: number
): Promise<number | null> {
  try {
    const currentPriceData = await getTickerPrice(ticker);
    if (!currentPriceData) {
      return null;
    }

    const currentPrice = currentPriceData.price;
    const currentDate = currentPriceData.timestamp;

    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - days);

    const previousPrice = await getYahooHistoricalPrice(ticker, previousDate);

    if (!previousPrice || previousPrice <= 0) {
      return null;
    }

    const variation = ((currentPrice - previousPrice) / previousPrice) * 100;
    return variation;
  } catch (error) {
    console.error(`Erro ao calcular variação de preço para ${ticker} (${days} dias):`, error);
    return null;
  }
}

