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
import { BANK_PVP_DEFAULTS } from '@/lib/strategies/bank-pvp-strategy';
import type { CompanyData, HistoricalFinancialData } from '@/lib/strategies/types';
import { getValuationModel } from '@/components/asset/valuation-models';
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

/** Campos de lucro/caixa por ano usados em "lucros consistentes" (8 anos) e que os chamadores não trazem. */
const PROFIT_FIELDS = ['lucroLiquido', 'receitaTotal', 'ebitda', 'fluxoCaixaOperacional'] as const;

interface ProfitRow {
  year: number;
  lucroLiquido: unknown;
  receitaTotal: unknown;
  ebitda: unknown;
  fluxoCaixaOperacional: unknown;
}

const PROFIT_SELECT = { year: true, lucroLiquido: true, receitaTotal: true, ebitda: true, fluxoCaixaOperacional: true } as const;

/** O histórico do chamador já traz o lucro de cada ano (nada a buscar para "lucros consistentes"). */
function hasProfitHistory(companyData: CompanyAnalysisData): boolean {
  const rows: HistoricalFinancialData[] = companyData.historicalFinancials ?? [];
  return rows.length > 0 && rows.every((row) => row.lucroLiquido !== undefined);
}

/** Junta os campos de lucro/caixa por ano (`profitRows`, mais recente primeiro) ao histórico da análise. */
function mergeProfitHistory(companyData: CompanyAnalysisData, profitRows: readonly ProfitRow[]): CompanyAnalysisData {
  if (profitRows.length === 0) return companyData;
  const profitByYear = new Map(profitRows.map((row) => [row.year, row]));
  const currentYear = toNumber(companyData.financials.year) ?? profitRows[0]?.year;
  const existing: HistoricalFinancialData[] = companyData.historicalFinancials ?? [];
  const historicalFinancials: HistoricalFinancialData[] = existing.length > 0
    ? existing.map((row) => {
        const profit = profitByYear.get(row.year);
        const merged: HistoricalFinancialData = { ...row };
        for (const field of PROFIT_FIELDS) {
          if (merged[field] === undefined || merged[field] === null) merged[field] = profit ? toNumber(profit[field]) : null;
        }
        return merged;
      })
    : profitRows
        .filter((row) => row.year !== currentYear)
        .map((row) => ({
          year: row.year,
          lucroLiquido: toNumber(row.lucroLiquido),
          receitaTotal: toNumber(row.receitaTotal),
          ebitda: toNumber(row.ebitda),
          fluxoCaixaOperacional: toNumber(row.fluxoCaixaOperacional),
        }));

  return {
    ...companyData,
    historicalFinancials: (historicalFinancials.length > 0 ? historicalFinancials : companyData.historicalFinancials) as CompanyAnalysisData['historicalFinancials'],
  };
}

/**
 * Completa os dados da análise com o que os modelos de dividendos e de lucros consistentes precisam: proventos dos
 * últimos 6 anos completos (com tipo e data de pagamento) e o lucro de cada ano no histórico. Respeita o que o
 * chamador já trouxe e só consulta o banco para o que falta.
 */
async function withDividendAndProfitHistory(companyData: CompanyAnalysisData, companyId: number): Promise<CompanyAnalysisData> {
  const needsDividends = companyData.dividendHistory === undefined;
  const needsProfits = !hasProfitHistory(companyData);
  if (!needsDividends && !needsProfits) return companyData;

  const [dividendRows, profitRows] = await Promise.all([
    needsDividends
      ? safeQueryWithParams(
          'dividend-history-company-analysis',
          () =>
            prisma.dividendHistory.findMany({
              where: { companyId, exDate: { gte: dividendHistoryStart() } },
              orderBy: { exDate: 'desc' },
              select: { exDate: true, paymentDate: true, amount: true, type: true },
            }),
          { companyId, since: dividendHistoryStart().toISOString() }
        )
      : Promise.resolve(null),
    needsProfits
      ? safeQueryWithParams(
          'profit-history-company-analysis',
          () =>
            prisma.financialData.findMany({
              where: { companyId },
              orderBy: { year: 'desc' },
              take: 8,
              select: PROFIT_SELECT,
            }),
          { companyId }
        )
      : Promise.resolve([] as ProfitRow[]),
  ]);

  const merged = mergeProfitHistory(companyData, profitRows);
  return dividendRows ? { ...merged, dividendHistory: toDividendHistory(dividendRows) } : merged;
}

/**
 * Versão em lote de `withDividendAndProfitHistory`: 2 consultas para todas as empresas em vez de 2 por empresa.
 * Empresas sem proventos ficam com lista vazia (não refazem a consulta individualmente).
 */
