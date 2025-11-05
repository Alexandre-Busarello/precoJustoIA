/**
 * Serviço Centralizado para Cálculo de Score de Empresas
 * 
 * Este serviço garante que o cálculo do Overall Score seja EXATAMENTE IGUAL
 * em todos os lugares da aplicação:
 * - Página individual da empresa (/acao/[ticker])
 * - Dashboard (empresas sugeridas via /api/top-companies)
 * - Qualquer outro lugar que precise calcular score
 * 
 * IMPORTANTE: Este é o ÚNICO lugar que deve conter a lógica de buscar
 * dados e calcular o score. Qualquer mudança aqui afeta todos os lugares.
 */

import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { toNumber, StrategyAnalysis } from '@/lib/strategies';
import { OverallScore } from '@/lib/strategies/overall-score';
import { executeCompanyAnalysis, CompanyAnalysisData } from '@/lib/company-analysis-service';

/**
 * Interface para o resultado do cálculo
 */
export interface CompanyScoreResult {
  ticker: string;
  companyName: string;
  sector: string | null;
  currentPrice: number;
  logoUrl: string | null;
  overallScore: OverallScore | null; // ← Permitir null para usuários não-Premium
  strategies?: { // Opcional: incluir estratégias individuais
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

/**
 * Opções para o cálculo do score
 */
export interface CalculateScoreOptions {
  isPremium?: boolean;
  isLoggedIn?: boolean;
  includeStatements?: boolean;
  includeStrategies?: boolean; // Se deve retornar estratégias individuais (para /api/company-analysis)
  companyId?: string; // ID da empresa para statements
  industry?: string | null; // Indústria da empresa
}

/**
 * Serviço Principal: Calcula o Overall Score de uma empresa
 * 
 * Este método replica EXATAMENTE a lógica usada em:
 * /api/company-analysis/[ticker]/route.ts
 * 
 * @param ticker - Ticker da empresa (ex: "PETR4")
 * @param options - Opções para o cálculo (premium, logged in, etc)
 * @returns Score calculado ou null se a empresa não for encontrada
 */
export async function calculateCompanyOverallScore(
  ticker: string,
  options: CalculateScoreOptions = {}
): Promise<CompanyScoreResult | null> {
  const {
    isPremium = true, // Default true para dashboard (só Premium vê)
    isLoggedIn = true,
    includeStatements = isPremium, // Default: incluir statements se for Premium
    includeStrategies = false, // Default: não incluir estratégias (só para /api/company-analysis)
    companyId,
    industry
  } = options;

  try {
    // === 1. BUSCAR DADOS DA EMPRESA ===
    // Exatamente como no /api/company-analysis/[ticker]
    const companyData = await safeQueryWithParams(
      'company-with-financials-and-quotes',
      () => prisma.company.findUnique({
        where: { ticker: ticker.toUpperCase() },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 8 // Dados atuais + até 7 anos históricos (IGUAL AO ORIGINAL)
          },
          dailyQuotes: {
            orderBy: { date: 'desc' },
            take: 1
          }
        }
      }),
      { ticker: ticker.toUpperCase() }
    ) as any;

    if (!companyData) {
      console.log(`⚠️ Empresa ${ticker} não encontrada`);
      return null;
    }

    const latestFinancials = companyData.financialData[0];
    const latestQuote = companyData.dailyQuotes[0];

    if (!latestFinancials) {
      console.log(`⚠️ ${ticker}: Dados financeiros não disponíveis`);
      return null;
    }

    // === 2. CALCULAR PREÇO ATUAL ===
    // Exatamente como no original
    const currentPrice = toNumber(latestQuote?.price) || 0;

    if (currentPrice <= 0) {
      console.log(`⚠️ ${ticker}: Preço atual inválido`);
      return null;
    }

    // === 3. PREPARAR DADOS HISTÓRICOS ===
    // Exatamente como no original: excluir o primeiro (atual) e pegar os 7 anteriores
    const historicalFinancials = companyData.financialData.slice(1).map((data: any) => ({
      year: data.year,
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
    }));

    // === 4. PREPARAR DADOS PARA ANÁLISE ===
    // Exatamente como no original
    const companyAnalysisData: CompanyAnalysisData = {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice,
      financials: latestFinancials,
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined
    };

    // === 5. EXECUTAR ANÁLISE COMPLETA ===
    // Exatamente como no original, usando o serviço centralizado
    const analysisResult = await executeCompanyAnalysis(companyAnalysisData, {
      isLoggedIn,
      isPremium,
      includeStatements, // Incluir demonstrações baseado em isPremium
      companyId: companyId || String(companyData.id),
      industry: industry !== undefined ? industry : companyData.industry
    });

    const { overallScore, strategies } = analysisResult;

    // ✅ CORREÇÃO: Não falhar se overallScore for null (pode ser null para não-Premium)
    // O importante é ter as estratégias (especialmente Graham para usuários logados)
    if (!strategies) {
      console.log(`⚠️ ${ticker}: Estratégias não puderam ser calculadas`);
      return null;
    }

    // === 6. RETORNAR RESULTADO ===
    const result: CompanyScoreResult = {
      ticker: companyData.ticker,
      companyName: companyData.name,
      sector: companyData.sector,
      currentPrice,
      logoUrl: companyData.logoUrl,
      overallScore
    };

    // Incluir estratégias individuais se solicitado (para /api/company-analysis)
    if (includeStrategies) {
      result.strategies = strategies;
    }

    return result;

  } catch (error) {
    console.error(`❌ Erro ao calcular score para ${ticker}:`, error);
    return null;
  }
}

/**
 * Calcula scores para múltiplas empresas em paralelo
 * 
 * @param tickers - Array de tickers
 * @param options - Opções para o cálculo
 * @returns Array de resultados (null para empresas que falharam)
 */
export async function calculateMultipleCompanyScores(
  tickers: string[],
  options: CalculateScoreOptions = {}
): Promise<(CompanyScoreResult | null)[]> {
  return Promise.all(
    tickers.map(ticker => calculateCompanyOverallScore(ticker, options))
  );
}

