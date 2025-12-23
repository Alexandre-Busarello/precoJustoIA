/**
 * Teste Ponta a Ponta: Price Variation Service
 * 
 * Testa a detecção de variações de preço e criação de entradas na fila
 * 
 * Uso:
 *   npx tsx scripts/test-price-variation-service.ts PETR4
 *   npx tsx scripts/test-price-variation-service.ts PETR4 VALE3 ITUB4
 */

import { PrismaClient } from '@prisma/client';
import { checkPriceVariations } from '../src/lib/price-variation-service';
import { addToQueue } from '../src/lib/ai-report-queue-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
  const tickers = process.argv.slice(2);

  if (tickers.length === 0) {
    console.error('❌ Erro: Forneça pelo menos um ticker');
    console.log('Uso: npx tsx scripts/test-price-variation-service.ts PETR4');
    console.log('     npx tsx scripts/test-price-variation-service.ts PETR4 VALE3 ITUB4');
    process.exit(1);
  }

  console.log('🧪 TESTE: Price Variation Service\n');
  console.log(`📊 Testando ${tickers.length} ticker(s): ${tickers.join(', ')}\n`);

  // Configurar thresholds para teste (valores menores para facilitar teste)
  process.env.PRICE_DROP_1D = process.env.PRICE_DROP_1D || '1'; // 1% para teste
  process.env.PRICE_DROP_30D = process.env.PRICE_DROP_30D || '5'; // 5% para teste
  process.env.PRICE_DROP_1Y = process.env.PRICE_DROP_1Y || '10'; // 10% para teste

  console.log('⚙️  Configuração de Thresholds:');
  console.log(`   - 1 dia: ${process.env.PRICE_DROP_1D}%`);
  console.log(`   - 30 dias: ${process.env.PRICE_DROP_30D}%`);
  console.log(`   - 1 ano: ${process.env.PRICE_DROP_1Y}%\n`);

  for (const ticker of tickers) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📈 Testando: ${ticker}`);
      console.log('='.repeat(60));

      // Buscar empresa
      const company = await prisma.company.findUnique({
        where: { ticker: ticker.toUpperCase() },
        select: {
          id: true,
          ticker: true,
          name: true,
        },
      });

      if (!company) {
        console.log(`❌ Empresa ${ticker} não encontrada no banco de dados`);
        continue;
      }

      console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})`);

      // Verificar variações de preço
      console.log('\n🔍 Verificando variações de preço...');
      const variationCheck = await checkPriceVariations(company.id, company.ticker);

      console.log('\n📊 Resultados das Variações:');
      variationCheck.variations.forEach(v => {
        const symbol = v.variation < 0 ? '📉' : v.variation > 0 ? '📈' : '➡️';
        console.log(`   ${symbol} ${v.days} dias: ${v.variation.toFixed(2)}%`);
        console.log(`      Preço anterior: R$ ${v.previousPrice.toFixed(2)}`);
        console.log(`      Preço atual: R$ ${v.currentPrice.toFixed(2)}`);
      });

      if (variationCheck.triggered && variationCheck.triggerReason) {
        console.log('\n🚨 GATILHO DISPARADO!');
        console.log(`   - Janela: ${variationCheck.triggerReason.days} dias`);
        console.log(`   - Variação: ${variationCheck.triggerReason.variation.toFixed(2)}%`);
        console.log(`   - Threshold: ${variationCheck.triggerReason.threshold}%`);

        // Criar entrada na fila
        console.log('\n📝 Criando entrada na fila...');
        const queueId = await addToQueue({
          companyId: company.id,
          reportType: 'PRICE_VARIATION',
          triggerReason: {
            variation: variationCheck.triggerReason.variation,
            days: variationCheck.triggerReason.days,
            threshold: variationCheck.triggerReason.threshold,
            currentPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.currentPrice,
            previousPrice: variationCheck.variations.find(v => v.days === variationCheck.triggerReason!.days)?.previousPrice,
          },
          priority: variationCheck.triggerReason.days === 1 ? 2 : variationCheck.triggerReason.days === 30 ? 1 : 0,
        });

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
          console.log(`   - Prioridade: ${queueEntry.priority}`);
          console.log(`   - Empresa: ${queueEntry.company.ticker} - ${queueEntry.company.name}`);
          console.log(`   - Criado em: ${queueEntry.createdAt.toLocaleString('pt-BR')}`);
        }
      } else {
        console.log('\n✅ Nenhum gatilho disparado (variações dentro dos limites)');
      }
    } catch (error) {
      console.error(`\n❌ Erro ao processar ${ticker}:`, error);
      if (error instanceof Error) {
        console.error(`   Mensagem: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
      }
    }
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

