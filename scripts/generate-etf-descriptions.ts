/**
 * Script: Geração de Descrições de ETFs com Gemini
 *
 * Uso:
 *   npx tsx scripts/generate-etf-descriptions.ts              → apenas ETFs sem descrição
 *   npx tsx scripts/generate-etf-descriptions.ts --force      → recriar todas as descrições
 *   npx tsx scripts/generate-etf-descriptions.ts --ticker=BOVA11  → apenas um ETF
 */
import 'dotenv/config';
import { generateEtfDescriptions } from '../src/lib/etf-description-service';

async function main() {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--force');
  const tickerArg = args.find((a) => a.startsWith('--ticker='))?.split('=')[1];

  console.log('🚀 Geração de descrições de ETFs com Gemini\n');
  if (forceAll) console.log('⚡ Modo: recriar TODAS as descrições');
  else if (tickerArg) console.log(`🎯 Apenas: ${tickerArg.toUpperCase()}`);
  else console.log('📋 Modo: apenas ETFs sem descrição');

  console.log();

  const stats = await generateEtfDescriptions({ forceAll, ticker: tickerArg });

  console.log(`\n📊 Resultado final:`);
  console.log(`   ✅ Geradas:  ${stats.generated}`);
  console.log(`   ❌ Falhas:   ${stats.failed}`);
  console.log(`   ⊘  Puladas:  ${stats.skipped}`);

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
