import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Cliente Prisma simples para processos em background
const backgroundPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKGROUND_PROCESS_POSTGRES || process.env.DATABASE_URL
    }
  },
  // Configurações otimizadas para background processing
  log: ['error', 'warn'], // Reduzir logs para melhor performance
});

// Classe simplificada para gerenciar o Prisma
export class BackgroundPrismaManager {
  private static instance: BackgroundPrismaManager;

  private constructor() {}

  static getInstance(): BackgroundPrismaManager {
    if (!BackgroundPrismaManager.instance) {
      BackgroundPrismaManager.instance = new BackgroundPrismaManager();
    }
    return BackgroundPrismaManager.instance;
  }

  // Getter para o cliente Prisma
  get client() {
    return backgroundPrisma;
  }

  // Método para desconectar
  async disconnect() {
    await backgroundPrisma.$disconnect();
    console.log('🔌 Cliente Prisma de background desconectado');
  }
}

// Exportar instância singleton
export const backgroundPrismaManager = BackgroundPrismaManager.getInstance();
export { backgroundPrisma };

// Cleanup automático ao sair
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT, desconectando Prisma...');
  await backgroundPrismaManager.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM, desconectando Prisma...');
  await backgroundPrismaManager.disconnect();
  process.exit(0);
});
