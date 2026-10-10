import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { 
  StrategyFactory,
  StrategyAnalysis,
  toNumber
} from '@/lib/strategies';
import { calculateOverallScore, OverallScore, OverallScoreWithBreakdown, FinancialData, FinancialStatementsData } from '@/lib/strategies/overall-score';
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config';
import { BAZIN_DEFAULTS, dividendHistoryStart, toDividendHistory } from '@/lib/strategies/bazin-strategy';
import { LYNCH_DEFAULTS } from '@/lib/strategies/lynch-strategy';
import { fairValueModelParams, universeForAssetType } from '@/lib/ranking-models';
import { toHistoricalFinancial } from '@/lib/rank-builder-service';
import { BANK_PVP_DEFAULTS } from '@/lib/strategies/bank-pvp-strategy';
import type { CompanyData, HistoricalFinancialData } from '@/lib/strategies/types';
import { getValuationModel } from '@/components/asset/valuation-models';
import { isBDRTickerSymbol } from '@/lib/strategies/base-strategy';
import { isFinancial } from '@/lib/finance/sector-classification';
import { warmMacroAssumptions } from '@/lib/finance/macro';

// Interface para dados da empresa
export interface CompanyAnalysisData {
  ticker: string;
  name: string;
  sector: string | null;
  industry?: string | null;
  currentPrice: number;
  financials: Record<string, unknown>;
  /** Proventos por ação; quando ausente, `executeCompanyAnalysis` carrega os últimos 6 anos completos. */
  dividendHistory?: CompanyData['dividendHistory'];
  /** Prisma `AssetType` ('STOCK', 'BDR'…); quando ausente e há `companyId`, vem do banco. */
  assetType?: string;
  /** Anos anteriores de `FinancialData`; com `companyId`, é sempre montado do banco como no ranking. */
  historicalFinancials?: HistoricalFinancialData[];
  /** Demonstrações anuais (DRE, balanço, DFC) usadas pelo FCD; com `companyId`, vêm do banco como no ranking. */
  incomeStatements?: Record<string, unknown>[];
  balanceSheets?: Record<string, unknown>[];
  cashflowStatements?: Record<string, unknown>[];
}

// Interface para resultado da análise
export interface CompanyAnalysisResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | OverallScoreWithBreakdown | null; // Pode incluir breakdown se solicitado
  strategies: AnalysisStrategies;
}

export interface AnalysisStrategies {
  graham: StrategyAnalysis | null;
  dividendYield: StrategyAnalysis | null;
  lowPE: StrategyAnalysis | null;
  magicFormula: StrategyAnalysis | null;
  fcd: StrategyAnalysis | null;
  gordon: StrategyAnalysis | null;
  fundamentalist: StrategyAnalysis | null;
  barsi: StrategyAnalysis | null;
  bazin: StrategyAnalysis | null;
  lynch: StrategyAnalysis | null;
  /** P/VP justo: só para bancos, seguradoras e demais financeiras. */
  bankPvp: StrategyAnalysis | null;
}

/** Anos de `FinancialData` lidos por empresa (atual + 7), como em `getCompaniesData` dos rankings. */
const FINANCIAL_HISTORY_YEARS = 8;

interface CompanyHistoryRow {
  assetType: string | null;
  ultimoDividendo: unknown;
  dataUltimoDividendo: unknown;
  financialData: Array<Record<string, unknown> & { year: number }>;
  incomeStatements: Record<string, unknown>[];
  balanceSheets: Record<string, unknown>[];
  cashflowStatements: Record<string, unknown>[];
}

type DividendRow = Parameters<typeof toDividendHistory>[0][number];

/** Demonstrações anuais dos últimos 5 anos, como em `getCompaniesData` (o FCD usa a DRE e a DFC mais recentes). */
function yearlyStatementsQuery() {
  const startYear = new Date().getFullYear() - 4;
  return {
    where: { period: 'YEARLY' as const, endDate: { gte: new Date(`${startYear}-01-01`) } },
    orderBy: { endDate: 'desc' as const },
    take: 7,
  };
}

