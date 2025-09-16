import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQuery, safeTransaction } from '@/lib/prisma-wrapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  StrategyFactory,
  GrahamParams,
  DividendYieldParams,
  LowPEParams,
  MagicFormulaParams,
  FCDParams,
  GordonParams,
  AIParams,
  RankBuilderResult,
  CompanyData,
  toNumber
} from '@/lib/strategies';

type ModelParams = GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams | FCDParams | GordonParams | AIParams;

interface RankBuilderRequest {
  model: 'graham' | 'dividendYield' | 'lowPE' | 'magicFormula' | 'fcd' | 'gordon' | 'ai';
  params: ModelParams;
}

// Função para buscar dados de todas as empresas
async function getCompaniesData(): Promise<CompanyData[]> {
  const companies = await safeQuery('all-companies-data', () =>
    prisma.company.findMany({
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1, // Dados mais recentes
        },
        dailyQuotes: {
          orderBy: { date: 'desc' },
          take: 1, // Cotação mais recente
        }
      },
      where: {
        financialData: {
          some: {
            // Filtros básicos para ter dados mínimos necessários
            lpa: { not: null },
            vpa: { not: null },
          }
        },
        dailyQuotes: {
          some: {}
        }
      }
    })
  );

  // Converter para o formato CompanyData
  return companies.map(company => ({
    ticker: company.ticker,
    name: company.name,
    sector: company.sector,
    currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
    logoUrl: company.logoUrl,
    financials: company.financialData[0] || {}
  }));
}

// Função para gerar o racional de cada modelo usando StrategyFactory
function generateRational(model: string, params: ModelParams): string {
  switch (model) {
    case 'graham':
      return StrategyFactory.generateRational('graham', params as GrahamParams);
    case 'dividendYield':
      return StrategyFactory.generateRational('dividendYield', params as DividendYieldParams);
    case 'lowPE':
      return StrategyFactory.generateRational('lowPE', params as LowPEParams);
    case 'magicFormula':
      return StrategyFactory.generateRational('magicFormula', params as MagicFormulaParams);
    case 'fcd':
      return StrategyFactory.generateRational('fcd', params as FCDParams);
    case 'gordon':
      return StrategyFactory.generateRational('gordon', params as GordonParams);
    case 'ai':
      return StrategyFactory.generateRational('ai', params as AIParams);
    default:
      return 'Modelo não encontrado.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RankBuilderRequest = await request.json();
    const { model, params } = body;

    // Validação básica
    if (!model || !params) {
      return NextResponse.json(
        { error: 'Model e params são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o usuário está autenticado para salvar histórico
    const session = await getServerSession(authOptions);

    // Verificar se é modelo Premium e se usuário tem acesso
    if (model === 'fcd' || model === 'gordon' || model === 'ai') {
      if (!session?.user?.id) {
        const modelName = model === 'fcd' ? 'FCD' : model === 'gordon' ? 'Fórmula de Gordon' : 'Análise com IA';
        return NextResponse.json(
          { error: `Modelo ${modelName} exclusivo para usuários logados. Faça login para acessar.` },
          { status: 401 }
        );
      }

      // Buscar dados do usuário para verificar se é Premium
      const user = await safeQuery('user-premium-check', () =>
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { 
            subscriptionTier: true, 
            premiumExpiresAt: true 
          }
        })
      );

      const isPremium = user?.subscriptionTier === 'PREMIUM' && 
                       (!user.premiumExpiresAt || user.premiumExpiresAt > new Date());

      if (!isPremium) {
        const modelName = model === 'fcd' ? 'FCD' : model === 'gordon' ? 'Fórmula de Gordon' : 'Análise com IA';
        return NextResponse.json(
          { error: `Modelo ${modelName} exclusivo para usuários Premium. Faça upgrade para acessar análises avançadas.` },
          { status: 403 }
        );
      }
    }

    // Buscar dados de todas as empresas
    const companies = await getCompaniesData();
    
    let results: RankBuilderResult[] = [];

    switch (model) {
      case 'graham':
        results = StrategyFactory.runGrahamRanking(companies, params as GrahamParams);
        break;
      case 'dividendYield':
        results = StrategyFactory.runDividendYieldRanking(companies, params as DividendYieldParams);
        break;
      case 'lowPE':
        results = StrategyFactory.runLowPERanking(companies, params as LowPEParams);
        break;
      case 'magicFormula':
        results = StrategyFactory.runMagicFormulaRanking(companies, params as MagicFormulaParams);
        break;
      case 'fcd':
        results = StrategyFactory.runFCDRanking(companies, params as FCDParams);
        break;
      case 'gordon':
        results = StrategyFactory.runGordonRanking(companies, params as GordonParams);
        break;
      case 'ai':
        results = await StrategyFactory.runAIRanking(companies, params as AIParams);
        break;
      default:
        return NextResponse.json(
          { error: `Modelo '${model}' não suportado` },
          { status: 400 }
        );
    }

    // Gerar racional para o modelo usado
    const rational = generateRational(model, params);

    // Salvar no histórico se o usuário estiver logado (COM transação pois é INSERT)
    if (session?.user?.id) {
      try {
        await safeTransaction('save-ranking-history', () =>
          prisma.rankingHistory.create({
            data: {
              userId: session.user.id,
              model,
              params: JSON.parse(JSON.stringify(params)), // Conversão para Json type
              results: JSON.parse(JSON.stringify(results)), // Cache dos resultados como Json
              resultCount: results.length,
            }
          })
        );
      } catch (historyError) {
        // Não falhar a request se não conseguir salvar no histórico
        console.error('Erro ao salvar histórico:', historyError);
      }
    }

    return NextResponse.json({
      model,
      params,
      rational,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Erro na API rank-builder:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}