import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';
import {
  StrategyFactory,
  ScreeningParams,
  CompanyData,
  toNumber,
  RankBuilderResult,
  dividendHistoryStart,
  toDividendHistory,
  type HistoricalFinancialData,
} from '@/lib/strategies';
import { TechnicalIndicators, type PriceData } from '@/lib/technical-indicators';
import { getAverageDailyTradedValue } from '@/lib/finance/liquidity';
import { LIQUIDITY_DEFAULTS, isIlliquid, toLiquidityAssetType } from '@/lib/finance/liquidity-rules';
import { applyLiquidityRules } from '@/lib/ranking-models';
import { formatBRLCompact } from '@/lib/format';

/** Campos de cada ano de `FinancialData` levados para `historicalFinancials` (inclui o payout e o lucro, usados nas médias e em "lucros consistentes"). */
const HISTORICAL_FINANCIAL_FIELDS = [
  'roe',
  'roic',
  'pl',
  'pvp',
  'dy',
  'payout',
  'margemLiquida',
  'margemEbitda',
  'margemBruta',
  'liquidezCorrente',
  'liquidezRapida',
  'dividaLiquidaPl',
  'dividaLiquidaEbitda',
  'lpa',
  'vpa',
  'marketCap',
  'earningsYield',
  'evEbitda',
  'roa',
  'passivoAtivos',
  'lucroLiquido',
  'receitaTotal',
  'ebitda',
  'fluxoCaixaOperacional',
] as const;

/**
 * Um ano de `FinancialData` no formato de `historicalFinancials`, com valores numéricos. É o único mapeamento usado
 * pelo ranking (`getCompaniesData`) e pela página do ativo (`executeCompanyAnalysis`), para as médias de 7 anos
 * serem as mesmas nos dois lugares.
 */
export function toHistoricalFinancial(data: Record<string, unknown> & { year: number }): HistoricalFinancialData {
  const row: HistoricalFinancialData = { year: data.year };
  for (const field of HISTORICAL_FINANCIAL_FIELDS) row[field] = toNumber(data[field]);
  return row;
}

interface MonthlyPrice {
  date: Date | string;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  volume: unknown;
}

function technicalAnalysisFrom(prices: MonthlyPrice[], ticker: string): CompanyData['technicalAnalysis'] {
  const valid = prices.filter(
    (data) => Number(data.high) > 0 && Number(data.low) > 0 && Number(data.close) > 0 && Number(data.open) > 0
  );
  if (valid.length < 20) return undefined;
  const priceData: PriceData[] = valid.map((data) => ({
    date: new Date(data.date),
    open: Number(data.open),
    high: Number(data.high),
    low: Number(data.low),
    close: Number(data.close),
    volume: Number(data.volume),
  }));
  try {
    const result = TechnicalIndicators.calculateTechnicalAnalysis(priceData);
    if (!result.currentRSI || !result.currentStochastic) return undefined;
    return {
      rsi: result.currentRSI.rsi,
      stochasticK: result.currentStochastic.k,
      stochasticD: result.currentStochastic.d,
      overallSignal: result.overallSignal,
    };
  } catch (error) {
    console.warn(`Erro ao calcular indicadores técnicos para ${ticker}:`, error);
    return undefined;
  }
}

/**
 * Ações e BDRs com dados para os rankings: até 8 anos de `FinancialData` (atual + 7), cotação, proventos dos últimos
 * 6 anos completos, preços mensais (análise técnica), demonstrações (Overall Score) e o volume financeiro médio diário.
 */
