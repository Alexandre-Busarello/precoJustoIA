/**
 * Cache helper para dados de realtime return de índices
 * Quando mercado fechado e cached=true, cacheia até 10h do dia seguinte
 */

interface CachedRealTimeData {
  data: any;
  timestamp: number;
  expiresAt: number; // Timestamp até quando o cache é válido (10h do dia seguinte)
}

const CACHE_PREFIX = 'index-realtime-return-cache-';

/**
 * Calcula o timestamp para 10h do dia seguinte (horário de Brasília)
 * Usa uma abordagem simples: calcular quantas horas faltam até 10h do dia seguinte
 */
function getNextDay10AMTimestamp(): number {
  const now = Date.now();
  
  // Obter data/hora atual em horário de Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  
  const parts = formatter.formatToParts(new Date(now));
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
  
  // Abordagem mais simples: calcular horas até 10h do dia seguinte
  let hoursUntil10AM = 0;
  
  if (hour >= 10) {
    // Já passou das 10h, calcular até 10h de amanhã
    // Horas restantes hoje (até meia-noite) + 10 horas de amanhã
    const hoursRemainingToday = 24 - hour;
    hoursUntil10AM = hoursRemainingToday + 10;
  } else {
    // Ainda não passou das 10h, calcular até 10h de hoje
    hoursUntil10AM = 10 - hour;
  }
  
  // Calcular minutos e segundos restantes
  const minutesRemaining = 60 - minute;
  const secondsRemaining = 60 - second;
  
  // Calcular total de milissegundos até 10h do dia seguinte
  // Subtrair 1 minuto e 1 segundo porque já contamos as horas completas
  const totalMs = (
    (hoursUntil10AM - 1) * 60 * 60 * 1000 + // Horas completas (menos 1)
    (minutesRemaining - 1) * 60 * 1000 +    // Minutos restantes (menos 1)
    secondsRemaining * 1000                  // Segundos restantes
  );
  
  const targetTimestamp = now + totalMs;
  
  // Verificar se é válido
  if (targetTimestamp <= now) {
    // Fallback: adicionar 24 horas ao timestamp atual
    return now + (24 * 60 * 60 * 1000);
  }
  
  return targetTimestamp;
}

/**
 * Obtém dados do cache se válido
 */
export function getCachedRealTimeReturn(ticker: string): any | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const cacheKey = `${CACHE_PREFIX}${ticker.toUpperCase()}`;
  const cachedStr = localStorage.getItem(cacheKey);
  
  if (!cachedStr) {
    return null;
  }
  
  try {
    const cached: CachedRealTimeData = JSON.parse(cachedStr);
    const now = Date.now();
    
    // Verificar se o cache ainda é válido
    if (now < cached.expiresAt) {
      return cached.data;
    } else {
      // Cache expirado, remover
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    localStorage.removeItem(cacheKey);
    return null;
  }
}

/**
 * Salva dados no cache quando mercado fechado e preço de fechamento disponível
 */
export function setCachedRealTimeReturn(ticker: string, data: any): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Só cachear se mercado fechado E preço de fechamento disponível
  if (data.marketClosed === true && data.hasClosingPrice === true) {
    const cacheKey = `${CACHE_PREFIX}${ticker.toUpperCase()}`;
    const expiresAt = getNextDay10AMTimestamp();
    
    const cached: CachedRealTimeData = {
      data,
      timestamp: Date.now(),
      expiresAt,
    };
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (error) {
      console.error(`Erro ao salvar cache para ${ticker}:`, error);
    }
  }
}

/**
 * Busca dados de realtime return com cache automático
 */
export async function fetchRealTimeReturnWithCache(ticker: string): Promise<any> {
  // Verificar cache primeiro (sempre verificar antes de fazer qualquer request)
  const cached = getCachedRealTimeReturn(ticker);
  if (cached) {
    // Retornar Promise resolvida para manter compatibilidade assíncrona
    return Promise.resolve(cached);
  }
  
  // Se não há cache válido, fazer request
  const response = await fetch(`/api/indices/${ticker}/realtime-return`, {
    cache: 'no-store', // Evitar cache do navegador interferir
  });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar rentabilidade em tempo real');
  }
  
  const data = await response.json();
  
  // Salvar no cache se aplicável (sempre tentar salvar, a função verifica as condições)
  setCachedRealTimeReturn(ticker, data);
  
  return data;
}