function companyHistorySelect() {
  const statements = yearlyStatementsQuery();
  return {
    assetType: true,
    ultimoDividendo: true,
    dataUltimoDividendo: true,
    financialData: { orderBy: { year: 'desc' as const }, take: FINANCIAL_HISTORY_YEARS },
    incomeStatements: statements,
    balanceSheets: statements,
    cashflowStatements: statements,
  };
}

/**
 * Aplica à análise os mesmos insumos que o ranking monta em `getCompaniesData` (rank-builder-service): histórico de
 * `FinancialData` com os mesmos campos (`toHistoricalFinancial`, incluindo payout e lucro de cada ano), demonstrações
 * anuais, tipo do ativo, último provento e proventos dos últimos 6 anos completos. Assim, Graham, FCD, Gordon, Bazin, Barsi e Lynch chegam ao
 * mesmo preço justo na página do ativo e no ranking. Proventos e demonstrações já trazidos pelo chamador são respeitados.
 */
function withRankingInputs(
  companyData: CompanyAnalysisData,
  company: CompanyHistoryRow | null,
  dividendRows: readonly DividendRow[] | null
): CompanyAnalysisData {
  const dividendHistory =
    companyData.dividendHistory ?? (dividendRows ? toDividendHistory(dividendRows) : undefined);
  if (!company) return dividendHistory ? { ...companyData, dividendHistory } : companyData;

  const currentYear = toNumber(companyData.financials.year) ?? company.financialData[0]?.year;
  const historicalFinancials = company.financialData
    .filter((row) => row.year !== currentYear)
    .slice(0, FINANCIAL_HISTORY_YEARS - 1)
    .map(toHistoricalFinancial);

  // Último provento: o da empresa, ou o mais recente do histórico (mesma regra do ranking).
  let ultimoDividendo: unknown = company.ultimoDividendo;
  let dataUltimoDividendo: unknown = company.dataUltimoDividendo;
  if (!ultimoDividendo && dividendHistory && dividendHistory.length > 0) {
    ultimoDividendo = toNumber(dividendHistory[0].amount);
    dataUltimoDividendo = dividendHistory[0].exDate;
  }

  const statements = (rows: Record<string, unknown>[]) => (rows.length > 0 ? rows : undefined);
  return {
    ...companyData,
    assetType: companyData.assetType ?? company.assetType ?? undefined,
    incomeStatements: companyData.incomeStatements ?? statements(company.incomeStatements),
    balanceSheets: companyData.balanceSheets ?? statements(company.balanceSheets),
    cashflowStatements: companyData.cashflowStatements ?? statements(company.cashflowStatements),
    financials: {
      ...companyData.financials,
      ...(ultimoDividendo !== undefined && ultimoDividendo !== null && { ultimoDividendo }),
      ...(dataUltimoDividendo !== undefined && dataUltimoDividendo !== null && { dataUltimoDividendo }),
    },
    historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : companyData.historicalFinancials,
    ...(dividendHistory && { dividendHistory }),
  };
}

/**
 * BDR: moeda dos demonstrativos, paridade e câmbio do dia em `financials` (`BDRDataService.getBdrConversionInputs`),
 * para Graham, FCD, Gordon e Bazin converterem o preço justo para reais por recibo, como no ranking. Sem paridade ou
 * câmbio, segue sem eles e os modelos explicam por que não se aplicam.
 */
async function withBdrConversionInputs(companyData: CompanyAnalysisData): Promise<CompanyAnalysisData> {
  if (companyData.assetType !== 'BDR' && !isBDRTickerSymbol(companyData.ticker)) return companyData;
  try {
    const { BDRDataService } = await import('@/lib/bdr-data-service');
    const inputs = await BDRDataService.getBdrConversionInputs(companyData.ticker);
    return inputs ? { ...companyData, financials: { ...companyData.financials, ...inputs } } : companyData;
  } catch (error) {
    console.warn(`⚠️ Paridade e câmbio indisponíveis para ${companyData.ticker}:`, error);
    return companyData;
  }
}