export async function getCompaniesData(assetTypeFilter?: 'b3' | 'bdr' | 'both'): Promise<CompanyData[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4; // Últimos 5 anos para demonstrações
  const dividendsSince = dividendHistoryStart();
  const assetTypes: ('STOCK' | 'BDR')[] =
    assetTypeFilter === 'b3' ? ['STOCK'] : assetTypeFilter === 'bdr' ? ['BDR'] : ['STOCK', 'BDR'];

  const companies = await safeQueryWithParams(
    'all-companies-data',
    () =>
      prisma.company.findMany({
        include: {
          financialData: { orderBy: { year: 'desc' }, take: 8 },
          dailyQuotes: { orderBy: { date: 'desc' }, take: 1 },
          dividendHistory: {
            where: { exDate: { gte: dividendsSince } },
            orderBy: { exDate: 'desc' },
            select: { exDate: true, paymentDate: true, amount: true, type: true },
          },
          historicalPrices: {
            where: { interval: '1mo', date: { gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) } },
            orderBy: { date: 'asc' },
            select: { date: true, open: true, high: true, low: true, close: true, volume: true },
          },
          incomeStatements: {
            where: { period: 'YEARLY', endDate: { gte: new Date(`${startYear}-01-01`) } },
            orderBy: { endDate: 'desc' },
            take: 7,
          },
          balanceSheets: {
            where: { period: 'YEARLY', endDate: { gte: new Date(`${startYear}-01-01`) } },
            orderBy: { endDate: 'desc' },
            take: 7,
          },
          cashflowStatements: {
            where: { period: 'YEARLY', endDate: { gte: new Date(`${startYear}-01-01`) } },
            orderBy: { endDate: 'desc' },
            take: 7,
          },
          snapshots: { select: { overallScore: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
        },
        where: {
          assetType: { in: assetTypes },
          financialData: { some: { lpa: { not: null }, vpa: { not: null } } },
          dailyQuotes: { some: {} },
        },
      }),
    { type: 'all-companies', startYear, currentYear, assetTypeFilter, dividendsSince: dividendsSince.toISOString() }
  );

  const liquidity = await getAverageDailyTradedValue(companies.map((company) => company.id));

  return companies.map((company) => {
    // Último provento: o da empresa, ou o mais recente do histórico.
    let ultimoDividendo: unknown = company.ultimoDividendo;
    let dataUltimoDividendo: unknown = company.dataUltimoDividendo;
    if (!ultimoDividendo && company.dividendHistory.length > 0) {
      ultimoDividendo = Number(company.dividendHistory[0].amount);
      dataUltimoDividendo = company.dividendHistory[0].exDate;
    }

    const historicalFinancials = company.financialData
      .slice(1)
      .map((data) => toHistoricalFinancial(data as unknown as Record<string, unknown> & { year: number }));

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      assetType: company.assetType,
      currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
      logoUrl: company.logoUrl,
      financials: {
        ...(company.financialData[0] || {}),
        ...(ultimoDividendo !== undefined && ultimoDividendo !== null && { ultimoDividendo }),
        ...(dataUltimoDividendo !== undefined && dataUltimoDividendo !== null && { dataUltimoDividendo }),
      },
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined,
      technicalAnalysis: technicalAnalysisFrom(company.historicalPrices, company.ticker),
      dividendHistory: toDividendHistory(company.dividendHistory),
      averageDailyTradedValue: liquidity.get(company.id)?.value ?? null,
      incomeStatements: company.incomeStatements?.length > 0 ? company.incomeStatements : undefined,
      balanceSheets: company.balanceSheets?.length > 0 ? company.balanceSheets : undefined,
      cashflowStatements: company.cashflowStatements?.length > 0 ? company.cashflowStatements : undefined,
      overallScore: company.snapshots && company.snapshots.length > 0 ? toNumber(company.snapshots[0].overallScore) : null,
    };
  });
}

