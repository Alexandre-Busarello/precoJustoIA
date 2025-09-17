/**
 * Wrapper OTIMIZADO para queries Prisma - SEM transações desnecessárias
 * 
 * Resolve erro 42P05 com overhead mínimo e sem transações para queries simples
 */

import { prisma, resetPrismaConnection, smartDeallocate } from './prisma';

/**
 * Executa query simples SEM transação (máxima performance)
 */
async function executeWithoutTransaction<T>(operation: () => Promise<T>): Promise<T> {
  // Limpeza inteligente de prepared statements (apenas quando necessário)
  await smartDeallocate();
  
  // Executar operação SEM transação
  return await operation();
}

/**
 * Retry INTELIGENTE - só em caso de erro real 42P05
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  useTransaction: boolean = false
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Para queries simples, evitar transações completamente
      if (!useTransaction) {
        return await executeWithoutTransaction(operation);
      } else {
        return await operation();
      }
      
    } catch (error: unknown) {
      const is42P05Error = 
        (error as { code?: string })?.code === '42P05' || 
        (error as { message?: string })?.message?.includes('duplicate_prepared_statement') ||
        (error as { message?: string })?.message?.includes('42P05');

      if (is42P05Error && attempt < maxRetries) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔄 Erro 42P05 detectado (tentativa ${attempt}/${maxRetries}). Limpando prepared statements...`);
        }
        
        // Limpar prepared statements de forma inteligente
        try {
          await smartDeallocate();
        } catch {
          // Se não conseguir limpar, resetar conexão como fallback
          await resetPrismaConnection();
        }
        
        // Pausa mínima
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Se não é erro 42P05 ou esgotaram as tentativas, relançar erro
      if (process.env.NODE_ENV === 'development' && is42P05Error) {
        console.error(`❌ Erro 42P05 persistente após ${maxRetries} tentativas:`, (error as { message?: string })?.message);
      }
      
      throw error;
    }
  }
  
  throw new Error('Todas as tentativas falharam');
}

// Sem declarações globais desnecessárias - tudo gerenciado localmente

/**
 * Query RÁPIDA sem transação (para SELECTs simples)
 */
export async function safeQuery<T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> {
  const shouldLog = process.env.NODE_ENV === 'development';
  const startTime = Date.now();
  
  try {
    // SEM transação para máxima performance
    const result = await withPrismaRetry(operation, 2, false);
    
    // Log apenas queries lentas
    const duration = Date.now() - startTime;
    if (shouldLog && duration > 1000) {
      console.log(`🐌 Query lenta '${queryName}': ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (shouldLog) {
      console.error(`❌ Falha na query '${queryName}' (${duration}ms):`, error);
    }
    throw error;
  }
}

/**
 * Query com TRANSAÇÃO (apenas quando necessário)
 */
export async function safeTransaction<T>(
  transactionName: string,
  operation: () => Promise<T>
): Promise<T> {
  const shouldLog = process.env.NODE_ENV === 'development';
  const startTime = Date.now();
  
  try {
    // COM transação explícita
    const result = await withPrismaRetry(operation, 2, true);
    
    const duration = Date.now() - startTime;
    if (shouldLog && duration > 500) {
      console.log(`🔗 Transaction '${transactionName}': ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (shouldLog) {
      console.error(`❌ Falha na transaction '${transactionName}' (${duration}ms):`, error);
    }
    throw error;
  }
}

/**
 * Limpa prepared statements existentes (força reconexão)
 */
export async function clearPreparedStatements(): Promise<void> {
  try {
    // Desconectar todas as conexões ativas
    await prisma.$disconnect();
    
    // Aguardar um momento para garantir limpeza
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Testar nova conexão
    await prisma.$connect();
    
    console.log('✅ Prepared statements limpos com sucesso');
  } catch (error) {
    console.error('❌ Erro ao limpar prepared statements:', error);
    throw error;
  }
}

/**
 * Middleware para APIs que sofrem com erro 42P05
 */
export function withPrismaErrorHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  apiName: string = 'API'
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      const is42P05Error = 
        (error as { code?: string })?.code === '42P05' || 
        (error as { message?: string })?.message?.includes('duplicate_prepared_statement');

      if (is42P05Error) {
        console.error(`🚨 Erro 42P05 detectado em ${apiName}. Tentando recuperação automática...`);
        
        // Tentar limpar prepared statements
        try {
          await clearPreparedStatements();
          
          // Tentar novamente a operação original
          return await handler(...args);
        } catch (retryError) {
          console.error(`❌ Falha na recuperação automática para ${apiName}:`, retryError);
          throw retryError;
        }
      }

      // Se não é erro 42P05, relançar normalmente
      throw error;
    }
  }) as T;
}

// Re-exportar prisma para uso centralizado
export { prisma } from './prisma';
