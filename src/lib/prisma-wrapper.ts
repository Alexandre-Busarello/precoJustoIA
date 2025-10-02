/**
 * Wrapper INTELIGENTE para queries Prisma
 * 
 * Funcionalidades:
 * - Cache automático para queries de leitura (1 hora)
 * - Invalidação automática baseada em operações de escrita
 * - Detecção inteligente de tabelas afetadas
 * - Logs detalhados para debugging
 */

import { prisma } from './prisma'
import { SmartQueryCache } from './smart-query-cache'

/**
 * Executa operação diretamente (sem gambiarras)
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  return await operation();
}

// Sem declarações globais desnecessárias - tudo gerenciado localmente

/**
 * Query inteligente com cache automático e invalidação
 */
export async function safeQuery<T>(
  queryName: string,
  operation: () => Promise<T>,
  options?: {
    skipCache?: boolean // Pular cache para esta query específica
    operationString?: string // String da operação para análise
    cacheKey?: string // Chave de cache customizada (inclui parâmetros)
  }
): Promise<T> {
  const startTime = Date.now();
  
  try {
    let result: T;
    
    // Usar cache inteligente se não foi desabilitado
    if (!options?.skipCache) {
      // Se temos uma chave customizada, usar ela para criar uma operationString única
      const operationString = options?.cacheKey 
        ? `${operation.toString()}_PARAMS_${options.cacheKey}`
        : options?.operationString || operation.toString()
      
      result = await SmartQueryCache.executeWithCache(
        queryName,
        () => withPrismaRetry(operation),
        operationString
      );
    } else {
      result = await withPrismaRetry(operation);
      console.log(`🚫 Cache pulado para: ${queryName}`);
    }
    
    // Log apenas queries muito lentas
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development' && duration > 2000) {
      console.log(`🐌 Query lenta '${queryName}': ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ Falha na query '${queryName}' (${duration}ms):`, error);
    }
    throw error;
  }
}

/**
 * Transaction inteligente com invalidação de cache
 */
export async function safeTransaction<T>(
  transactionName: string,
  operation: () => Promise<T>,
  options?: {
    skipCache?: boolean
    affectedTables?: string[] // Tabelas que serão afetadas pela transação
  }
): Promise<T> {
  const startTime = Date.now();
  
  try {
    // Executar transação
    const result = await safeQuery(transactionName, operation, {
      skipCache: true, // Transações sempre pulam cache
      operationString: options?.affectedTables ? 
        `TRANSACTION affecting: ${options.affectedTables.join(', ')}` : 
        operation.toString()
    });
    
    // Invalidar cache das tabelas afetadas se especificado (assíncrono, não bloqueia)
    if (options?.affectedTables && options.affectedTables.length > 0) {
      SmartQueryCache.invalidateCacheForTables(options.affectedTables);
      console.log(`🗑️ Cache sendo invalidado para transação '${transactionName}': ${options.affectedTables.join(', ')}`);
    }
    
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`💾 Transação '${transactionName}' concluída: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Falha na transação '${transactionName}' (${duration}ms):`, error);
    throw error;
  }
}

/**
 * Operação de escrita com invalidação automática de cache
 */
export async function safeWrite<T>(
  operationName: string,
  operation: () => Promise<T>,
  affectedTables: string[]
): Promise<T> {
  const startTime = Date.now();
  
  try {
    // Executar operação de escrita
    const result = await withPrismaRetry(operation);
    
    // Invalidar cache das tabelas afetadas (assíncrono, não bloqueia)
    if (affectedTables.length > 0) {
      SmartQueryCache.invalidateCacheForTables(affectedTables);
      console.log(`✍️ Operação '${operationName}' executada, cache sendo invalidado: ${affectedTables.join(', ')}`);
    }
    
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.log(`🐌 Operação de escrita lenta '${operationName}': ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Falha na operação '${operationName}' (${duration}ms):`, error);
    throw error;
  }
}

/**
 * Limpar cache manualmente
 */
export async function clearQueryCache(tables?: string[]): Promise<void> {
  if (tables && tables.length > 0) {
    await SmartQueryCache.invalidateCacheForTables(tables);
    console.log(`🧹 Cache limpo para tabelas: ${tables.join(', ')}`);
  } else {
    await SmartQueryCache.clearAllQueryCache();
    console.log('🧹 Todo o cache de queries foi limpo');
  }
}

/**
 * Obter estatísticas do cache
 */
export async function getCacheStats() {
  return await SmartQueryCache.getCacheStats();
}

/**
 * Helper para criar chaves de cache com parâmetros
 */
export function createCacheKey(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .sort() // Ordenar para garantir consistência
    .join('&')
}

/**
 * Wrapper conveniente para queries com parâmetros
 */
export async function safeQueryWithParams<T>(
  queryName: string,
  operation: () => Promise<T>,
  params: Record<string, any>,
  options?: {
    skipCache?: boolean
    operationString?: string
  }
): Promise<T> {
  return safeQuery(queryName, operation, {
    ...options,
    cacheKey: createCacheKey(params)
  })
}

// Re-exportar prisma e smart cache para uso centralizado
export { prisma } from './prisma'
export { SmartQueryCache, smartCache } from './smart-query-cache'
