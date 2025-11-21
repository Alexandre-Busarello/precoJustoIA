import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-service';
import { StrategyAnalysis } from '@/lib/strategies';
import { OverallScore } from '@/lib/strategies/overall-score';
import { calculateCompanyOverallScore } from '@/lib/calculate-company-score-service';
import { cache } from '@/lib/cache-service';

const CACHE_TTL = 4 * 60 * 60; // 4 horas em segundos

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
    barsi: StrategyAnalysis;
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

    // Criar chave de cache considerando ticker e status do usuário
    const cacheKey = `company-analysis:${ticker}:${isLoggedIn ? 'logged' : 'anon'}:${isPremium ? 'premium' : 'free'}`;

    // Verificar cache
    const cachedData = await cache.get<CompanyAnalysisResponse>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ✅ USAR SERVIÇO CENTRALIZADO - Garantia de cálculo idêntico ao Dashboard
    const analysisResult = await calculateCompanyOverallScore(ticker, {
      isPremium, // ← Usar valor real do usuário
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

    // ✅ CORRIGIR LÓGICA: Graham deve ser retornada para usuários logados, outras para Premium
    const response: CompanyAnalysisResponse = {
      ticker: companyTicker,
      name: companyName,
      sector: sector,
      currentPrice,
      overallScore: isPremium ? overallScore : null, // ← Overall Score apenas para Premium
      strategies: {
        // ✅ GRAHAM: Gratuita para usuários logados
        graham: (isLoggedIn && resultStrategies?.graham) ? resultStrategies.graham : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isLoggedIn ? 'Dados insuficientes para análise Graham' : 'Login necessário para acessar análise Graham',
          criteria: [],
        },
        // ✅ PREMIUM: Apenas para assinantes Premium
        dividendYield: (isPremium && resultStrategies?.dividendYield) ? resultStrategies.dividendYield : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Dividend Yield' : 'Premium necessário para análise Dividend Yield',
          criteria: [],
        },
        lowPE: (isPremium && resultStrategies?.lowPE) ? resultStrategies.lowPE : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Value Investing' : 'Premium necessário para análise Value Investing',
          criteria: [],
        },
        magicFormula: (isPremium && resultStrategies?.magicFormula) ? resultStrategies.magicFormula : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Magic Formula' : 'Premium necessário para análise Magic Formula',
          criteria: [],
        },
        fcd: (isPremium && resultStrategies?.fcd) ? resultStrategies.fcd : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise FCD' : 'Premium necessário para análise FCD',
          criteria: [],
        },
        gordon: (isPremium && resultStrategies?.gordon) ? resultStrategies.gordon : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Fórmula de Gordon' : 'Premium necessário para análise Fórmula de Gordon',
          criteria: [],
        },
        fundamentalist: (isPremium && resultStrategies?.fundamentalist) ? resultStrategies.fundamentalist : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Fundamentalista 3+1' : 'Premium necessário para análise Fundamentalista 3+1',
          criteria: [],
        },
        barsi: (isPremium && resultStrategies?.barsi) ? resultStrategies.barsi : {
          isEligible: false,
          score: 0,
          fairValue: null,
          upside: null,
          reasoning: isPremium ? 'Dados insuficientes para análise Método Barsi' : 'Premium necessário para análise Método Barsi',
          criteria: [],
        }
      }
    };

    // Salvar no cache
    await cache.set(cacheKey, response, { ttl: CACHE_TTL });

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro na API company-analysis:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
