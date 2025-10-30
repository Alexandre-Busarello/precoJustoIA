import { NextRequest, NextResponse } from 'next/server';
import { prisma, safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';
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
  ScreeningParams,
  RankBuilderResult,
  CompanyData,
  toNumber
} from '@/lib/strategies';
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config';
import { TechnicalIndicators, type PriceData } from '@/lib/technical-indicators';

type ModelParams = GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams | FCDParams | GordonParams | FundamentalistParams | AIParams | ScreeningParams;

interface RankBuilderRequest {
  model: 'graham' | 'dividendYield' | 'lowPE' | 'magicFormula' | 'fcd' | 'gordon' | 'fundamentalist' | 'ai' | 'screening';
  params: ModelParams;
}

// Função para buscar dados de todas as empresas
async function getCompaniesData(): Promise<CompanyData[]> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4; // Últimos 5 anos para demonstrações
  
  const companies = await safeQueryWithParams('all-companies-data', () =>
    prisma.company.findMany({
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 8, // Dados atuais + até 7 anos históricos
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
        },
        // Incluir demonstrações financeiras para cálculo do Overall Score
        incomeStatements: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        balanceSheets: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        cashflowStatements: {
          where: {
            period: 'YEARLY',
            endDate: { gte: new Date(`${startYear}-01-01`) }
          },
          orderBy: { endDate: 'desc' },
          take: 7
        },
        // Incluir snapshots para filtrar por overall_score
        snapshots: {
          select: {
            overallScore: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 1
        }
      },
      where: {
        assetType: 'STOCK', // Filtrar apenas ações para o ranking
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
    }),
    {
      type: 'all-companies',
      startYear,
      currentYear
    }
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
        const priceData: PriceData[] = validHistoricalData.map((data: any) => ({
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

    // Preparar dados históricos financeiros (excluindo o primeiro que é o atual)
    const historicalFinancials = company.financialData.slice(1).map((data: any) => ({
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

    return {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      industry: company.industry,
      currentPrice: toNumber(company.dailyQuotes[0]?.price) || 0,
      logoUrl: company.logoUrl,
      financials: company.financialData[0] || {},
      historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined,
      technicalAnalysis,
      // Incluir demonstrações financeiras para cálculo do Overall Score
      incomeStatements: company.incomeStatements?.length > 0 ? company.incomeStatements : undefined,
      balanceSheets: company.balanceSheets?.length > 0 ? company.balanceSheets : undefined,
      cashflowStatements: company.cashflowStatements?.length > 0 ? company.cashflowStatements : undefined,
      // Overall Score do snapshot mais recente
      overallScore: company.snapshots && company.snapshots.length > 0 ? toNumber(company.snapshots[0].overallScore) : null
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
    case 'screening':
      return StrategyFactory.generateRational('screening', params as ScreeningParams);
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

    // Verificar restrições para o modelo Screening
    if (model === 'screening') {
      const user = session?.user?.id ? await getCurrentUser() : null;
      const isPremium = user?.isPremium || false;

      // Se não for Premium, limitar apenas aos parâmetros de Valuation
      if (!isPremium) {
        const screeningParams = params as ScreeningParams;
        
        // Limpar todos os filtros exceto Valuation
        const restrictedParams: ScreeningParams = {
          // Permitir apenas filtros de Valuation
          plFilter: screeningParams.plFilter,
          pvpFilter: screeningParams.pvpFilter,
          evEbitdaFilter: screeningParams.evEbitdaFilter,
          psrFilter: screeningParams.psrFilter,
          
          // Manter parâmetros básicos
          limit: screeningParams.limit || 20,
          companySize: screeningParams.companySize || 'all',
          useTechnicalAnalysis: false, // Desabilitar análise técnica para não-Premium
          
          // Remover todos os outros filtros (ficam undefined)
          roeFilter: undefined,
          roicFilter: undefined,
          roaFilter: undefined,
          margemLiquidaFilter: undefined,
          margemEbitdaFilter: undefined,
          cagrLucros5aFilter: undefined,
          cagrReceitas5aFilter: undefined,
          dyFilter: undefined,
          payoutFilter: undefined,
          dividaLiquidaPlFilter: undefined,
          liquidezCorrenteFilter: undefined,
          dividaLiquidaEbitdaFilter: undefined,
          marketCapFilter: undefined,
          overallScoreFilter: undefined,
          grahamUpsideFilter: undefined,
          selectedSectors: undefined,
          selectedIndustries: undefined,
        };
        
        // Substituir params com os parâmetros restritos
        body.params = restrictedParams;
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
      case 'screening':
        results = StrategyFactory.runScreeningRanking(companies, params as ScreeningParams);
        break;
      default:
        return NextResponse.json(
          { error: `Modelo '${model}' não suportado` },
          { status: 400 }
        );
    }

    // Enriquecer resultados com múltiplos upsides (Graham, FCD, Gordon)
    // Isso permite que o usuário veja diferentes perspectivas de valor justo
    if (results.length > 0 && session?.user?.id) {
      try {
        // Buscar status Premium do usuário
        const currentUser = await getCurrentUser();
        const userIsPremium = currentUser?.isPremium || false;
        
        results = results.map(result => {
          // Encontrar a empresa original
          const company = companies.find(c => c.ticker === result.ticker);
          if (!company) return result;
          
          const enrichedKeyMetrics = { ...(result.key_metrics || {}) };
          let mainUpside = result.upside;
          
          // Para estratégias sem preço justo, calcular o maior upside entre Graham, FCD e Gordon
          const strategiesWithFairValue = ['graham', 'fcd', 'gordon'];
          if (!strategiesWithFairValue.includes(model) && (mainUpside === null || mainUpside === undefined)) {
            const upsides: number[] = [];
            
            // Graham (sempre disponível)
            try {
              const grahamAnalysis = StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham);
              if (grahamAnalysis.upside !== null && grahamAnalysis.upside !== undefined) {
                upsides.push(grahamAnalysis.upside);
                enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
              }
            } catch (_) {
              // Ignorar erro
            }
            
            // FCD (se Premium)
            if (userIsPremium) {
              try {
                const fcdAnalysis = StrategyFactory.runFCDAnalysis(company, STRATEGY_CONFIG.fcd);
                if (fcdAnalysis.upside !== null && fcdAnalysis.upside !== undefined) {
                  upsides.push(fcdAnalysis.upside);
                  enrichedKeyMetrics.fcdUpside = fcdAnalysis.upside;
                }
              } catch (_) {
                // Ignorar erro
              }
            }
            
            // Gordon (se Premium)
            if (userIsPremium) {
              try {
                const gordonAnalysis = StrategyFactory.runGordonAnalysis(company, STRATEGY_CONFIG.gordon);
                if (gordonAnalysis.upside !== null && gordonAnalysis.upside !== undefined) {
                  upsides.push(gordonAnalysis.upside);
                  enrichedKeyMetrics.gordonUpside = gordonAnalysis.upside;
                }
              } catch (_) {
                // Ignorar erro
              }
            }
            
            // Usar o maior upside encontrado
            if (upsides.length > 0) {
              mainUpside = Math.max(...upsides);
            }
          } else {
            // Para estratégias com preço justo, apenas enriquecer os upsides adicionais
            
            // Calcular upside de Graham se ainda não tiver (disponível para todos)
            if (model !== 'graham' && (!enrichedKeyMetrics.grahamUpside || enrichedKeyMetrics.grahamUpside === null)) {
              try {
                const grahamAnalysis = StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham);
                if (grahamAnalysis.upside !== null && grahamAnalysis.upside !== undefined) {
                  enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }
            
            // Calcular upside de FCD se Premium e ainda não tiver
            if (model !== 'fcd' && userIsPremium && (!enrichedKeyMetrics.fcdUpside || enrichedKeyMetrics.fcdUpside === null)) {
              try {
                const fcdAnalysis = StrategyFactory.runFCDAnalysis(company, STRATEGY_CONFIG.fcd);
                if (fcdAnalysis.upside !== null && fcdAnalysis.upside !== undefined) {
                  enrichedKeyMetrics.fcdUpside = fcdAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }
            
            // Calcular upside de Gordon se Premium e ainda não tiver
            if (model !== 'gordon' && userIsPremium && (!enrichedKeyMetrics.gordonUpside || enrichedKeyMetrics.gordonUpside === null)) {
              try {
                const gordonAnalysis = StrategyFactory.runGordonAnalysis(company, STRATEGY_CONFIG.gordon);
                if (gordonAnalysis.upside !== null && gordonAnalysis.upside !== undefined) {
                  enrichedKeyMetrics.gordonUpside = gordonAnalysis.upside;
                }
              } catch (_) {
                // Silenciosamente ignorar erros
              }
            }
          }
          
          return {
            ...result,
            upside: mainUpside, // Atualizar upside principal se necessário
            key_metrics: enrichedKeyMetrics
          };
        });
      } catch (error) {
        console.warn('Erro ao enriquecer resultados com múltiplos upsides:', error);
        // Continuar com resultados originais se houver erro
      }
    }
    
    // Gerar racional para o modelo usado
    const rational = generateRational(model, params);

    // Salvar no histórico se o usuário estiver logado (COM transação pois é INSERT)
    if (session?.user?.id) {
      try {
        // Usar o serviço centralizado para obter o usuário válido
        const currentUser = await getCurrentUser();
        
        if (currentUser?.id) {
          await safeWrite('save-ranking-history', () =>
            prisma.rankingHistory.create({
              data: {
                userId: currentUser.id,
                model,
                params: JSON.parse(JSON.stringify(params)), // Conversão para Json type
                results: JSON.parse(JSON.stringify(results)), // Cache dos resultados como Json
                resultCount: results.length,
              }
            }),
            ['ranking_history', 'users']
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