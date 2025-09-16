import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined;
}

// CORREÇÃO: Configuração OTIMIZADA - Sem transações desnecessárias
export const prisma = globalThis.__prisma || new PrismaClient({
  // Log temporário para verificar otimizações
  log: process.env.NODE_ENV === 'development' ? ['query'] : [], // Ativar temporariamente
  
  // Configuração específica para resolver prepared statements duplicadas
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  
  // Configurações otimizadas para PGBouncer
  transactionOptions: {
    timeout: 10000, // 10 segundos (reduzido)
    isolationLevel: 'ReadCommitted',
    maxWait: 2000, // Max 2s esperando por transação
  },
  
  // Configurações para performance
  errorFormat: 'minimal',
});

// Em desenvolvimento, salvar na variável global para evitar hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// OTIMIZADO: Limpeza inteligente de prepared statements
let statementsCleared = false;
let lastClearTime = 0;

export async function smartDeallocate() {
  const now = Date.now();
  // Só executar DEALLOCATE ALL uma vez a cada 30 segundos, no máximo
  if (!statementsCleared || (now - lastClearTime) > 30000) {
    try {
      await prisma.$executeRaw`DEALLOCATE ALL`;
      statementsCleared = true;
      lastClearTime = now;
    } catch (error) {
      // DEALLOCATE ALL pode falhar se não houver statements - é normal
      statementsCleared = true;
      lastClearTime = now;
    }
  }
}

// Função para resetar conexão apenas em caso de erro crítico
export async function resetPrismaConnection() {
  try {
    await prisma.$disconnect();
    statementsCleared = false;
    lastClearTime = 0;
    await new Promise(resolve => setTimeout(resolve, 500)); // Pausa reduzida
  } catch (error) {
    console.warn('Erro ao resetar conexão Prisma:', error);
  }
}
