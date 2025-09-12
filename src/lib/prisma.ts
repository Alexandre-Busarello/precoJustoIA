import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined;
}

// CORREÇÃO: Configuração otimizada para Supabase com timeout e retry
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  // Configurações para melhorar estabilidade da conexão
  transactionOptions: {
    timeout: 20000, // 20 segundos
  },
});

// Em desenvolvimento, salvar na variável global para evitar hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
