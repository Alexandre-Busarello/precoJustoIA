/**
 * Teste Ponta a Ponta: Custom Trigger Service
 * 
 * Testa a criação e avaliação de gatilhos customizados
 * 
 * Uso:
 *   npx tsx scripts/test-custom-trigger-service.ts PETR4
 *   npx tsx scripts/test-custom-trigger-service.ts PETR4 --create-trigger
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { evaluateTrigger, createQueueEntry, TriggerConfig } from '../src/lib/custom-trigger-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const ticker = args.find(arg => !arg.startsWith('--'))?.toUpperCase();
  const shouldCreateTrigger = args.includes('--create-trigger');

  if (!ticker) {
    console.error('❌ Erro: Forneça um ticker');
    console.log('Uso: npx tsx scripts/test-custom-trigger-service.ts PETR4');
    console.log('     npx tsx scripts/test-custom-trigger-service.ts PETR4 --create-trigger');
    process.exit(1);
  }

  console.log('🧪 TESTE: Custom Trigger Service\n');
  console.log(`📊 Testando ticker: ${ticker}\n`);

  try {
    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
    });

    if (!company) {
      console.error(`❌ Empresa ${ticker} não encontrada no banco de dados`);
      process.exit(1);
    }

    console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})`);

    // Buscar ou criar usuário de teste
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' },
      select: { id: true },
    });

    if (!testUser) {
      console.log('📝 Criando usuário de teste...');
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Usuário de Teste',
        },
        select: { id: true },
      });
      console.log(`✅ Usuário de teste criado: ${testUser.id}`);
    }

    // Criar gatilho de teste se solicitado
    if (shouldCreateTrigger) {
      console.log('\n📝 Criando gatilho customizado de teste...');
      
      const triggerConfig: TriggerConfig = {
        minPl: 5, // P/L mínimo de 5
        maxPvp: 2, // P/VP máximo de 2
        minScore: 60, // Score mínimo de 60
        priceBelow: 50, // Preço abaixo de R$ 50
      };

      // Verificar se já existe gatilho ativo
      const existingMonitor = await prisma.userAssetMonitor.findFirst({
        where: {
          userId: testUser.id,
          companyId: company.id,
          isActive: true,
        },
      });

      let monitor;
      if (existingMonitor) {
        monitor = await prisma.userAssetMonitor.update({
          where: { id: existingMonitor.id },
          data: { triggerConfig: triggerConfig as any },
        });
        console.log(`✅ Gatilho atualizado: ${monitor.id}`);
      } else {
        monitor = await prisma.userAssetMonitor.create({
          data: {
            userId: testUser.id,
            companyId: company.id,
            triggerConfig: triggerConfig as any,
            isActive: true,
          },
        });
        console.log(`✅ Gatilho criado: ${monitor.id}`);
      }

      console.log('\n⚙️  Configuração do Gatilho:');
      console.log(JSON.stringify(triggerConfig, null, 2));
    }

    // Buscar gatilhos ativos para esta empresa
    const monitors = await prisma.userAssetMonitor.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      include: {
        company: {
          select: {
            ticker: true,
          },
        },
      },
    });

    if (monitors.length === 0) {
      console.log('\n⚠️  Nenhum gatilho ativo encontrado para esta empresa');
      console.log('   Use --create-trigger para criar um gatilho de teste');
      return;
    }

    console.log(`\n📋 Encontrados ${monitors.length} gatilho(s) ativo(s)`);

    // Avaliar cada gatilho
    for (const monitor of monitors) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔔 Avaliando Gatilho: ${monitor.id}`);
      console.log('='.repeat(60));

      const evaluation = await evaluateTrigger({
        id: monitor.id,
        companyId: monitor.companyId,
        triggerConfig: monitor.triggerConfig as TriggerConfig,
        company: monitor.company,
      });

      if (!evaluation) {
        console.log('✅ Gatilho não disparado (condições não atendidas)');
        continue;
      }

      if (evaluation.triggered) {
        console.log('\n🚨 GATILHO DISPARADO!');
        console.log('\n📊 Dados da Empresa:');
        Object.entries(evaluation.companyData).forEach(([key, value]) => {
          if (value !== undefined) {
            const formattedValue = key === 'currentPrice' 
              ? `R$ ${Number(value).toFixed(2)}`
              : Number(value).toFixed(2);
            console.log(`   - ${key}: ${formattedValue}`);
          }
        });

        console.log('\n📝 Motivos do Disparo:');
        evaluation.reasons.forEach((reason, index) => {
          console.log(`   ${index + 1}. ${reason}`);
        });

        // Criar entrada na fila
        console.log('\n📝 Criando entrada na fila...');
        const queueId = await createQueueEntry(monitor.id, evaluation);
        console.log(`✅ Entrada criada na fila: ${queueId}`);

        // Verificar entrada criada
        const queueEntry = await prisma.aIReportsQueue.findUnique({
          where: { id: queueId },
          include: {
            company: {
              select: {
                ticker: true,
                name: true,
              },
            },
          },
        });

        if (queueEntry) {
          console.log('\n📋 Detalhes da Entrada na Fila:');
          console.log(`   - ID: ${queueEntry.id}`);
          console.log(`   - Tipo: ${queueEntry.reportType}`);
          console.log(`   - Status: ${queueEntry.status}`);
          console.log(`   - Empresa: ${queueEntry.company.ticker} - ${queueEntry.company.name}`);
          console.log(`   - Criado em: ${queueEntry.createdAt.toLocaleString('pt-BR')}`);
        }
      }
    }
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

  console.log('\n' + '='.repeat(60));
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

