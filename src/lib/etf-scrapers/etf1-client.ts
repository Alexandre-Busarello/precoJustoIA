/**
 * Cliente para a API pública do etf1.com.br.
 * Sem Playwright — apenas fetch() nativo. Roda na Vercel (60s timeout).
 *
 * Um único endpoint retorna detalhes + holdings + retornos.
 * Descoberto em 2026-05-22 via scripts/discover-etf1-api.ts.
 */
import { PrismaClient, AssetType } from '@prisma/client';
import {
  buildEtfUrl,
  ETF1_HEADERS,
  Etf1Response,
  parsePct,
  parseExpenseRatio,
  parseAum,
} from './etf1-endpoints';

const CONCURRENCY = 10;
const TIMEOUT_MS = 8000;

export interface EtfDetailsData {
  benchmarkIndex?: string | null;
  category?: string | null;
  netExpenseRatio?: number | null;
  netAssets?: number | null;
  return1m?: number | null;
  return3m?: number | null;
  return6m?: number | null;
  return1y?: number | null;
  return3y?: number | null;
  return5y?: number | null;
  returnSinceInception?: number | null;
  volatility12m?: number | null;
}

export interface HoldingData {
  ticker: string | null;
  name: string;
  weight: number; // 0–1 (ex: 0.1223 = 12.23%)
}

export interface Phase2EtfResult {
  ticker: string;
  details: EtfDetailsData | null;
  holdings: HoldingData[];
  error?: string;
}

