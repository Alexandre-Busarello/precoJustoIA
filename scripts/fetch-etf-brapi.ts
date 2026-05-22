/**
 * Fase 1 do pipeline de ETFs: coleta diária via BRAPI.
 * Identifica ETFs ativos (fundos que não são FIIs), busca cotação/DY/retorno
 * e faz upsert no EtfData. Idempotente, tolerante a falhas por ticker individual.
 *
 * Uso: npx ts-node scripts/fetch-etf-brapi.ts
 * Ou via cron: GET /api/cron/fetch-etf?phase=1
 */
import * as dotenv from 'dotenv';
import { PrismaClient, AssetType } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

const BRAPI_TOKEN = process.env.BRAPI_TOKEN;
const BRAPI_BASE_URL = 'https://brapi.dev/api';
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 500;

interface BrapiListItem {
  stock: string;
  name: string;
  close: number;
  change: number;
  volume: number;
  market_cap: number | null;
  type: string;
}

interface BrapiQuoteResult {
  symbol: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  regularMarketTime?: number; // unix timestamp
  dividendYield: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
}

interface BrapiQuoteResponse {
  results: BrapiQuoteResult[];
}

export interface Phase1Result {
  processed: number;
  failed: number;
  newEtfs: number;
  durationMs: number;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBackoff(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: BRAPI_TOKEN ? { Authorization: `Bearer ${BRAPI_TOKEN}` } : {},
    });

    if (res.status === 429) {
      const waitMs = Math.pow(2, attempt) * 2000;
      console.log(`⏳ Rate limit BRAPI, aguardando ${waitMs}ms (tentativa ${attempt + 1}/${retries})`);
      await delay(waitMs);
      continue;
    }

    return res;
  }
  throw new Error(`BRAPI rate limit após ${retries} tentativas`);
}

async function listAllFunds(): Promise<BrapiListItem[]> {
  const all: BrapiListItem[] = [];
  let page = 1;

  while (true) {
    const url = `${BRAPI_BASE_URL}/quote/list?type=fund&limit=100&page=${page}${BRAPI_TOKEN ? `&token=${BRAPI_TOKEN}` : ''}`;
    const res = await fetchWithBackoff(url);

    if (!res.ok) break;

    const data = (await res.json()) as { stocks?: BrapiListItem[] };
    const items = data.stocks ?? [];
    if (items.length === 0) break;

    all.push(...items);
    if (items.length < 100) break;
    page++;
  }

  return all;
}

// Tipos que o BRAPI retorna para fundos que NÃO são ETFs
const NON_ETF_TYPES = new Set(['fii', 'fidc', 'fip', 'fundo imobiliario', 'fundo imobiliário']);

function isBrapiTypeEtf(item: BrapiListItem): boolean {
  if (!item.type) return true; // sem tipo → mantém como candidato (conservador)
  const t = item.type.toLowerCase();
  if (NON_ETF_TYPES.has(t)) return false;
  if (t.includes('fii') || t.includes('imobiliário') || t.includes('imobiliario')) return false;
  return true;
}

async function identifyEtfTickers(funds: BrapiListItem[]): Promise<string[]> {
  // Camada 1: padrão de ticker *11 e filtro pelo campo type do BRAPI
  const candidateTickers = funds
    .filter((f) => /^[A-Z0-9]{4,6}11$/.test(f.stock) && isBrapiTypeEtf(f))
    .map((f) => f.stock);

  // Camada 2: exclui tickers cadastrados como FII no banco
  const nonEtfs = await prisma.company.findMany({
    where: {
      ticker: { in: candidateTickers },
      OR: [
        { assetType: AssetType.FII },
        // Camada 3: exclui ETFs que foram intencionalmente desativados (falsos positivos)
        { assetType: AssetType.ETF, isActive: false },
      ],
    },
    select: { ticker: true },
  });

  const excludeSet = new Set(nonEtfs.map((c) => c.ticker));
  return candidateTickers.filter((t) => !excludeSet.has(t));
}

async function registerNewEtf(ticker: string, name: string): Promise<number> {
  // Não reativa companies desativadas (falsos positivos previamente marcados)
  const existing = await prisma.company.findUnique({ where: { ticker }, select: { id: true, isActive: true } });
  if (existing && !existing.isActive) {
    console.log(`⏭️  ${ticker}: registro ignorado (desativado intencionalmente)`);
    return existing.id;
  }

  const company = await prisma.company.upsert({
    where: { ticker },
    update: { assetType: AssetType.ETF, isActive: true },
    create: { ticker, name, assetType: AssetType.ETF, isActive: true },
  });

  await prisma.etfData.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id },
  });

  console.log(`🆕 Novo ETF registrado: ${ticker}`);
  return company.id;
}

