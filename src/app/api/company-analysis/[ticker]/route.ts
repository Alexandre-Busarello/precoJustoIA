import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQuery } from '@/lib/prisma-wrapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
    
    // Verificar sessão do usuário
    const session = await getServerSession(authOptions);
    const isLoggedIn = !!session?.user;
    
    // Verificar se é Premium para estratégias avançadas
    let isPremium = false;
    if (isLoggedIn) {
      const user = await safeQuery('user-subscription-check', () =>
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { 
            subscriptionTier: true, 
            premiumExpiresAt: true 
          }
        })
      );
      
      isPremium = user?.subscriptionTier === 'PREMIUM' && 
                 (!user.premiumExpiresAt || user.premiumExpiresAt > new Date());
    }

    // Buscar dados da empresa
    const companyData = await safeQuery(`company-data-${ticker}`, () =>
      prisma.company.findUnique({
        where: { ticker },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 1
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

    // Preparar dados da empresa para análise
    const companyAnalysisData: CompanyAnalysisData = {
      ticker: companyData.ticker,
      name: companyData.name,
      sector: companyData.sector,
      currentPrice,
      financials: latestFinancials
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
