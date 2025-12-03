import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { 
  StrategyFactory,
  StrategyAnalysis,
  toNumber
} from '@/lib/strategies';
import { calculateOverallScore, OverallScore, OverallScoreWithBreakdown, FinancialData, FinancialStatementsData } from '@/lib/strategies/overall-score';
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config';

// Interface para dados da empresa
export interface CompanyAnalysisData {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  financials: Record<string, unknown>;
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
  strategies: {
    graham: StrategyAnalysis | null;
    dividendYield: StrategyAnalysis | null;
    lowPE: StrategyAnalysis | null;
    magicFormula: StrategyAnalysis | null;
    fcd: StrategyAnalysis | null;
    gordon: StrategyAnalysis | null;
    fundamentalist: StrategyAnalysis | null;
    barsi: StrategyAnalysis | null;
  };
}

// Função centralizada para buscar dados das demonstrações financeiras
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

      console.log(`Dados de fallback carregados para ${ticker}: ${years.length} anos de dados`);
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

  // Executar análises estratégicas usando StrategyFactory com configuração centralizada
  const strategies = {
    graham: isLoggedIn ? StrategyFactory.runGrahamAnalysis(companyData, STRATEGY_CONFIG.graham) : null,
    dividendYield: isPremium ? StrategyFactory.runDividendYieldAnalysis(companyData, STRATEGY_CONFIG.dividendYield) : null,
    lowPE: isPremium ? StrategyFactory.runLowPEAnalysis(companyData, STRATEGY_CONFIG.lowPE) : null,
    magicFormula: isPremium ? StrategyFactory.runMagicFormulaAnalysis(companyData, STRATEGY_CONFIG.magicFormula) : null,
    fcd: isPremium ? StrategyFactory.runFCDAnalysis(companyData, STRATEGY_CONFIG.fcd) : null,
    gordon: isPremium ? StrategyFactory.runGordonAnalysis(companyData, STRATEGY_CONFIG.gordon) : null,
    fundamentalist: isPremium ? StrategyFactory.runFundamentalistAnalysis(companyData, STRATEGY_CONFIG.fundamentalist) : null,
    barsi: isPremium ? await StrategyFactory.runBarsiAnalysis(companyData, STRATEGY_CONFIG.barsi) : null
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

  // Calcular score geral (com breakdown se solicitado)
  const includeBreakdown = options.includeBreakdown || false;
  let overallScore: OverallScore | null = null;
  
  if (isPremium) {
    try {
      overallScore = calculateOverallScore(strategies, financialData, companyData.currentPrice, statementsData, includeBreakdown);
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
  strategies: {
    graham: StrategyAnalysis | null;
    dividendYield: StrategyAnalysis | null;
    lowPE: StrategyAnalysis | null;
    magicFormula: StrategyAnalysis | null;
    fcd: StrategyAnalysis | null;
    gordon: StrategyAnalysis | null;
    fundamentalist: StrategyAnalysis | null;
    barsi: StrategyAnalysis | null;
  },
  contributions: Array<{ name: string; score: number }>
): {
  graham: StrategyAnalysis | null;
  dividendYield: StrategyAnalysis | null;
  lowPE: StrategyAnalysis | null;
  magicFormula: StrategyAnalysis | null;
  fcd: StrategyAnalysis | null;
  gordon: StrategyAnalysis | null;
  fundamentalist: StrategyAnalysis | null;
  barsi: StrategyAnalysis | null;
} {
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
  const results = await Promise.all(
    companies.map(async (company) => {
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

      return executeCompanyAnalysis(companyData, {
        ...options,
        companyId: company.id,
        industry: company.industry
      });
    })
  );

  return results;
}
