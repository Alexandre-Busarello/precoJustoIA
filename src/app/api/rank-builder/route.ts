import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQuery, safeTransaction } from '@/lib/prisma-wrapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import {
  StrategyFactory,
  GrahamParams,
  DividendYieldParams,
  LowPEParams,
  MagicFormulaParams,
  FCDParams,
  GordonParams,
  FundamentalistParams,
  AIParams,
  RankBuilderResult,
  CompanyData,
  toNumber
} from '@/lib/strategies';
import { TechnicalIndicators, type PriceData } from '@/lib/technical-indicators';

type ModelParams = GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams | FCDParams | GordonParams | FundamentalistParams | AIParams;

interface RankBuilderRequest {
  model: 'graham' | 'dividendYield' | 'lowPE' | 'magicFormula' | 'fcd' | 'gordon' | 'fundamentalist' | 'ai';
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
        },
        historicalPrices: {
          where: {
            interval: '1mo',
            date: {
              gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) // Últimos 2 anos
            }
          },
          orderBy: { date: 'asc' },
          select: {
            date: true,
            open: true,
            high: true,
            low: true,
            close: true,
            volume: true
          }
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

  // Debug: verificar quantas empresas têm dados históricos
  const companiesWithHistoricalData = companies.filter(c => c.historicalPrices && c.historicalPrices.length >= 20);
  console.log(`📈 Empresas com dados históricos suficientes: ${companiesWithHistoricalData.length}/${companies.length}`);

  // Converter para o formato CompanyData e calcular indicadores técnicos
  return companies.map(company => {
    let technicalAnalysis = undefined;

    // Calcular indicadores técnicos se houver dados históricos suficientes
    if (company.historicalPrices && company.historicalPrices.length >= 20) {
      // Filtrar dados válidos (sem valores zero)
      const validHistoricalData = company.historicalPrices.filter(data =>
        Number(data.high) > 0 &&
        Number(data.low) > 0 &&
        Number(data.close) > 0 &&
        Number(data.open) > 0
      );

      if (validHistoricalData.length >= 20) {
        const priceData: PriceData[] = validHistoricalData.map(data => ({
          date: data.date,
          open: Number(data.open),
          high: Number(data.high),
          low: Number(data.low),
          close: Number(data.close),
          volume: Number(data.volume)
        }));

        try {
          const technicalResult = TechnicalIndicators.calculateTechnicalAnalysis(priceData);
          
          // Verificar se os dados técnicos são válidos
          if (technicalResult.currentRSI && technicalResult.currentStochastic) {
            technicalAnalysis = {
              rsi: technicalResult.currentRSI.rsi,
              stochasticK: technicalResult.currentStochastic.k,
              stochasticD: technicalResult.currentStochastic.d,
              overallSignal: technicalResult.overallSignal
            };
          }
        } catch (error) {
          console.warn(`Erro ao calcular indicadores técnicos para ${company.ticker}:`, error);
        }
      }
    }

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
      logoUrl: company.logoUrl,
      financials: company.financialData[0] || {},
      technicalAnalysis
    };
  });
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
    case 'fundamentalist':
      return StrategyFactory.generateRational('fundamentalist', params as FundamentalistParams);
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
    if (model === 'fcd' || model === 'gordon' || model === 'fundamentalist' || model === 'ai') {
      if (!session?.user?.id) {
        const modelName = model === 'fcd' ? 'FCD' : model === 'gordon' ? 'Fórmula de Gordon' : model === 'fundamentalist' ? 'Fundamentalista 3+1' : 'Análise com IA';
        return NextResponse.json(
          { error: `Modelo ${modelName} exclusivo para usuários logados. Faça login para acessar.` },
          { status: 401 }
        );
      }

      // Buscar dados do usuário para verificar se é Premium - ÚNICA FONTE DA VERDADE
      const user = await getCurrentUser();

      if (!user?.isPremium) {
        const modelName = model === 'fcd' ? 'FCD' : model === 'gordon' ? 'Fórmula de Gordon' : model === 'fundamentalist' ? 'Fundamentalista 3+1' : 'Análise com IA';
        return NextResponse.json(
          { error: `Modelo ${modelName} exclusivo para usuários Premium. Faça upgrade para acessar análises avançadas.` },
          { status: 403 }
        );
      }
    }

    // Buscar dados de todas as empresas
    const companies = await getCompaniesData();
    
    // Debug: verificar quantas empresas têm dados técnicos
    const companiesWithTechnical = companies.filter(c => c.technicalAnalysis);
    console.log(`📊 Empresas carregadas: ${companies.length}, com dados técnicos: ${companiesWithTechnical.length}`);
    
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
      case 'fundamentalist':
        results = StrategyFactory.runFundamentalistRanking(companies, params as FundamentalistParams);
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
        // Usar o serviço centralizado para obter o usuário válido
        const currentUser = await getCurrentUser();
        
        if (currentUser?.id) {
          await safeTransaction('save-ranking-history', () =>
            prisma.rankingHistory.create({
              data: {
                userId: currentUser.id,
                model,
                params: JSON.parse(JSON.stringify(params)), // Conversão para Json type
                results: JSON.parse(JSON.stringify(results)), // Cache dos resultados como Json
                resultCount: results.length,
              }
            })
          );
        } else {
          console.warn('Usuário não encontrado pelo serviço centralizado');
        }
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