import { prisma } from '@/lib/prisma';
import { 
  StrategyFactory,
  StrategyAnalysis,
  toNumber
} from '@/lib/strategies';
import { calculateOverallScore, OverallScore, FinancialData, FinancialStatementsData } from '@/lib/strategies/overall-score';
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config';

// Interface para dados da empresa
export interface CompanyAnalysisData {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  financials: Record<string, unknown>;
}

// Interface para resultado da análise
export interface CompanyAnalysisResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | null;
  strategies: {
    graham: StrategyAnalysis | null;
    dividendYield: StrategyAnalysis | null;
    lowPE: StrategyAnalysis | null;
    magicFormula: StrategyAnalysis | null;
    fcd: StrategyAnalysis | null;
    gordon: StrategyAnalysis | null;
    fundamentalist: StrategyAnalysis | null;
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

    const [incomeStatements, balanceSheets, cashflowStatements] = await Promise.all([
      prisma.incomeStatement.findMany({
        where: {
          companyId: parseInt(companyId),
          period: 'YEARLY',
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 5 // Últimos 5 anos para análise
      }),
      prisma.balanceSheet.findMany({
        where: {
          companyId: parseInt(companyId),
          period: 'YEARLY',
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 5
      }),
      prisma.cashflowStatement.findMany({
        where: {
          companyId: parseInt(companyId),
          period: 'YEARLY',
          endDate: { gte: new Date(`${startYear}-01-01`) }
        },
        orderBy: { endDate: 'desc' },
        take: 5
      })
    ]);

    if (incomeStatements.length === 0 && balanceSheets.length === 0 && cashflowStatements.length === 0) {
      return undefined;
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
        sector: sector,
        industry: industry,
        marketCap: null // MarketCap será obtido de outra fonte se necessário
      }
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
    fundamentalist: isPremium ? StrategyFactory.runFundamentalistAnalysis(companyData, STRATEGY_CONFIG.fundamentalist) : null
  };

  // Converter dados financeiros para o tipo esperado
  const financialData: FinancialData = {
    roe: toNumber(companyData.financials.roe),
    liquidezCorrente: toNumber(companyData.financials.liquidezCorrente),
    dividaLiquidaPl: toNumber(companyData.financials.dividaLiquidaPl),
    margemLiquida: toNumber(companyData.financials.margemLiquida)
  };

  // Buscar dados das demonstrações financeiras se solicitado
  let statementsData: FinancialStatementsData | undefined;
  if (includeStatements && companyId) {
    statementsData = await getStatementsData(companyId, companyData.ticker, companyData.sector, industry);
  }

  // Calcular score geral
  const overallScore = isPremium ? calculateOverallScore(strategies, financialData, companyData.currentPrice, statementsData) : null;

  return {
    ticker: companyData.ticker,
    name: companyData.name,
    sector: companyData.sector,
    currentPrice: companyData.currentPrice,
    overallScore,
    strategies
  };
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
      
      const companyData: CompanyAnalysisData = {
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        financials: company.financialData[0] || {}
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
