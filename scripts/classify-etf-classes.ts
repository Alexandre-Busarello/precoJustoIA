/**
 * Script: Classificação de ETFs em classes via Gemini
 *
 * Classifica cada ETF em uma das 10 classes padronizadas.
 * O Gemini analisa nome, benchmark, categoria e holdings para garantir
 * consistência entre todos os ETFs da base.
 *
 * Classes disponíveis:
 *   Renda Variável BR    — Índices de ações brasileiras (IBOV, IBX, Small Caps, etc.)
 *   Internacional        — Exposição a ações internacionais com hedge cambial
 *   Internacional BDR    — BDRs e fundos de ações internacionais sem hedge
 *   Renda Fixa           — Títulos públicos e crédito privado (LFT, NTN-B, etc.)
 *   Dividendos           — Foco em ações pagadoras de dividendos
 *   Setorial             — Setor específico: agro, infra, tech, utilities, etc.
 *   Multimercado         — Mix balanceado de ativos (ações + renda fixa)
 *   Commodities          — Ouro, prata, petróleo e outras commodities
 *   Cripto               — Criptoativos (Bitcoin, ETH, HASH, etc.)
 *   ESG                  — Empresas com critérios ambientais, sociais e de governança
 *
 * Uso:
 *   npx tsx scripts/classify-etf-classes.ts              → apenas sem classe
 *   npx tsx scripts/classify-etf-classes.ts --force      → reclassificar todos
 *   npx tsx scripts/classify-etf-classes.ts --ticker=BOVA11
 */
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MODEL = 'gemini-flash-lite-latest';

const ETF_CLASSES = [
  'Renda Variável BR',
  'Internacional',
  'Internacional BDR',
  'Renda Fixa',
  'Dividendos',
  'Setorial',
  'Multimercado',
  'Commodities',
  'Cripto',
  'ESG',
] as const;

type EtfClass = typeof ETF_CLASSES[number];

interface EtfForClassification {
  ticker: string;
  name: string;
  category: string | null;
  benchmarkIndex: string | null;
  etfClass: string | null;
  topHoldings: string[];
}