/** FIIs para os rankings (fiiData + cotação + rendimentos recentes). Liquidez = `FiiData.liquidez` (R$/dia). */
export async function getCompaniesDataFii(): Promise<CompanyData[]> {
  const companies = await safeQueryWithParams(
    'all-fii-companies-data',
    () =>
      prisma.company.findMany({
        where: { assetType: 'FII', fiiData: { isNot: null } },
        include: {
          fiiData: true,
          dailyQuotes: { orderBy: { date: 'desc' }, take: 1 },
          dividendHistory: { orderBy: { exDate: 'desc' }, take: 12 },
        },
      }),
    { type: 'fii-companies' }
  );

  return companies.map((company) => {
    const fd = company.fiiData!;
    const quotePx = toNumber(company.dailyQuotes[0]?.price);
    const cot = toNumber(fd.cotacao);
    const currentPrice = quotePx && quotePx > 0 ? quotePx : cot || 0;
    const lastDivFromFii = toNumber(fd.lastDividendValue);
    const liquidez = toNumber(fd.liquidez);

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      assetType: 'FII',
      currentPrice,
      logoUrl: company.logoUrl,
      /** Alinha com a página do FII (`fiiData.lastDividendValue`), evitando usar só o 1º pagamento do histórico (mensal). */
      ...(lastDivFromFii !== null && lastDivFromFii > 0 ? { ultimoDividendo: lastDivFromFii } : {}),
      dividendHistory: toDividendHistory(company.dividendHistory),
      averageDailyTradedValue: liquidez !== null && Number.isFinite(liquidez) && liquidez > 0 ? liquidez : null,
      financials: {
        dy: fd.dividendYield,
        pvp: fd.pvp,
        vpa: fd.valorPatrimonial,
        marketCap: fd.valorMercado,
        fiiLiquidez: fd.liquidez,
        fiiQtdImoveis: fd.qtdImoveis,
        fiiVacanciaMedia: fd.vacanciaMedia,
        fiiCapRate: fd.capRate,
        fiiFfoYield: fd.ffoYield,
        fiiSegment: fd.segment,
        fiiIsPapel: fd.isPapel,
        fiiCotacao: fd.cotacao,
        precoM2: fd.precoM2,
        aluguelM2: fd.aluguelM2,
        patrimonioLiquido: fd.patrimonioLiquido,
        ...(lastDivFromFii !== null && lastDivFromFii > 0 ? { fiiLastDividendValue: fd.lastDividendValue } : {}),
        // Data da última atualização dos dados do FII: o pilar "Segmento e resiliência" usa, como na página do FII.
        fiiLastFetchedAt: fd.lastFetchedAt,
      },
    };
  });
}

/**
 * Executa screening de ações/BDRs com os parâmetros fornecidos, aplicando o filtro de liquidez padrão.
 */
export async function executeScreening(parameters: ScreeningParams): Promise<RankBuilderResult[]> {
  try {
    const assetTypeFilter = parameters.assetTypeFilter === 'fii' ? undefined : parameters.assetTypeFilter;
    const companies = applyLiquidityRules(await getCompaniesData(assetTypeFilter), parameters.minLiquidity);
    return StrategyFactory.runScreeningRanking(companies, {
      ...parameters,
      limit: 20, // Limitar a 20 resultados para não sobrecarregar a IA
    });
  } catch (error) {
    console.error('Erro ao executar screening:', error);
    return [];
  }
}

export interface LiquidityFlag {
  /** Volume financeiro médio diário (R$/dia), ou `null` sem dado. */
  value: number | null;
  /** Pregões usados na média (0 quando veio de outra fonte). */
  days: number;
  /** Abaixo do limite do tipo de ativo (sem dado conta como abaixo). */
  isLow: boolean;
  /** Texto da ajuda do badge "Baixa liquidez". */
  hint: string;
}

/**
 * Liquidez de um ativo para o badge "Baixa liquidez" das páginas de ativo. FIIs usam `FiiData.liquidez` quando
 * informada (a mesma fonte do ranking); os demais, a média dos últimos pregões de `HistoricalPrice`.
 */
export async function getLiquidityFlag(
  companyId: number,
  assetType: string | null | undefined,
  fiiLiquidez?: number | null
): Promise<LiquidityFlag> {
  const type = toLiquidityAssetType(assetType);
  let value: number | null = null;
  let days = 0;
  if (type === 'fii' && typeof fiiLiquidez === 'number' && Number.isFinite(fiiLiquidez) && fiiLiquidez > 0) {
    value = fiiLiquidez;
  } else {
    const data = (await getAverageDailyTradedValue([companyId])).get(companyId);
    value = data?.value ?? null;
    days = data?.days ?? 0;
  }
  const threshold = LIQUIDITY_DEFAULTS[type];
  const period = days > 0 ? ` nos últimos ${days} pregões` : '';
  const hint =
    value === null
      ? `Sem dado de volume negociado recente. Ativos abaixo de ${formatBRLCompact(threshold)} por dia ficam fora dos rankings padrão.`
      : `Volume médio diário de ${formatBRLCompact(value)}${period}. Abaixo de ${formatBRLCompact(threshold)} por dia, negociar o ativo pode mover o preço.`;
  return { value, days, isLow: isIlliquid(value, type), hint };
}
