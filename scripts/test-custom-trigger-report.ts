/**
 * Teste Ponta a Ponta: Custom Trigger Report Service
 * 
 * Testa a geração de relatório de gatilho customizado
 * 
 * Uso:
 *   npx tsx scripts/test-custom-trigger-report.ts PETR4
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { generateCustomTriggerReport } from '../src/lib/custom-trigger-report-service';
import { TriggerConfig } from '../src/lib/custom-trigger-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const ticker = process.argv[2]?.toUpperCase();

  if (!ticker) {
    console.error('❌ Erro: Forneça um ticker');
    console.log('Uso: npx tsx scripts/test-custom-trigger-report.ts PETR4');
    process.exit(1);
  }

  console.log('🧪 TESTE: Custom Trigger Report Service\n');
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

    console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})\n`);

    // Buscar dados financeiros
    const financialData = await prisma.financialData.findFirst({
      where: { companyId: company.id },
      orderBy: { year: 'desc' },
      select: {
        pl: true,
        pvp: true,
      },
    });

    // Buscar score
    const snapshot = await prisma.assetSnapshot.findFirst({
      where: {
        companyId: company.id,
        isLatest: true,
      },
      select: {
        overallScore: true,
      },
    });

    // Buscar preço atual
    const { getTickerPrice } = await import('../src/lib/quote-service');
    const priceData = await getTickerPrice(ticker);

    const companyData = {
      pl: financialData?.pl ? Number(financialData.pl) : undefined,
      pvp: financialData?.pvp ? Number(financialData.pvp) : undefined,
      score: snapshot?.overallScore ? Number(snapshot.overallScore) : undefined,
      currentPrice: priceData?.price,
    };

    console.log('📊 Dados da Empresa:');
    Object.entries(companyData).forEach(([key, value]) => {
      if (value !== undefined) {
        const formattedValue = key === 'currentPrice' 
          ? `R$ ${Number(value).toFixed(2)}`
          : Number(value).toFixed(2);
        console.log(`   - ${key}: ${formattedValue}`);
      }
    });
    console.log();

    // Configuração de gatilho de teste
    const triggerConfig: TriggerConfig = {
      minPl: 5,
      maxPvp: 2,
      minScore: 60,
      priceBelow: 50,
    };

    const reasons = [
      `P/L (${companyData.pl?.toFixed(2) || 'N/A'}) atingiu mínimo configurado (5)`,
      `P/VP (${companyData.pvp?.toFixed(2) || 'N/A'}) atingiu máximo configurado (2)`,
      `Score (${companyData.score?.toFixed(1) || 'N/A'}) atingiu mínimo configurado (60)`,
    ].filter(r => r.includes('atingiu'));

    console.log('='.repeat(60));
    console.log('TESTE: Geração de Relatório Customizado');
    console.log('='.repeat(60));
    console.log('📝 Gerando relatório...\n');

    const report = await generateCustomTriggerReport({
      ticker: company.ticker,
      companyName: company.name,
      triggerConfig,
      companyData,
      reasons: reasons.length > 0 ? reasons : ['Gatilho de teste disparado'],
    });

    console.log('✅ Relatório gerado!\n');
    console.log('📄 Relatório Completo:');
    console.log('='.repeat(60));
    console.log(report);
    console.log('='.repeat(60));
    console.log();

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