function buildClassificationPrompt(etfs: EtfForClassification[]): string {
  const classDescriptions = `
Classes disponíveis (use EXATAMENTE uma dessas strings):
- "Renda Variável BR" → ETFs que replicam índices de ações brasileiras (IBOV, IBX, SMLL, IDIV, IFIX, UTIL, etc.)
- "Internacional" → ETFs com exposição a ações internacionais COM hedge cambial (BRL-hedged)
- "Internacional BDR" → ETFs com exposição a ações internacionais SEM hedge cambial (retorno em USD)
- "Renda Fixa" → ETFs de títulos públicos (Selic, IPCA+, pré-fixado) ou crédito privado
- "Dividendos" → ETFs com foco em ações pagadoras de dividendos/proventos
- "Setorial" → ETFs de um setor específico (agro, infraestrutura, tecnologia, utilities, saúde, financeiro, etc.)
- "Multimercado" → ETFs que combinam ações + renda fixa ou múltiplas classes de ativos
- "Commodities" → ETFs de ouro, prata, petróleo, commodities agrícolas, etc.
- "Cripto" → ETFs de criptoativos (Bitcoin, Ethereum, blockchain, criptomoedas)
- "ESG" → ETFs com critérios ambientais, sociais e de governança (ESG, ISE, carbono, etc.)
`.trim();

  const rows = etfs.map((e) => {
    const holdings = e.topHoldings.length > 0 ? e.topHoldings.slice(0, 3).join(', ') : 'N/D';
    return `${e.ticker}|${e.name}|${e.benchmarkIndex ?? e.category ?? 'N/D'}|${holdings}`;
  });

  return `Você é especialista em ETFs brasileiros listados na B3. Classifique cada ETF abaixo em exatamente uma das classes disponíveis.

${classDescriptions}

REGRAS IMPORTANTES:
- ETFs Quanto (fundos espelho com swaps cambiais como colateral, ex: SPXR11, NASD11, WRLD11) → "Internacional" (com hedge)
- ETFs de IVVB11, BNDX11 e similares que são BDR de ETFs americanos → "Internacional BDR"
- HASH11 → "Cripto"
- Fundos de ouro (GOLD11, OGLD11) → "Commodities"
- Garanta consistência: todos os ETFs que replicam o mesmo índice devem ter a mesma classe
- Responda APENAS com JSON array, sem explicações

FORMATO DA RESPOSTA (JSON array, uma entrada por ETF, na mesma ordem):
[{"ticker":"BOVA11","class":"Renda Variável BR"},...]

ETFs para classificar (ticker|nome|benchmark/categoria|top holdings):
${rows.join('\n')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyBatch(
  ai: GoogleGenAI,
  etfs: EtfForClassification[]
): Promise<Map<string, EtfClass>> {
  const prompt = buildClassificationPrompt(etfs);
  const result = new Map<string, EtfClass>();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = (response.text ?? '').trim();
      // Extrair JSON — pode vir dentro de bloco de código
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('resposta não contém JSON array');

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ ticker: string; class: string }>;

      for (const item of parsed) {
        if (ETF_CLASSES.includes(item.class as EtfClass)) {
          result.set(item.ticker, item.class as EtfClass);
        } else {
          console.warn(`⚠️  Classe inválida para ${item.ticker}: "${item.class}"`);
        }
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  Tentativa ${attempt}/3: ${msg}`);
      if (attempt < 3) await delay(Math.pow(2, attempt) * 1000);
    }
  }

  console.error(`❌ Classificação falhou para lote de ${etfs.length} ETFs`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--force');
  const tickerArg = args.find((a) => a.startsWith('--ticker='))?.split('=')[1]?.toUpperCase();

  console.log(`🤖 Classificação de ETFs via Gemini\n`);
  if (forceAll) console.log('⚡ Modo: reclassificar TODOS');
  else if (tickerArg) console.log(`🎯 Apenas: ${tickerArg}`);
  else console.log('📋 Modo: apenas ETFs sem classe');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY não configurada');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const where: Record<string, unknown> = { assetType: 'ETF', isActive: true };
  if (tickerArg) {
    where.ticker = tickerArg;
  } else if (!forceAll) {
    where.etfData = { etfClass: null };
  }

  const companies = await prisma.company.findMany({
    where,
    select: {
      ticker: true,
      name: true,
      etfData: {
        select: {
          category: true,
          benchmarkIndex: true,
          etfClass: true,
          holdings: {
            orderBy: { weight: 'desc' },
            take: 3,
            select: { ticker: true, name: true },
          },
        },
      },
    },
    orderBy: { ticker: 'asc' },
  });

  if (companies.length === 0) {
    console.log('✅ Nenhum ETF para classificar.');
    return;
  }

  console.log(`\n📋 ${companies.length} ETFs para classificar...\n`);

  const BATCH_SIZE = 20;
  let classified = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const etfsForClassification: EtfForClassification[] = batch.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      category: c.etfData?.category ?? null,
      benchmarkIndex: c.etfData?.benchmarkIndex ?? null,
      etfClass: c.etfData?.etfClass ?? null,
      topHoldings: (c.etfData?.holdings ?? []).map(
        (h) => (h.ticker ? `${h.ticker} (${h.name})` : h.name)
      ),
    }));

    console.log(`📦 Lote ${batchNum}: ${batch.map((c) => c.ticker).join(', ')}`);

    const classMap = await classifyBatch(ai, etfsForClassification);

    for (const company of batch) {
      const etfClass = classMap.get(company.ticker);
      if (!etfClass) {
        console.error(`  ❌ ${company.ticker}: sem classe`);
        failed++;
        continue;
      }

      await prisma.etfData.updateMany({
        where: { company: { ticker: company.ticker } },
        data: { etfClass },
      });

      console.log(`  ✅ ${company.ticker}: ${etfClass}`);
      classified++;
    }

    if (i + BATCH_SIZE < companies.length) await delay(600);
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Classificados: ${classified}`);
  console.log(`   ❌ Falhas:        ${failed}`);

  // Resumo por classe
  const summary = await prisma.etfData.groupBy({
    by: ['etfClass'],
    _count: { etfClass: true },
    orderBy: { _count: { etfClass: 'desc' } },
  });

  console.log(`\n📈 Distribuição por classe:`);
  for (const row of summary) {
    const cls = row.etfClass ?? '(sem classe)';
    console.log(`   ${cls.padEnd(22)} ${row._count?.etfClass ?? 0}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
