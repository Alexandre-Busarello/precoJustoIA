/**
 * React Query localStorage persistence utilities
 * Provides helper functions to persist and restore individual query data
 */

const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'rq-cache-';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

/**
 * Get cache key for a query
 */
export function getCacheKey(queryKey: unknown[]): string {
  const keyString = JSON.stringify(queryKey);
  // Create a hash-like key (simple approach)
  const hash = keyString.split('').reduce((acc, char) => {
    const hash = ((acc << 5) - acc) + char.charCodeAt(0);
    return hash & hash;
  }, 0);
  return `${CACHE_PREFIX}${Math.abs(hash)}`;
}

/**
 * Save query data to localStorage
 * @param queryKey - Query key array
 * @param data - Data to save
 * @param forceUpdate - Force update timestamp even if data hasn't changed (default: false)
 */
export function saveQueryCache<T>(queryKey: unknown[], data: T, forceUpdate: boolean = false): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(queryKey);
    
    // Verificar se os dados já existem no cache e são iguais
    if (!forceUpdate) {
      const existingCache = localStorage.getItem(cacheKey);
      if (existingCache) {
        try {
          const existingEntry: CacheEntry<T> = JSON.parse(existingCache);
          // Comparar dados (usando JSON.stringify para comparação simples)
          if (JSON.stringify(existingEntry.data) === JSON.stringify(data)) {
            // Dados são iguais, não atualizar timestamp
            return;
          }
        } catch {
          // Se não conseguir comparar, continuar e salvar
        }
      }
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded, clearing old cache entries');
      clearOldCacheEntries();
      // Retry once after clearing
      try {
        const cacheKey = getCacheKey(queryKey);
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        };
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch (retryError) {
        console.error('Failed to persist query cache after clearing:', retryError);
      }
    } else {
      console.error('Failed to persist query cache:', error);
    }
  }
}

/**
 * Get query data from localStorage
 */
export function getQueryCache<T>(queryKey: unknown[], maxAge?: number): T | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const cacheKey = getCacheKey(queryKey);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return undefined;
    }

    const entry: CacheEntry<T> = JSON.parse(cached);
    
    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return undefined;
    }

    // Check if cache is too old
    if (maxAge) {
      if (Date.now() - entry.timestamp > maxAge) {
        localStorage.removeItem(cacheKey);
        return undefined;
      }
    }

    return entry.data;
  } catch (error) {
    console.error('Failed to restore query cache:', error);
    // Clear corrupted cache
    try {
      const cacheKey = getCacheKey(queryKey);
      localStorage.removeItem(cacheKey);
    } catch {
      // Ignore errors when clearing
    }
    return undefined;
  }
}

/**
 * Remove query cache from localStorage
 */
export function removeQueryCache(queryKey: unknown[]): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(queryKey);
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Failed to remove query cache:', error);
  }
}

/**
 * Clear old cache entries to free up space
 * Keeps only the most recent entries
 */
function clearOldCacheEntries() {
  if (typeof window === 'undefined') return;

  try {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    // Collect all cache entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const entry: CacheEntry<unknown> = JSON.parse(value);
            entries.push({ key, timestamp: entry.timestamp });
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Keep only the 100 most recent entries
    const toKeep = entries.slice(0, 100);
    const toKeepKeys = new Set(toKeep.map(e => e.key));

    // Remove old entries
    entries.forEach(entry => {
      if (!toKeepKeys.has(entry.key)) {
        try {
          localStorage.removeItem(entry.key);
        } catch {
          // Ignore errors
        }
      }
    });
  } catch (error) {
    console.error('Error clearing old cache entries:', error);
  }
}

/**
 * Clear all React Query cache entries
 */
export function clearReactQueryCache() {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing React Query cache:', error);
  }
}

/**
 * Get placeholder data from cache for use in React Query
 * PlaceholderData é usado apenas para mostrar dados enquanto carrega (não impede fetch)
 */
export function getPlaceholderData<T>(queryKey: unknown[], maxAge?: number): T | undefined {
  return getQueryCache<T>(queryKey, maxAge);
}

/**
 * Get initial data and timestamp from cache for use in React Query
 * InitialData impede o fetch se os dados estão dentro do staleTime
 * Diferente de placeholderData, initialData evita o fetch quando os dados estão frescos
 */
export function getInitialData<T>(queryKey: unknown[], staleTime: number): { data: T; updatedAt: number } | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    const cacheKey = getCacheKey(queryKey);
    const cachedEntry = localStorage.getItem(cacheKey);
    
    if (!cachedEntry) return undefined;
    
    const entry: CacheEntry<T> = JSON.parse(cachedEntry);
    
    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return undefined;
    }
    
    const age = Date.now() - entry.timestamp;
    
    // Se os dados estão dentro do staleTime, usar como initialData (impede fetch)
    if (age <= staleTime) {
      return {
        data: entry.data,
        updatedAt: entry.timestamp,
      };
    }
    
    // Se os dados estão stale, não usar como initialData (permitir fetch)
    return undefined;
  } catch (error) {
    console.error('Failed to get initial data from cache:', error);
    return undefined;
  }
}