/** Carrega do banco os insumos do ranking para uma empresa e os aplica à análise (ver `withRankingInputs`). */
async function loadRankingInputs(companyData: CompanyAnalysisData, companyId: number): Promise<CompanyAnalysisData> {
  const since = dividendHistoryStart();
  const [company, dividendRows] = await Promise.all([
    safeQueryWithParams(
      'company-history-company-analysis',
      () => prisma.company.findUnique({ where: { id: companyId }, select: companyHistorySelect() }),
      { companyId, years: FINANCIAL_HISTORY_YEARS, statementsSince: new Date().getFullYear() - 4 }
    ),
    companyData.dividendHistory === undefined
      ? safeQueryWithParams(
          'dividend-history-company-analysis',
          () =>
            prisma.dividendHistory.findMany({
              where: { companyId, exDate: { gte: since } },
              orderBy: { exDate: 'desc' },
              select: { exDate: true, paymentDate: true, amount: true, type: true },
            }),
          { companyId, since: since.toISOString() }
        )
      : Promise.resolve(null),
  ]);
  return withRankingInputs(companyData, company as unknown as CompanyHistoryRow | null, dividendRows);
}

/**
 * Versão em lote de `loadRankingInputs`: 2 consultas para todas as empresas em vez de 2 por empresa.
 * Empresas sem proventos ficam com lista vazia (não refazem a consulta individualmente).
 */