async function fetchAndSaveEtf(ticker: string): Promise<boolean> {
  try {
    const url = `${BRAPI_BASE_URL}/quote/${ticker}?${BRAPI_TOKEN ? `token=${BRAPI_TOKEN}&` : ''}fundamental=true`;
    const res = await fetchWithBackoff(url);

    if (!res.ok) {
      console.warn(`⚠️  ${ticker}: HTTP ${res.status}`);
      return false;
    }

    const data = (await res.json()) as BrapiQuoteResponse;
    const quote = data.results?.[0];

    if (!quote || !quote.regularMarketPrice) {
      console.warn(`⚠️  ${ticker}: sem dados de cotação`);
      return false;
    }

    // Garante que a empresa existe no banco como ETF
    // Nunca reativa uma company intencionalmente desativada (isActive: false)
    const existingCompany = await prisma.company.findUnique({ where: { ticker }, select: { id: true, isActive: true } });
    if (existingCompany && !existingCompany.isActive) {
      console.log(`⏭️  ${ticker}: pulado (desativado intencionalmente)`);
      return false;
    }

    const company = await prisma.company.upsert({
      where: { ticker },
      update: { assetType: AssetType.ETF, isActive: true },
      create: { ticker, name: quote.longName ?? ticker, assetType: AssetType.ETF, isActive: true },
    });

    // Busca dados atuais para não sobrescrever campos não-nulos com null
    const existing = await prisma.etfData.findUnique({ where: { companyId: company.id } });

    const updateData: Record<string, unknown> = {};
    if (quote.regularMarketPrice) updateData.totalAssets = existing?.totalAssets; // keep existing

    // Persistência seletiva: só atualiza campos com valor não-nulo da BRAPI
    const ytdReturn = quote.dividendYield !== undefined ? quote.dividendYield : null;
    const netAssets = quote.marketCap ?? null;

    await prisma.etfData.upsert({
      where: { companyId: company.id },
      update: {
        dividendYield: ytdReturn !== null ? ytdReturn : existing?.dividendYield,
        ytdReturn: existing?.ytdReturn, // BRAPI não retorna YTD explicitamente para ETFs
        netAssets: netAssets !== null ? netAssets : existing?.netAssets,
        totalAssets: netAssets !== null ? netAssets : existing?.totalAssets,
        dataSource: existing?.dataSource?.includes('etf1') ? 'brapi+etf1' : 'brapi-only',
      },
      create: {
        companyId: company.id,
        dividendYield: ytdReturn,
        netAssets: netAssets,
        totalAssets: netAssets,
        dataSource: 'brapi-only',
      },
    });

    // Salva preço do dia em dailyQuote (usado pela página do ETF)
    const price = quote.regularMarketPrice;
    const now = new Date();
    const quoteDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    try {
      await prisma.dailyQuote.upsert({
        where: { companyId_date: { companyId: company.id, date: quoteDate } },
        update: { price },
        create: { companyId: company.id, date: quoteDate, price },
      });
    } catch (priceErr) {
      console.warn(`⚠️  ${ticker}: erro ao salvar dailyQuote — ${priceErr instanceof Error ? priceErr.message : priceErr}`);
    }

    // Salva cotação diária com volume — alimenta o score de liquidez
    const volume = quote.regularMarketVolume ?? 0;
    if (volume > 0) {
      try {
        await prisma.historicalPrice.upsert({
          where: { companyId_date_interval: { companyId: company.id, date: quoteDate, interval: '1d' } },
          update: {
            open: quote.regularMarketOpen ?? price,
            high: quote.regularMarketDayHigh ?? price,
            low: quote.regularMarketDayLow ?? price,
            close: price,
            adjustedClose: price,
            volume,
          },
          create: {
            companyId: company.id,
            date: quoteDate,
            interval: '1d',
            open: quote.regularMarketOpen ?? price,
            high: quote.regularMarketDayHigh ?? price,
            low: quote.regularMarketDayLow ?? price,
            close: price,
            adjustedClose: price,
            volume,
          },
        });
      } catch (priceErr) {
        console.warn(`⚠️  ${ticker}: erro ao salvar preço histórico — ${priceErr instanceof Error ? priceErr.message : priceErr}`);
      }
    }

    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${ticker}: ${msg}`);
    return false;
  }
}

export async function runPhase1(): Promise<Phase1Result> {
  const startMs = Date.now();
  console.log('🚀 Iniciando fase 1 ETF (BRAPI)...');

  let processed = 0;
  let failed = 0;
  let newEtfs = 0;

  const funds = await listAllFunds();
  console.log(`📋 ${funds.length} fundos listados pela BRAPI`);

  const etfTickers = await identifyEtfTickers(funds);
  console.log(`📊 ${etfTickers.length} ETFs identificados (excluindo FIIs)`);

  // Verifica quais são novos
  const existingCompanies = await prisma.company.findMany({
    where: { ticker: { in: etfTickers } },
    select: { ticker: true },
  });
  const existingSet = new Set(existingCompanies.map((c) => c.ticker));

  for (const ticker of etfTickers) {
    if (!existingSet.has(ticker)) {
      const fund = funds.find((f) => f.stock === ticker);
      await registerNewEtf(ticker, fund?.name ?? ticker);
      newEtfs++;
    }
  }

  // Processa em lotes com concorrência controlada
  for (let i = 0; i < etfTickers.length; i += BATCH_SIZE) {
    const batch = etfTickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((t) => fetchAndSaveEtf(t)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        processed++;
      } else {
        failed++;
      }
    }

    console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${processed} ok, ${failed} falhas`);

    if (i + BATCH_SIZE < etfTickers.length) {
      await delay(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  const durationMs = Date.now() - startMs;
  console.log(`\n📊 Fase 1 concluída: ${processed} processados, ${failed} falhas, ${newEtfs} novos ETFs (${durationMs}ms)`);

  return { processed, failed, newEtfs, durationMs };
}

// Execução direta
if (process.argv[1]?.endsWith('fetch-etf-brapi.ts')) {
  runPhase1()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
