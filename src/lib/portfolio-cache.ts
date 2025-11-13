/**
 * Sistema de Cache Centralizado para Feature de Carteira
 * 
 * Gerencia cache de todos os dados de carteira no localStorage:
 * - Analytics
 * - Metrics
 * - Holdings
 * - Transactions
 * - Suggestions
 */

// ==================== CONFIGURAÇÃO ====================

const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  portfolioId: string;
}

// ==================== CHAVES DE CACHE ====================

const CACHE_KEYS = {
  analytics: (portfolioId: string) => `portfolio_analytics_${portfolioId}`,
  metrics: (portfolioId: string) => `portfolio_metrics_${portfolioId}`,
  holdings: (portfolioId: string) => `portfolio_holdings_${portfolioId}`,
  transactions: (portfolioId: string) => `portfolio_transactions_${portfolioId}`,
  suggestions: (portfolioId: string) => `portfolio_suggestions_${portfolioId}`,
  closedPositions: (portfolioId: string) => `portfolio_closed_positions_${portfolioId}`,
  
  // Prefixo geral para limpeza em massa
  prefix: 'portfolio_',
} as const;

// ==================== FUNÇÕES DE CACHE ====================

/**
 * Salva dados no cache
 */
export function setCacheData<T>(
  key: string,
  data: T,
  portfolioId: string
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      portfolioId,
    };
    
    localStorage.setItem(key, JSON.stringify(cacheEntry));
    console.log(`💾 [CACHE] Dados salvos: ${key}`);
  } catch (error) {
    console.error(`❌ [CACHE] Erro ao salvar: ${key}`, error);
  }
}

/**
 * Recupera dados do cache (se válido)
 */
export function getCacheData<T>(
  key: string,
  maxAge: number = CACHE_DURATION
): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      console.log(`📭 [CACHE] Não encontrado: ${key}`);
      return null;
    }
    
    const cacheEntry: CacheEntry<T> = JSON.parse(cached);
    const age = Date.now() - cacheEntry.timestamp;
    
    if (age > maxAge) {
      console.log(`⏰ [CACHE] Expirado (${Math.round(age / 1000)}s): ${key}`);
      localStorage.removeItem(key);
      return null;
    }
    
    console.log(`✅ [CACHE] Hit (${Math.round(age / 1000)}s): ${key}`);
    return cacheEntry.data;
  } catch (error) {
    console.error(`❌ [CACHE] Erro ao ler: ${key}`, error);
    return null;
  }
}

/**
 * Remove uma entrada específica do cache
 */
export function removeCacheData(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
    console.log(`🗑️ [CACHE] Removido: ${key}`);
  } catch (error) {
    console.error(`❌ [CACHE] Erro ao remover: ${key}`, error);
  }
}

// ==================== CACHE POR TIPO ====================

/**
 * Cache de Analytics
 */
export const analyticsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.analytics(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.analytics(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.analytics(portfolioId)),
};

/**
 * Cache de Metrics
 */
export const metricsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.metrics(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.metrics(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.metrics(portfolioId)),
};

/**
 * Cache de Holdings (Posições)
 */
export const holdingsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.holdings(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.holdings(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.holdings(portfolioId)),
};

/**
 * Cache de Transactions (Histórico)
 */
export const transactionsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.transactions(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.transactions(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.transactions(portfolioId)),
};

/**
 * Cache de Suggestions (Sugestões)
 */
export const suggestionsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.suggestions(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.suggestions(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.suggestions(portfolioId)),
};

/**
 * Cache de Closed Positions (Posições Encerradas)
 */
export const closedPositionsCache = {
  get: (portfolioId: string) => 
    getCacheData(CACHE_KEYS.closedPositions(portfolioId)),
  
  set: (portfolioId: string, data: any) => 
    setCacheData(CACHE_KEYS.closedPositions(portfolioId), data, portfolioId),
  
  remove: (portfolioId: string) => 
    removeCacheData(CACHE_KEYS.closedPositions(portfolioId)),
};

// ==================== INVALIDAÇÃO GLOBAL ====================

/**
 * Invalida TODOS os caches de uma carteira específica
 * 
 * Deve ser chamado quando qualquer escrita acontecer:
 * - Criar transação
 * - Editar transação
 * - Deletar transação
 * - Aceitar/Rejeitar sugestão
 * - Confirmar todas
 * - Recalcular
 */
export function invalidateAllPortfolioCache(portfolioId: string): void {
  console.log(`🧹 [CACHE] Invalidando TODOS os caches da carteira: ${portfolioId}`);
  
  analyticsCache.remove(portfolioId);
  metricsCache.remove(portfolioId);
  holdingsCache.remove(portfolioId);
  transactionsCache.remove(portfolioId);
  suggestionsCache.remove(portfolioId);
  closedPositionsCache.remove(portfolioId);
  
  console.log(`✅ [CACHE] Todos os caches invalidados para: ${portfolioId}`);
}

/**
 * Limpa TODO o cache de carteiras (todas as carteiras)
 * Útil para logout ou troca de usuário
 */
export function clearAllPortfolioCache(): void {
  if (typeof window === 'undefined') return;
  
  console.log('🧹 [CACHE] Limpando TODOS os caches de carteira...');
  
  try {
    const keys = Object.keys(localStorage);
    let removedCount = 0;
    
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEYS.prefix)) {
        localStorage.removeItem(key);
        removedCount++;
      }
    });
    
    console.log(`✅ [CACHE] ${removedCount} caches removidos`);
  } catch (error) {
    console.error('❌ [CACHE] Erro ao limpar caches:', error);
  }
}

/**
 * Verifica se há cache válido para uma carteira
 */
export function hasValidCache(portfolioId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasAnalytics = !!analyticsCache.get(portfolioId);
  const hasMetrics = !!metricsCache.get(portfolioId);
  const hasHoldings = !!holdingsCache.get(portfolioId);
  const hasTransactions = !!transactionsCache.get(portfolioId);
  
  return hasAnalytics || hasMetrics || hasHoldings || hasTransactions;
}

/**
 * Retorna informações sobre o cache de uma carteira
 */
export function getCacheInfo(portfolioId: string) {
  if (typeof window === 'undefined') return null;
  
  const info = {
    portfolioId,
    analytics: !!analyticsCache.get(portfolioId),
    metrics: !!metricsCache.get(portfolioId),
    holdings: !!holdingsCache.get(portfolioId),
    transactions: !!transactionsCache.get(portfolioId),
    suggestions: !!suggestionsCache.get(portfolioId),
  };
  
  console.log('ℹ️ [CACHE] Info:', info);
  return info;
}

// ==================== EXPORT PRINCIPAL ====================

export const portfolioCache = {
  analytics: analyticsCache,
  metrics: metricsCache,
  holdings: holdingsCache,
  transactions: transactionsCache,
  suggestions: suggestionsCache,
  closedPositions: closedPositionsCache,
  
  // Ações globais
  invalidateAll: invalidateAllPortfolioCache,
  clearAll: clearAllPortfolioCache,
  hasValid: hasValidCache,
  getInfo: getCacheInfo,
  
  // Constantes
  CACHE_DURATION,
} as const;