async function prefetchDividendAndProfitHistory(
  entries: ReadonlyArray<{ companyId: number; data: CompanyAnalysisData }>
): Promise<CompanyAnalysisData[]> {
  const ids = Array.from(new Set(entries.map((entry) => entry.companyId).filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return entries.map((entry) => entry.data);
  const since = dividendHistoryStart();
  const [dividendRows, profitRows] = await Promise.all([
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
    safeQueryWithParams(
      'profit-history-company-analysis-batch',
      () =>
        prisma.financialData.findMany({
          where: { companyId: { in: ids } },
          orderBy: { year: 'desc' },
          select: { companyId: true, ...PROFIT_SELECT },
        }),
      { ids: ids.join(',') }
    ),
  ]);

  const dividendsById = new Map<number, typeof dividendRows>();
  for (const row of dividendRows) {
    const list = dividendsById.get(row.companyId) ?? [];
    list.push(row);
    dividendsById.set(row.companyId, list);
  }
  const profitsById = new Map<number, ProfitRow[]>();
  for (const row of profitRows) {
    const list = profitsById.get(row.companyId) ?? [];
    if (list.length < 8) list.push(row);
    profitsById.set(row.companyId, list);
  }

  return entries.map(({ companyId, data }) => {
    const withProfits = hasProfitHistory(data) ? data : mergeProfitHistory(data, profitsById.get(companyId) ?? []);
    return data.dividendHistory === undefined
      ? { ...withProfits, dividendHistory: toDividendHistory(dividendsById.get(companyId) ?? []) }
      : withProfits;
  });
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
  if (companyId && (isPremium || runBazin || runLynch || runBankPvp)) {
    try {
      analysisData = await withDividendAndProfitHistory(analysisData, parseInt(companyId));
    } catch (error) {
      console.warn(`⚠️ Falha ao carregar proventos e lucros de ${companyData.ticker}, seguindo sem eles:`, error);
    }
  }

  // Executar análises estratégicas usando StrategyFactory com configuração centralizada
  // Graham: logados OU anônimos com acesso (2 usos por IP)
  const strategies: AnalysisStrategies = {
    graham: (isLoggedIn || isPremium) ? StrategyFactory.runGrahamAnalysis(analysisData, STRATEGY_CONFIG.graham) : null,
    dividendYield: isPremium ? StrategyFactory.runDividendYieldAnalysis(analysisData, STRATEGY_CONFIG.dividendYield) : null,
    lowPE: isPremium ? StrategyFactory.runLowPEAnalysis(analysisData, STRATEGY_CONFIG.lowPE) : null,
    magicFormula: isPremium ? StrategyFactory.runMagicFormulaAnalysis(analysisData, STRATEGY_CONFIG.magicFormula) : null,
    fcd: isPremium ? StrategyFactory.runFCDAnalysis(analysisData, STRATEGY_CONFIG.fcd) : null,
    gordon: isPremium ? StrategyFactory.runGordonAnalysis(analysisData, STRATEGY_CONFIG.gordon) : null,
    fundamentalist: isPremium ? StrategyFactory.runFundamentalistAnalysis(analysisData, STRATEGY_CONFIG.fundamentalist) : null,
    barsi: isPremium ? await StrategyFactory.runBarsiAnalysis(analysisData, STRATEGY_CONFIG.barsi) : null,
    bazin: runBazin ? StrategyFactory.runBazinAnalysis(analysisData, BAZIN_DEFAULTS) : null,
    lynch: runLynch ? StrategyFactory.runLynchAnalysis(analysisData, LYNCH_DEFAULTS) : null,
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
    
    // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
    // IMPORTANTE: Converter todos os Decimal para number para evitar erros de serialização
    const historicalFinancials = company.historicalFinancials || 
      (company.financialData.length > 1 ? company.financialData.slice(1).map(data => ({
        year: data.year as number,
        roe: toNumber(data.roe),
        roic: toNumber(data.roic),
        pl: toNumber(data.pl),
        pvp: toNumber(data.pvp),
        dy: toNumber(data.dy),
        margemLiquida: toNumber(data.margemLiquida),
        margemEbitda: toNumber(data.margemEbitda),
        margemBruta: toNumber(data.margemBruta),
        liquidezCorrente: toNumber(data.liquidezCorrente),
        liquidezRapida: toNumber(data.liquidezRapida),
        dividaLiquidaPl: toNumber(data.dividaLiquidaPl),
        dividaLiquidaEbitda: toNumber(data.dividaLiquidaEbitda),
        lpa: toNumber(data.lpa),
        vpa: toNumber(data.vpa),
        marketCap: toNumber(data.marketCap),
        earningsYield: toNumber(data.earningsYield),
        evEbitda: toNumber(data.evEbitda),
        roa: toNumber(data.roa),
        passivoAtivos: toNumber(data.passivoAtivos)
      })) : undefined);
    
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

  // Proventos e lucros de todas as empresas em 2 consultas (os modelos de dividendos e "lucros consistentes" usam).
  let analysisInputs = prepared.map((entry) => entry.data);
  if (options.isPremium || options.isLoggedIn) {
    try {
      analysisInputs = await prefetchDividendAndProfitHistory(prepared);
    } catch (error) {
      console.warn('⚠️ Falha ao carregar proventos e lucros em lote, seguindo por empresa:', error);
    }
  }

  return Promise.all(
    analysisInputs.map((companyData, index) =>
      executeCompanyAnalysis(companyData, {
        ...options,
        companyId: companies[index].id,
        industry: companies[index].industry,
      })
    )
  );
}
