/**
 * Script: Reclassifica HASH11 de FII → ETF
 *
 * O que faz:
 * 1. Muda Company.assetType de FII para ETF
 * 2. Remove o registro FiiData associado
 * 3. Garante que EtfData existe (cria se não existir)
 * 4. Executa Phase 2 (etf1.com.br) para HASH11
 * 5. Executa análise de IA e cálculo de score
 * 6. Gera descrição didática via Gemini
 *
 * Uso: npx tsx scripts/fix-hash11.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runPhase2 } from '../src/lib/etf-scrapers/etf1-client';
import { refreshEtfAiAnalyses, recalculateAllEtfScores } from '../src/lib/etf-scoring';
import { generateEtfDescriptions } from '../src/lib/etf-description-service';

const prisma = new PrismaClient();
const TICKER = 'HASH11';

async function main() {
  console.log(`\n🔧 Reclassificando ${TICKER}: FII → ETF\n`);

  const company = await prisma.company.findUnique({
    where: { ticker: TICKER },
    select: { id: true, assetType: true, fiiData: { select: { id: true } }, etfData: { select: { id: true } } },
  });

  if (!company) {
    console.error(`❌ ${TICKER} não encontrado na base`);
    process.exit(1);
  }

  console.log(`📋 Status atual:`);
  console.log(`   assetType: ${company.assetType}`);
  console.log(`   fiiData:   ${company.fiiData ? `id=${company.fiiData.id}` : 'null'}`);
  console.log(`   etfData:   ${company.etfData ? `id=${company.etfData.id}` : 'null'}\n`);

  await prisma.$transaction(async (tx) => {
    // 1. Muda assetType
    await tx.company.update({
      where: { id: company.id },
      data: { assetType: 'ETF' },
    });
    console.log(`✅ assetType → ETF`);

    // 2. Remove fiiData se existir
    if (company.fiiData) {
      await tx.fiiData.delete({ where: { id: company.fiiData.id } });
      console.log(`✅ fiiData removido`);
    }

    // 3. Cria etfData se não existir
    if (!company.etfData) {
      await tx.etfData.create({
        data: { companyId: company.id, dataSource: 'brapi+etf1' },
      });
      console.log(`✅ etfData criado`);
    } else {
      console.log(`ℹ️  etfData já existia`);
    }
  });

  console.log(`\n📡 Executando Phase 2 (etf1.com.br) para ${TICKER}...`);
  const phase2Result = await runPhase2(prisma, { tickers: [TICKER], force: true });
  console.log(`   Processados: ${phase2Result.processed}, Falhas: ${phase2Result.failed}`);

  console.log(`\n🤖 Executando análise de IA...`);
  await refreshEtfAiAnalyses();

  console.log(`\n📊 Recalculando score...`);
  await recalculateAllEtfScores();

  console.log(`\n📝 Gerando descrição...`);
  const descStats = await generateEtfDescriptions({ ticker: TICKER });
  console.log(`   Geradas: ${descStats.generated}, Falhas: ${descStats.failed}`);

  const result = await prisma.company.findUnique({
    where: { ticker: TICKER },
    select: {
      assetType: true,
      description: true,
      etfData: { select: { etfScore: true, category: true, etfClass: true, benchmarkIndex: true, netExpenseRatio: true } },
    },
  });

  console.log(`\n✅ ${TICKER} atualizado com sucesso:`);
  console.log(`   assetType:     ${result?.assetType}`);
  console.log(`   etfScore:      ${result?.etfData?.etfScore ?? 'null'}`);
  console.log(`   category:      ${result?.etfData?.category ?? 'null'}`);
  console.log(`   benchmarkIndex:${result?.etfData?.benchmarkIndex ?? 'null'}`);
  console.log(`   description:   ${result?.description ? `${result.description.slice(0, 60)}...` : 'null'}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
