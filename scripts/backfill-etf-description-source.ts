/**
 * Script one-off: backfilla descriptionSource='ai' para ETFs cuja descrição
 * já está em português (presumivelmente gerada pelo Gemini antes do campo
 * descriptionSource existir), sem gastar chamadas de API.
 *
 * ETFs com boilerplate em inglês (herdado do longBusinessSummary da Yahoo)
 * ficam de fora e devem ser reprocessados via generate-etf-descriptions.ts.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const ENGLISH_BOILERPLATE_PATTERNS = [
  /is an exchange traded fund/i,
  /was formed on/i,
  /is domiciled in/i,
  /seeks to (track|replicate)/i,
  /the fund seeks/i,
  /launched and managed by/i,
];

function looksLikeEnglishBoilerplate(text: string): boolean {
  return ENGLISH_BOILERPLATE_PATTERNS.some((re) => re.test(text));
}

async function main() {
  const etfs = await prisma.company.findMany({
    where: { assetType: 'ETF', isActive: true, description: { not: null }, descriptionSource: null },
    select: { id: true, ticker: true, description: true },
  });

  const toBackfill = etfs.filter((e) => !looksLikeEnglishBoilerplate(e.description!));
  const toSkip = etfs.filter((e) => looksLikeEnglishBoilerplate(e.description!));

  console.log(`ETFs elegíveis para backfill: ${toBackfill.length}`);
  console.log(`ETFs com boilerplate em inglês (não tocados, serão reprocessados): ${toSkip.map((e) => e.ticker).join(', ')}`);

  for (const etf of toBackfill) {
    await prisma.company.update({ where: { id: etf.id }, data: { descriptionSource: 'ai' } });
  }

  console.log(`✅ Backfill concluído: ${toBackfill.length} ETFs marcados como descriptionSource='ai'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
