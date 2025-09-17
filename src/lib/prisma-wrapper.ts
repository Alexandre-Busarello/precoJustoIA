/**
 * Wrapper SIMPLES para queries Prisma
 * 
 * Solução padrão: prepared_statements=false na URL resolve o problema
 */

import { prisma } from './prisma';

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
 * Query simples com log básico
 */
export async function safeQuery<T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await withPrismaRetry(operation);
    
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
 * Transaction simples
 */
export async function safeTransaction<T>(
  transactionName: string,
  operation: () => Promise<T>
): Promise<T> {
  return await safeQuery(transactionName, operation);
}

// Fim do arquivo - sem gambiarras!

// Re-exportar prisma para uso centralizado
export { prisma } from './prisma';