export interface Phase2Result {
  processed: number;
  failed: number;
  durationMs: number;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers: ETF1_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function findReturn(returns: Etf1Response['returns'], periodLabel: string): number | null {
  const entry = returns?.find((r) => r.period === periodLabel);
  return entry ? parsePct(entry.return_pct) : null;
}

function findVolatility(returns: Etf1Response['returns'], periodLabel: string): number | null {
  const entry = returns?.find((r) => r.period === periodLabel);
  if (!entry?.volatility) return null;
  return parsePct(entry.volatility);
}

async function fetchEtfData(ticker: string): Promise<{ details: EtfDetailsData | null; holdings: HoldingData[] }> {
  try {
    const res = await fetchWithTimeout(buildEtfUrl(ticker));
    if (!res.ok) return { details: null, holdings: [] };
    const data = (await res.json()) as Etf1Response;

    const chars = data.characteristics;
    const ident = data.identification;
    const returns = data.returns ?? [];

    const details: EtfDetailsData = {
      benchmarkIndex: chars?.index_name ?? data.index_class?.nome ?? null,
      category: ident?.category ?? ident?.asset_class ?? null,
      netExpenseRatio: parseExpenseRatio(chars?.expense_ratio),
      netAssets: parseAum(chars?.aum),
      return1m: findReturn(returns, '1m'),
      return3m: findReturn(returns, '3m'),
      return6m: findReturn(returns, '6m'),
      return1y: findReturn(returns, '1a'),
      return3y: findReturn(returns, '3a'),
      return5y: findReturn(returns, '5a'),
      returnSinceInception: findReturn(returns, 'Max'),
      volatility12m: findVolatility(returns, '1a'),
    };

    const holdings: HoldingData[] = (data.holdings ?? []).map((h) => ({
      ticker: h.ticker?.replace(/\.SA$/i, '') ?? null,
      name: h.name,
      weight: h.portfolio_percent / 100, // converte % → decimal
    }));

    return { details, holdings };
  } catch {
    return { details: null, holdings: [] };
  }
}

async function processEtf(ticker: string): Promise<Phase2EtfResult> {
  try {
    const { details, holdings } = await fetchEtfData(ticker);
    return { ticker, details, holdings };
  } catch (err) {
    return {
      ticker,
      details: null,
      holdings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getStartOfWeekBRT(): Date {
  const now = new Date();
  const brtOffset = -3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() + brtOffset);
  const day = brtNow.getUTCDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(brtNow);
  monday.setUTCDate(brtNow.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return new Date(monday.getTime() - brtOffset);
}

export async function runPhase2(
  prisma: PrismaClient,
  options: { force?: boolean; maxItems?: number; tickers?: string[] } = {}
): Promise<Phase2Result> {
  const startMs = Date.now();
  const weekStart = getStartOfWeekBRT();

  const etfCompanies = await prisma.company.findMany({
    where: {
      assetType: AssetType.ETF,
      isActive: true,
      ...(options.tickers ? { ticker: { in: options.tickers } } : {}),
      etfData: options.force || options.tickers
        ? undefined
        : {
            OR: [
              { lastScrapedAt: null },
              { lastScrapedAt: { lt: weekStart } },
            ],
          },
    },
    select: { ticker: true, etfData: { select: { id: true, companyId: true } } },
    ...(options.maxItems ? { take: options.maxItems } : {}),
  });

  console.log(`📋 Fase 2: ${etfCompanies.length} ETFs para processar${options.force ? ' (force=true)' : ''}`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < etfCompanies.length; i += CONCURRENCY) {
    const batch = etfCompanies.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map((c) => processEtf(c.ticker))
    );

    for (let j = 0; j < results.length; j++) {
      const company = batch[j];
      const result = results[j];

      if (result.status === 'rejected' || result.value.error) {
        const msg = result.status === 'rejected' ? result.reason : result.value.error;
        console.error(`❌ ${company.ticker}: ${msg}`);
        failed++;
        continue;
      }

      const { details, holdings } = result.value;

      if (!details && holdings.length === 0) {
        console.warn(`⚠️  ${company.ticker}: sem dados no etf1.com.br, pulando`);
        failed++;
        continue;
      }

      try {
        await saveEtfPhase2Data(prisma, company.ticker, details, holdings);
        processed++;
      } catch (err) {
        console.error(`❌ ${company.ticker} (save): ${err instanceof Error ? err.message : err}`);
        failed++;
      }
    }

    console.log(`✅ Lote ${Math.floor(i / CONCURRENCY) + 1}: ${processed} ok, ${failed} falhas`);
  }

  return { processed, failed, durationMs: Date.now() - startMs };
}

async function saveEtfPhase2Data(
  prisma: PrismaClient,
  ticker: string,
  details: EtfDetailsData | null,
  holdings: HoldingData[]
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { ticker },
    select: { id: true, etfData: true },
  });

  if (!company) return;

  const existing = company.etfData;

  // Persistência seletiva: só atualiza campos com valor não-nulo
  const detailsUpdate: Record<string, unknown> = {};
  if (details) {
    const fields: (keyof EtfDetailsData)[] = [
      'benchmarkIndex', 'category', 'netExpenseRatio', 'netAssets',
      'return1m', 'return3m', 'return6m', 'return1y',
      'return3y', 'return5y', 'returnSinceInception', 'volatility12m',
    ];
    for (const field of fields) {
      const val = details[field];
      if (val !== null && val !== undefined) {
        detailsUpdate[field] = val;
      }
    }
  }

  const resolvedHoldings = await resolveHoldingCompanyIds(prisma, holdings);

  const sortedWeights = resolvedHoldings.map((h) => h.weight).sort((a, b) => b - a);
  // Cap at 1.0: alguns ETFs Quanto/hedge têm holdings > 100% porque incluem colateral de swaps cambiais
  const top5Concentration = Math.min(1.0, sortedWeights.slice(0, 5).reduce((s, w) => s + w, 0));

  await prisma.$transaction(async (tx) => {
    const updatedData = await tx.etfData.upsert({
      where: { companyId: company.id },
      update: {
        ...detailsUpdate,
        lastScrapedAt: new Date(),
        holdingsUpdatedAt: holdings.length > 0 ? new Date() : existing?.holdingsUpdatedAt,
        holdingsConcentrationTop5: holdings.length > 0 ? top5Concentration : existing?.holdingsConcentrationTop5,
        dataSource: 'brapi+etf1',
      },
      create: {
        companyId: company.id,
        ...detailsUpdate,
        lastScrapedAt: new Date(),
        holdingsUpdatedAt: holdings.length > 0 ? new Date() : null,
        holdingsConcentrationTop5: holdings.length > 0 ? top5Concentration : null,
        dataSource: 'brapi+etf1',
      },
    });

    if (holdings.length > 0) {
      await tx.etfHolding.deleteMany({ where: { etfDataId: updatedData.id } });
      await tx.etfHolding.createMany({
        data: resolvedHoldings.map((h) => ({
          etfDataId: updatedData.id,
          ticker: h.ticker,
          name: h.name,
          weight: h.weight,
          companyId: h.companyId ?? null,
        })),
      });
    }
  });
}

async function resolveHoldingCompanyIds(
  prisma: PrismaClient,
  holdings: HoldingData[]
): Promise<(HoldingData & { companyId: number | null })[]> {
  const tickers = holdings.map((h) => h.ticker).filter(Boolean) as string[];
  if (tickers.length === 0) return holdings.map((h) => ({ ...h, companyId: null }));

  const companies = await prisma.company.findMany({
    where: { ticker: { in: tickers } },
    select: { id: true, ticker: true },
  });

  const companyMap = new Map(companies.map((c) => [c.ticker, c.id]));

  const unresolved = tickers.filter((t) => !companyMap.has(t));
  if (unresolved.length > 0) {
    console.log(`  📝 Holdings sem match (${unresolved.length}): ${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '...' : ''}`);
  }

  return holdings.map((h) => ({
    ...h,
    companyId: h.ticker ? (companyMap.get(h.ticker) ?? null) : null,
  }));
}
