import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { StrategyAnalysis } from '@/lib/strategies';
import { OverallScore } from '@/lib/strategies/overall-score';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';


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

    // ✅ USAR SERVIÇO CENTRALIZADO - Garantia de cálculo idêntico ao Dashboard
    const analysisResult = await calculateCompanyOverallScore(ticker, {
      isPremium,
      isLoggedIn,
      includeStatements: isPremium, // Incluir demonstrações apenas para premium
      includeStrategies: true, // ← IMPORTANTE: Incluir estratégias individuais para a página
      // companyId e industry serão buscados automaticamente pelo serviço
    });

    if (!analysisResult) {
      return NextResponse.json(
        { error: `Empresa ${ticker} não encontrada ou dados insuficientes` },
        { status: 404 }
      );
    }

    const { ticker: companyTicker, companyName, sector, currentPrice, overallScore, strategies: resultStrategies } = analysisResult;

    const response: CompanyAnalysisResponse = {
      ticker: companyTicker,
      name: companyName,
      sector: sector,
      currentPrice,
      overallScore,
      strategies: {
        graham: resultStrategies?.graham || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isLoggedIn ? '' : 'Login necessário para acessar análise Graham',
          criteria: [],
        },
        dividendYield: resultStrategies?.dividendYield || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Dividend Yield',
          criteria: [],
        },
        lowPE: resultStrategies?.lowPE || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Value Investing',
          criteria: [],
        },
        magicFormula: resultStrategies?.magicFormula || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Magic Formula',
          criteria: [],
        },
        fcd: resultStrategies?.fcd || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise FCD',
          criteria: [],
        },
        gordon: resultStrategies?.gordon || {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? '' : 'Premium necessário para análise Fórmula de Gordon',
          criteria: [],
        },
        fundamentalist: resultStrategies?.fundamentalist || {
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
