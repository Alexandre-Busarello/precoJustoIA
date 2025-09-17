import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined;
}

// SOLUÇÃO PADRÃO: Prisma Client simples e direto
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : [],
});

// Em desenvolvimento, salvar na variável global para evitar hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Função simples para desconectar (apenas se necessário)
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Aviso ao desconectar Prisma:', error);
  }
}