async function prefetchRankingInputs(
  entries: ReadonlyArray<{ companyId: number; data: CompanyAnalysisData }>
): Promise<CompanyAnalysisData[]> {
  const ids = Array.from(new Set(entries.map((entry) => entry.companyId).filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return entries.map((entry) => entry.data);
  const since = dividendHistoryStart();
  const [companies, dividendRows] = await Promise.all([
    safeQueryWithParams(
      'company-history-company-analysis-batch',
      () =>
        prisma.company.findMany({
          where: { id: { in: ids } },
          select: { id: true, ...companyHistorySelect() },
        }),
      { ids: ids.join(','), years: FINANCIAL_HISTORY_YEARS, statementsSince: new Date().getFullYear() - 4 }
    ),
    safeQueryWithParams(
      'dividend-history-company-analysis-batch',
      () =>
        prisma.dividendHistory.findMany({
          where: { companyId: { in: ids }, exDate: { gte: since } },
          orderBy: { exDate: 'desc' },
          select: { companyId: true, exDate: true, paymentDate: true, amount: true, type: true },
        }),
      { ids: ids.join(','), since: since.toISOString() }
    ),
  ]);

  const companiesById = new Map(companies.map((company) => [company.id, company as unknown as CompanyHistoryRow]));
  const dividendsById = new Map<number, DividendRow[]>();
  for (const row of dividendRows) {
    const list = dividendsById.get(row.companyId) ?? [];
    list.push(row);
    dividendsById.set(row.companyId, list);
  }

  return entries.map(({ companyId, data }) =>
    withRankingInputs(data, companiesById.get(companyId) ?? null, dividendsById.get(companyId) ?? [])
  );
}

export async function getStatementsData(
  companyId: string, 
  ticker: string,
  sector?: string | null,
  industry?: string | null
): Promise<FinancialStatementsData | undefined> {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // Últimos 5 anos

    const [incomeStatements, balanceSheets, cashflowStatements, financialData] = await Promise.all([
      safeQueryWithParams(
        'income-statements-company-analysis',
        () => prisma.incomeStatement.findMany({
          where: {
            companyId: parseInt(companyId),
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7 // Últimos 5 anos para análise
        }),
        { companyId: parseInt(companyId), period: 'YEARLY', startYear }
      ),
      safeQueryWithParams(
        'balance-sheets-company-analysis',
        () => prisma.balanceSheet.findMany({
          where: {
            companyId: parseInt(companyId),
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        }),
        { companyId: parseInt(companyId), period: 'YEARLY', startYear }
      ),
      safeQueryWithParams(
        'cashflow-statements-company-analysis',
        () => prisma.cashflowStatement.findMany({
          where: {
            companyId: parseInt(companyId),
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        }),
        { companyId: parseInt(companyId), period: 'YEARLY', startYear }
      ),
      // Buscar dados financeiros calculados como fallback
      safeQueryWithParams(
        'financial-data-company-analysis',
        () => prisma.financialData.findMany({
          where: {
            companyId: parseInt(companyId),
            year: { gte: startYear }
          },
          orderBy: { year: 'desc' },
          take: 7,
          select: {
            year: true,
            roe: true,
            roa: true,
            margemLiquida: true,
            margemBruta: true,
            margemEbitda: true,
            liquidezCorrente: true,
            liquidezRapida: true,
            debtToEquity: true,
            dividaLiquidaPl: true,
            giroAtivos: true,
            cagrLucros5a: true,
            cagrReceitas5a: true,
            crescimentoLucros: true,
            crescimentoReceitas: true,
            fluxoCaixaOperacional: true,
            fluxoCaixaLivre: true,
            totalCaixa: true,
            totalDivida: true,
            ativoTotal: true,
            patrimonioLiquido: true,
            passivoCirculante: true,
            ativoCirculante: true
          }
        }),
        { companyId: parseInt(companyId), startYear }
      )
    ]) as [any[], any[], any[], any[]];

    if (incomeStatements.length === 0 && balanceSheets.length === 0 && cashflowStatements.length === 0) {
      return undefined;
    }

    // Processar dados financeiros para fallback
    let financialDataFallback = undefined;
    if (financialData.length > 0) {
      // Converter Decimal para number e organizar por indicador
      const years = financialData.map(fd => fd.year);
      
      // Função auxiliar para converter e filtrar valores válidos
      const processValues = (values: (any | null)[]): number[] => {
        return values
          .map(v => v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : v)
          .filter(v => v !== null && v !== undefined && !isNaN(v)) as number[];
      };

      financialDataFallback = {
        years,
        roe: processValues(financialData.map(fd => fd.roe)),
        roa: processValues(financialData.map(fd => fd.roa)),
        margemLiquida: processValues(financialData.map(fd => fd.margemLiquida)),
        margemBruta: processValues(financialData.map(fd => fd.margemBruta)),
        margemEbitda: processValues(financialData.map(fd => fd.margemEbitda)),
        liquidezCorrente: processValues(financialData.map(fd => fd.liquidezCorrente)),
        liquidezRapida: processValues(financialData.map(fd => fd.liquidezRapida)),
        debtToEquity: processValues(financialData.map(fd => fd.debtToEquity)),
        dividaLiquidaPl: processValues(financialData.map(fd => fd.dividaLiquidaPl)),
        giroAtivos: processValues(financialData.map(fd => fd.giroAtivos)),
        crescimentoLucros: processValues(financialData.map(fd => fd.crescimentoLucros)),
        crescimentoReceitas: processValues(financialData.map(fd => fd.crescimentoReceitas)),
        fluxoCaixaOperacional: processValues(financialData.map(fd => fd.fluxoCaixaOperacional)),
        fluxoCaixaLivre: processValues(financialData.map(fd => fd.fluxoCaixaLivre)),
        totalCaixa: processValues(financialData.map(fd => fd.totalCaixa)),
        totalDivida: processValues(financialData.map(fd => fd.totalDivida)),
        ativoTotal: processValues(financialData.map(fd => fd.ativoTotal)),
        patrimonioLiquido: processValues(financialData.map(fd => fd.patrimonioLiquido)),
        passivoCirculante: processValues(financialData.map(fd => fd.passivoCirculante)),
        ativoCirculante: processValues(financialData.map(fd => fd.ativoCirculante)),
        // CAGR são valores únicos (pegar o mais recente)
        cagrLucros5a: financialData[0]?.cagrLucros5a ? 
          (typeof financialData[0].cagrLucros5a === 'object' && 'toNumber' in financialData[0].cagrLucros5a ? 
            financialData[0].cagrLucros5a.toNumber() : financialData[0].cagrLucros5a) : null,
        cagrReceitas5a: financialData[0]?.cagrReceitas5a ? 
          (typeof financialData[0].cagrReceitas5a === 'object' && 'toNumber' in financialData[0].cagrReceitas5a ? 
            financialData[0].cagrReceitas5a.toNumber() : financialData[0].cagrReceitas5a) : null
      };
    }

    // Serializar os dados
    const statementsData: FinancialStatementsData = {
      incomeStatements: incomeStatements.map(stmt => {
        const serialized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(stmt)) {
          if (value && typeof value === 'object' && 'toNumber' in value) {
            serialized[key] = (value as { toNumber: () => number }).toNumber();
          } else if (value instanceof Date) {
            serialized[key] = value.toISOString();
          } else {
            serialized[key] = value;
          }
        }
        return serialized;
      }),
      balanceSheets: balanceSheets.map(stmt => {
        const serialized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(stmt)) {
          if (value && typeof value === 'object' && 'toNumber' in value) {
            serialized[key] = (value as { toNumber: () => number }).toNumber();
          } else if (value instanceof Date) {
            serialized[key] = value.toISOString();
          } else {
            serialized[key] = value;
          }
        }
        return serialized;
      }),
      cashflowStatements: cashflowStatements.map(stmt => {
        const serialized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(stmt)) {
          if (value && typeof value === 'object' && 'toNumber' in value) {
            serialized[key] = (value as { toNumber: () => number }).toNumber();
          } else if (value instanceof Date) {
            serialized[key] = value.toISOString();
          } else {
            serialized[key] = value;
          }
        }
        return serialized;
      }),
      company: {
        ticker: ticker,
        sector: sector,
        industry: industry,
        marketCap: null // MarketCap será obtido de outra fonte se necessário
      },
      financialDataFallback
    };

    return statementsData;
  } catch (error) {
    console.error(`Erro ao buscar demonstrações para ${ticker}:`, error);
    return undefined;
  }
}

// Função centralizada para executar análise completa de uma empresa
export async function executeCompanyAnalysis(
  companyData: CompanyAnalysisData,
  options: {
    isLoggedIn: boolean;
    isPremium: boolean;
    includeStatements?: boolean;
    companyId?: string;
    industry?: string | null;
    includeBreakdown?: boolean; // Se deve incluir breakdown detalhado
    /** Os insumos do ranking (histórico, proventos, tipo do ativo) já vieram de `prefetchRankingInputs`. */
    rankingInputsLoaded?: boolean;
  }
): Promise<CompanyAnalysisResult> {
  const { isLoggedIn, isPremium, includeStatements = true, companyId, industry } = options;

  /** Plano do modelo no registro da página de ativo: premium exige assinatura; gratuito exige conta (como Graham). */
  const canRun = (key: string): boolean => {
    const model = getValuationModel(key);
    if (!model || model.plan === 'premium') return isPremium;
    return isLoggedIn || isPremium;
  };
  const financial = isFinancial(companyData.sector, industry ?? companyData.industry);
  const runBazin = canRun('bazin');
  const runLynch = canRun('lynch');
  const runBankPvp = financial && canRun('bankPvp');

  // FCD, Gordon e P/VP justo usam Ke das premissas macro (snapshot síncrono, cache de 1 h em memória).
  if (isPremium || runBankPvp) await warmMacroAssumptions();

  let analysisData: CompanyAnalysisData = { ...companyData, industry: industry ?? companyData.industry ?? null };
  if (companyId && !options.rankingInputsLoaded && (isLoggedIn || isPremium)) {
    try {
      analysisData = await loadRankingInputs(analysisData, parseInt(companyId));
    } catch (error) {
      console.warn(`⚠️ Falha ao carregar histórico e proventos de ${companyData.ticker}, seguindo sem eles:`, error);
    }
  }

  if (isPremium || isLoggedIn) analysisData = await withBdrConversionInputs(analysisData);

  // Modelos de preço justo com os mesmos padrões do ranking (registro em ranking-models.ts) no universo do ativo.
  const universe = universeForAssetType(analysisData.assetType);
  const fairValueParams = {
    graham: fairValueModelParams('graham', universe, STRATEGY_CONFIG.graham),
    fcd: fairValueModelParams('fcd', universe, STRATEGY_CONFIG.fcd),
    gordon: fairValueModelParams('gordon', universe, STRATEGY_CONFIG.gordon),
    barsi: fairValueModelParams('barsi', universe, STRATEGY_CONFIG.barsi),
    bazin: fairValueModelParams('bazin', universe, BAZIN_DEFAULTS),
    lynch: fairValueModelParams('lynch', universe, LYNCH_DEFAULTS),
  };

  // Executar análises estratégicas usando StrategyFactory com configuração centralizada
  // Graham: logados OU anônimos com acesso (2 usos por IP)
  const strategies: AnalysisStrategies = {
    graham: (isLoggedIn || isPremium) ? StrategyFactory.runGrahamAnalysis(analysisData, fairValueParams.graham) : null,
    dividendYield: isPremium ? StrategyFactory.runDividendYieldAnalysis(analysisData, STRATEGY_CONFIG.dividendYield) : null,
    lowPE: isPremium ? StrategyFactory.runLowPEAnalysis(analysisData, STRATEGY_CONFIG.lowPE) : null,
    magicFormula: isPremium ? StrategyFactory.runMagicFormulaAnalysis(analysisData, STRATEGY_CONFIG.magicFormula) : null,
    fcd: isPremium ? StrategyFactory.runFCDAnalysis(analysisData, fairValueParams.fcd) : null,
    gordon: isPremium ? StrategyFactory.runGordonAnalysis(analysisData, fairValueParams.gordon) : null,
    fundamentalist: isPremium ? StrategyFactory.runFundamentalistAnalysis(analysisData, STRATEGY_CONFIG.fundamentalist) : null,
    barsi: isPremium ? await StrategyFactory.runBarsiAnalysis(analysisData, fairValueParams.barsi) : null,
    bazin: runBazin ? StrategyFactory.runBazinAnalysis(analysisData, fairValueParams.bazin) : null,
    lynch: runLynch ? StrategyFactory.runLynchAnalysis(analysisData, fairValueParams.lynch) : null,
    bankPvp: runBankPvp ? StrategyFactory.runBankPvpAnalysis(analysisData, BANK_PVP_DEFAULTS) : null,
  };

  // Converter dados financeiros para o tipo esperado
  const financialData: FinancialData = {
    roe: toNumber(companyData.financials.roe),
    liquidezCorrente: toNumber(companyData.financials.liquidezCorrente),
    dividaLiquidaPl: toNumber(companyData.financials.dividaLiquidaPl),
    margemLiquida: toNumber(companyData.financials.margemLiquida),
    payout: toNumber(companyData.financials.payout),
    lpa: toNumber(companyData.financials.lpa), // Lucro por ação para verificar se empresa tem lucro positivo
    dy: toNumber((companyData.financials as any).dy) // Dividend yield para verificar reinvestimento quando payout é zero
  };

  // Buscar dados das demonstrações financeiras se solicitado
  let statementsData: FinancialStatementsData | undefined;
  if (includeStatements && companyId) {
    try {
      statementsData = await getStatementsData(companyId, companyData.ticker, companyData.sector, industry);
    } catch (error) {
      console.warn(`⚠️ Falha ao buscar demonstrações para ${companyData.ticker}, continuando sem statements:`, error);
      // Continua análise sem statements - score ainda pode ser calculado
      statementsData = undefined;
    }
  }

  // Buscar análise do YouTube se for Premium e tiver companyId
  if (isPremium && companyId) {
    try {
      const youtubeAnalysis = await safeQueryWithParams(
        'youtube-analysis-company',
        () => prisma.youTubeAnalysis.findFirst({
          where: { 
            companyId: parseInt(companyId), 
            isActive: true 
          },
          orderBy: { createdAt: 'desc' }
        }),
        { companyId: parseInt(companyId) }
      );

      if (youtubeAnalysis) {
        financialData.youtubeAnalysis = {
          score: toNumber((youtubeAnalysis as any).score) || 0,
          summary: (youtubeAnalysis as any).summary,
          positivePoints: (youtubeAnalysis as any).positivePoints as string[] | undefined,
          negativePoints: (youtubeAnalysis as any).negativePoints as string[] | undefined,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Falha ao buscar análise do YouTube para ${companyData.ticker}:`, error);
      // Continua sem análise do YouTube
    }
  }

  // Buscar flags ativos para a empresa (se tiver companyId)
  let activeFlag: { id: string; reason: string } | null = null;
  if (options.companyId) {
    try {
      const flags = await safeQueryWithParams(
        'company-flags-active',
        () => (prisma as any).companyFlag.findMany({
          where: {
            companyId: parseInt(options.companyId!),
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }),
        { companyId: parseInt(options.companyId!) }
      ) as Array<{ id: string; reason: string }> | null;
      
      if (flags && flags.length > 0) {
        activeFlag = flags[0];
      }
    } catch (error) {
      console.warn(`⚠️ Falha ao buscar flags para ${companyData.ticker}:`, error);
      // Continua sem flag
    }
  }

  // Calcular score geral (com breakdown se solicitado)
  const includeBreakdown = options.includeBreakdown || false;
  let overallScore: OverallScore | null = null;
  
  if (isPremium) {
    try {
      overallScore = calculateOverallScore(strategies, financialData, companyData.currentPrice, statementsData, includeBreakdown, activeFlag);
    } catch (error) {
      console.error(`❌ [COMPANY ANALYSIS] Erro ao calcular overallScore para ${companyData.ticker}:`, error);
      // Retornar null em caso de erro, mas não propagar exceção
      overallScore = null;
    }
  }

  // Ajustar scores das estratégias baseado no breakdown se disponível
  // Isso garante que os scores exibidos na interface sejam os mesmos usados no cálculo final
  let adjustedStrategies = strategies;
  if (overallScore && includeBreakdown && 'contributions' in overallScore && overallScore.contributions && Array.isArray(overallScore.contributions)) {
    adjustedStrategies = adjustStrategiesScoresFromBreakdown(strategies, overallScore.contributions);
  }

  return {
    ticker: companyData.ticker,
    name: companyData.name,
    sector: companyData.sector,
    currentPrice: companyData.currentPrice,
    overallScore,
    strategies: adjustedStrategies
  };
}

/**
 * Ajusta os scores das estratégias para refletir os scores ajustados usados no cálculo final
 * Isso garante consistência entre o que é exibido na interface e o que foi usado no cálculo do overall score
 */
function adjustStrategiesScoresFromBreakdown(
  strategies: AnalysisStrategies,
  contributions: Array<{ name: string; score: number }>
): AnalysisStrategies {
  const adjustedStrategies = { ...strategies };

  // Ajustar cada estratégia que tem correspondência no breakdown
  // FCD
  if (adjustedStrategies.fcd) {
    const contribution = contributions.find(c => c.name === 'Fluxo de Caixa Descontado');
    if (contribution && contribution.score !== adjustedStrategies.fcd.score) {
      adjustedStrategies.fcd = { ...adjustedStrategies.fcd, score: contribution.score };
    }
  }
  
  // Graham
  if (adjustedStrategies.graham) {
    const contribution = contributions.find(c => c.name === 'Graham (Valor Intrínseco)');
    if (contribution && contribution.score !== adjustedStrategies.graham.score) {
      adjustedStrategies.graham = { ...adjustedStrategies.graham, score: contribution.score };
    }
  }
  
  // Gordon
  if (adjustedStrategies.gordon) {
    const contribution = contributions.find(c => c.name === 'Gordon (Dividendos)');
    if (contribution && contribution.score !== adjustedStrategies.gordon.score) {
      adjustedStrategies.gordon = { ...adjustedStrategies.gordon, score: contribution.score };
    }
  }
  
  // Barsi
  if (adjustedStrategies.barsi) {
    const contribution = contributions.find(c => c.name === 'Método Barsi');
    if (contribution && contribution.score !== adjustedStrategies.barsi.score) {
      adjustedStrategies.barsi = { ...adjustedStrategies.barsi, score: contribution.score };
    }
  }
  
  // Dividend Yield
  if (adjustedStrategies.dividendYield) {
    const contribution = contributions.find(c => c.name === 'Dividend Yield');
    if (contribution && contribution.score !== adjustedStrategies.dividendYield.score) {
      adjustedStrategies.dividendYield = { ...adjustedStrategies.dividendYield, score: contribution.score };
    }
  }
  
  // Low P/E
  if (adjustedStrategies.lowPE) {
    const contribution = contributions.find(c => c.name === 'Low P/E');
    if (contribution && contribution.score !== adjustedStrategies.lowPE.score) {
      adjustedStrategies.lowPE = { ...adjustedStrategies.lowPE, score: contribution.score };
    }
  }
  
  // Magic Formula
  if (adjustedStrategies.magicFormula) {
    const contribution = contributions.find(c => c.name === 'Fórmula Mágica');
    if (contribution && contribution.score !== adjustedStrategies.magicFormula.score) {
      adjustedStrategies.magicFormula = { ...adjustedStrategies.magicFormula, score: contribution.score };
    }
  }
  
  // Fundamentalist
  if (adjustedStrategies.fundamentalist) {
    const contribution = contributions.find(c => c.name === 'Fundamentalista 3+1');
    if (contribution && contribution.score !== adjustedStrategies.fundamentalist.score) {
      adjustedStrategies.fundamentalist = { ...adjustedStrategies.fundamentalist, score: contribution.score };
    }
  }

  return adjustedStrategies;
}

// Função helper para executar análise de múltiplas empresas (para página de comparação)
export async function executeMultipleCompanyAnalysis(
  companies: Array<{
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    id: string;
    financialData: Record<string, unknown>[];
    dailyQuotes: Record<string, unknown>[];
    historicalFinancials?: Array<{
      year: number;
      roe?: number | null;
      roic?: number | null;
      pl?: number | null;
      pvp?: number | null;
      dy?: number | null;
      margemLiquida?: number | null;
      margemEbitda?: number | null;
      margemBruta?: number | null;
      liquidezCorrente?: number | null;
      liquidezRapida?: number | null;
      dividaLiquidaPl?: number | null;
      dividaLiquidaEbitda?: number | null;
      lpa?: number | null;
      vpa?: number | null;
      marketCap?: number | null;
      earningsYield?: number | null;
      evEbitda?: number | null;
      roa?: number | null;
      passivoAtivos?: number | null;
    }>;
  }>,
  options: {
    isLoggedIn: boolean;
    isPremium: boolean;
    includeStatements?: boolean;
  }
): Promise<CompanyAnalysisResult[]> {
  const prepared = companies.map((company) => {
    const currentPrice = toNumber(company.dailyQuotes[0]?.price) || toNumber(company.financialData[0]?.lpa) || 0;
    
    // Anos anteriores ao atual, com os mesmos campos do ranking (refeitos do banco quando há sessão).
    const historicalFinancials = company.historicalFinancials ??
      (company.financialData.length > 1
        ? company.financialData.slice(1).map((data) => toHistoricalFinancial(data as Record<string, unknown> & { year: number }))
        : undefined);

    const companyData: CompanyAnalysisData = {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice,
      financials: company.financialData[0] || {},
      historicalFinancials: historicalFinancials
    };

    return { companyId: parseInt(company.id), data: companyData };
  });

  // Histórico, proventos e tipo do ativo de todas as empresas em 2 consultas (os mesmos insumos do ranking).
  let analysisInputs = prepared.map((entry) => entry.data);
  let rankingInputsLoaded = false;
  if (options.isPremium || options.isLoggedIn) {
    try {
      analysisInputs = await prefetchRankingInputs(prepared);
      rankingInputsLoaded = true;
    } catch (error) {
      console.warn('⚠️ Falha ao carregar histórico e proventos em lote, seguindo por empresa:', error);
    }
  }

  return Promise.all(
    analysisInputs.map((companyData, index) =>
      executeCompanyAnalysis(companyData, {
        ...options,
        companyId: companies[index].id,
        industry: companies[index].industry,
        rankingInputsLoaded,
      })
    )
  );
}
