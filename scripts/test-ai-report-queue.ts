/**
 * Teste Ponta a Ponta: AI Report Queue Service
 * 
 * Testa o sistema de fila e checkpointing
 * 
 * Uso:
 *   npx tsx scripts/test-ai-report-queue.ts
 *   npx tsx scripts/test-ai-report-queue.ts --create-test-entry
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import {
  addToQueue,
  getNextBatch,
  markProcessing,
  saveCheckpoint,
  getCheckpoint,
  getNextStep,
  completeQueue,
  getAllCheckpoints,
} from '../src/lib/ai-report-queue-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const shouldCreateEntry = args.includes('--create-test-entry');

  console.log('🧪 TESTE: AI Report Queue Service\n');

  try {
    // Criar entrada de teste se solicitado
    if (shouldCreateEntry) {
      console.log('📝 Criando entrada de teste na fila...');

      // Buscar primeira empresa disponível
      const company = await prisma.company.findFirst({
        where: { assetType: 'STOCK' },
        select: {
          id: true,
          ticker: true,
          name: true,
        },
      });

      if (!company) {
        console.error('❌ Nenhuma empresa encontrada no banco de dados');
        process.exit(1);
      }

      console.log(`✅ Usando empresa: ${company.ticker} - ${company.name}`);

      // Criar entrada PRICE_VARIATION
      const queueId1 = await addToQueue({
        companyId: company.id,
        reportType: 'PRICE_VARIATION',
        triggerReason: {
          variation: -5.5,
          days: 1,
          threshold: 5,
          currentPrice: 25.50,
          previousPrice: 27.00,
        },
        priority: 2,
      });
      console.log(`✅ Entrada PRICE_VARIATION criada: ${queueId1}`);

      // Criar entrada CUSTOM_TRIGGER
      const queueId2 = await addToQueue({
        companyId: company.id,
        reportType: 'CUSTOM_TRIGGER',
        triggerReason: {
          monitorId: 'test-monitor',
          reasons: ['P/L atingiu mínimo configurado'],
          companyData: {
            pl: 8.5,
            pvp: 1.2,
            score: 75,
            currentPrice: 25.50,
          },
        },
        priority: 1,
      });
      console.log(`✅ Entrada CUSTOM_TRIGGER criada: ${queueId2}\n`);
    }

    // Teste 1: Buscar próximo lote
    console.log('='.repeat(60));
    console.log('TESTE 1: Buscar Próximo Lote');
    console.log('='.repeat(60));
    const batch = await getNextBatch(5);
    console.log(`📦 Encontradas ${batch.length} entrada(s) na fila\n`);

    if (batch.length === 0) {
      console.log('⚠️  Nenhuma entrada encontrada. Use --create-test-entry para criar entradas de teste');
      return;
    }

    // Testar com primeira entrada
    const testEntry = batch[0];
    console.log(`📋 Testando com entrada: ${testEntry.id}`);
    console.log(`   - Tipo: ${testEntry.reportType}`);
    console.log(`   - Status: ${testEntry.status}`);
    console.log(`   - Empresa ID: ${testEntry.companyId}\n`);

    // Teste 2: Marcar como PROCESSING
    console.log('='.repeat(60));
    console.log('TESTE 2: Marcar como PROCESSING');
    console.log('='.repeat(60));
    await markProcessing(testEntry.id);
    console.log(`✅ Entrada ${testEntry.id} marcada como PROCESSING\n`);

    // Teste 3: Determinar próxima etapa
    console.log('='.repeat(60));
    console.log('TESTE 3: Determinar Próxima Etapa');
    console.log('='.repeat(60));
    const nextStep = await getNextStep(testEntry.id);
    console.log(`📌 Próxima etapa: ${nextStep || 'Todas as etapas completadas'}\n`);

    if (nextStep) {
      // Teste 4: Salvar checkpoint
      console.log('='.repeat(60));
      console.log(`TESTE 4: Salvar Checkpoint - ${nextStep}`);
      console.log('='.repeat(60));
      
      const testData = {
        message: `Dados de teste para etapa ${nextStep}`,
        timestamp: new Date().toISOString(),
        test: true,
      };

      await saveCheckpoint(testEntry.id, nextStep, testData);
      console.log(`✅ Checkpoint salvo para etapa ${nextStep}\n`);

      // Teste 5: Buscar checkpoint
      console.log('='.repeat(60));
      console.log(`TESTE 5: Buscar Checkpoint - ${nextStep}`);
      console.log('='.repeat(60));
      const checkpoint = await getCheckpoint(testEntry.id, nextStep);
      
      if (checkpoint) {
        console.log(`✅ Checkpoint encontrado:`);
        console.log(`   - Etapa: ${checkpoint.step}`);
        console.log(`   - Dados: ${JSON.stringify(checkpoint.data, null, 2)}`);
      } else {
        console.log(`❌ Checkpoint não encontrado`);
      }
      console.log();

      // Teste 6: Buscar todos os checkpoints
      console.log('='.repeat(60));
      console.log('TESTE 6: Buscar Todos os Checkpoints');
      console.log('='.repeat(60));
      const allCheckpoints = await getAllCheckpoints(testEntry.id);
      console.log(`📋 Encontrados ${allCheckpoints.length} checkpoint(s):`);
      allCheckpoints.forEach((cp, index) => {
        console.log(`   ${index + 1}. ${cp.step}`);
      });
      console.log();

      // Teste 7: Determinar próxima etapa novamente
      console.log('='.repeat(60));
      console.log('TESTE 7: Determinar Próxima Etapa (Após Checkpoint)');
      console.log('='.repeat(60));
      const nextStepAfter = await getNextStep(testEntry.id);
      console.log(`📌 Próxima etapa: ${nextStepAfter || 'Todas as etapas completadas'}\n`);
    }

    // Teste 8: Listar todas as entradas na fila
    console.log('='.repeat(60));
    console.log('TESTE 8: Listar Todas as Entradas na Fila');
    console.log('='.repeat(60));
    const allEntries = await prisma.aIReportsQueue.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            ticker: true,
            name: true,
          },
        },
        processingSteps: {
          select: {
            step: true,
            completedAt: true,
          },
        },
      },
    });

    console.log(`📋 Últimas ${allEntries.length} entrada(s) na fila:\n`);
    allEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.company.ticker} - ${entry.reportType}`);
      console.log(`   - ID: ${entry.id}`);
      console.log(`   - Status: ${entry.status}`);
      console.log(`   - Prioridade: ${entry.priority}`);
      console.log(`   - Checkpoints: ${entry.processingSteps.length}`);
      console.log(`   - Criado em: ${entry.createdAt.toLocaleString('pt-BR')}`);
      console.log();
    });

  } catch (error) {
    console.error('\n❌ Erro:', error);
    if (error instanceof Error) {
      console.error(`   Mensagem: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    }
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('✅ Teste concluído!');
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

