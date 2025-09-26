import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { StrategyAnalysis, toNumber } from '@/lib/strategies';
import { OverallScore } from '@/lib/strategies/overall-score';
import { executeCompanyAnalysis, CompanyAnalysisData } from '@/lib/company-analysis-service';


// Interface para resposta da API
interface CompanyAnalysisResponse {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | null; // null para não-premium
  strategies: {
    graham: StrategyAnalysis;
    dividendYield: StrategyAnalysis;
    lowPE: StrategyAnalysis;
    magicFormula: StrategyAnalysis;
    fcd: StrategyAnalysis;
    gordon: StrategyAnalysis;
    fundamentalist: StrategyAnalysis;
  };
}


// === ENDPOINT HANDLER ===

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const resolvedParams = await params;
    const ticker = resolvedParams.ticker.toUpperCase();
    
    // Verificar usuário atual - ÚNICA FONTE DA VERDADE
    const user = await getCurrentUser();
    const isLoggedIn = !!user;
    const isPremium = user?.isPremium || false;

    // Buscar dados da empresa
    const companyData = await safeQuery(`company-data-${ticker}`, () =>
      prisma.company.findUnique({
        where: { ticker },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 8 // Dados atuais + até 7 anos históricos
          },
          dailyQuotes: {
            orderBy: { date: 'desc' },
            take: 1
          }
        }
      })
    );

    if (!companyData) {
      return NextResponse.json(
        { error: `Empresa ${ticker} não encontrada` },
        { status: 404 }
      );
    }

    const latestFinancials = companyData.financialData[0];
    const latestQuote = companyData.dailyQuotes[0];

    if (!latestFinancials) {
      return NextResponse.json(
        { error: `Dados financeiros não disponíveis para ${ticker}` },
        { status: 404 }
      );
    }

    // Preço atual
    const currentPrice = toNumber(latestQuote?.price) || 0;

    // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
    const historicalFinancials = companyData.financialData.slice(1).map(data => ({
      year: data.year,
      roe: data.roe,
      roic: data.roic,
      pl: data.pl,
      pvp: data.pvp,
      dy: data.dy,
      margemLiquida: data.margemLiquida,
      margemEbitda: data.margemEbitda,
      margemBruta: data.margemBruta,
      liquidezCorrente: data.liquidezCorrente,
      liquidezRapida: data.liquidezRapida,
      dividaLiquidaPl: data.dividaLiquidaPl,
      dividaLiquidaEbitda: data.dividaLiquidaEbitda,
      lpa: data.lpa,
      vpa: data.vpa,
      marketCap: data.marketCap,
      earningsYield: data.earningsYield,
      evEbitda: data.evEbitda,
      roa: data.roa,
      passivoAtivos: data.passivoAtivos
    }));

    // Preparar dados da empresa para análise
    const companyAnalysisData: CompanyAnalysisData = {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice,
      financials: latestFinancials,
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined
    };

    // Executar análise completa usando o serviço centralizado
    const analysisResult = await executeCompanyAnalysis(companyAnalysisData, {
      isLoggedIn,
      isPremium,
      includeStatements: isPremium, // Incluir demonstrações apenas para premium
      companyId: String(companyData.id),
      industry: companyData.industry
    });

    const { strategies, overallScore } = analysisResult;

    const response: CompanyAnalysisResponse = {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice,
      overallScore,
      strategies: {
        graham: strategies.graham || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isLoggedIn ? '' : 'Login necessário para acessar análise Graham',
          criteria: [],
        },
        dividendYield: strategies.dividendYield || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Dividend Yield',
          criteria: [],
        },
        lowPE: strategies.lowPE || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Value Investing',
          criteria: [],
        },
        magicFormula: strategies.magicFormula || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Magic Formula',
          criteria: [],
        },
        fcd: strategies.fcd || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise FCD',
          criteria: [],
        },
        gordon: strategies.gordon || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Fórmula de Gordon',
          criteria: [],
        },
        fundamentalist: strategies.fundamentalist || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Fundamentalista 3+1',
          criteria: [],
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro na API company-analysis:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
