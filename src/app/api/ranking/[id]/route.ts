import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { getCurrentUser } from '@/lib/user-service';
import { StrategyFactory, RankBuilderResult } from '@/lib/strategies';
import { STRATEGY_CONFIG } from '@/lib/strategies/strategy-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar o serviço centralizado para obter o usuário válido
    const currentUser = await getCurrentUser();
    
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do ranking é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o ranking específico do usuário
    const ranking = await safeQueryWithParams('get-ranking-by-id', () =>
      prisma.rankingHistory.findFirst({
        where: {
          id: id,
          userId: currentUser.id // Garantir que o ranking pertence ao usuário
        },
        select: {
          id: true,
          model: true,
          params: true,
          results: true,
          resultCount: true,
          createdAt: true,
        }
      }),
      {
        id: id,
        userId: currentUser.id
      }
    );

    if (!ranking) {
      return NextResponse.json(
        { error: 'Ranking não encontrado' },
        { status: 404 }
      );
    }

    // Função para obter nome amigável do modelo
    const getModelDisplayName = (model: string): string => {
      const modelNames: Record<string, string> = {
        'graham': 'Fórmula de Graham',
        'dividendYield': 'Anti-Dividend Trap',
        'lowPE': 'Baixo P/L',
        'magicFormula': 'Fórmula Mágica',
        'fcd': 'Fluxo de Caixa Descontado',
        'gordon': 'Fórmula de Gordon',
        'fundamentalist': 'Fundamentalista 3+1',
        'ai': 'Análise Preditiva com IA'
      };
      return modelNames[model] || model;
    };

    // Função para gerar descrição do histórico
    const generateHistoryDescription = (model: string, params: Record<string, unknown>): string => {
      switch (model) {
        case 'graham':
          return `Margem de segurança: ${params.marginOfSafety || 15}%`;
        case 'dividendYield':
          return `Yield mínimo: ${params.minYield || 6}%`;
        case 'lowPE':
          return `P/L máximo: ${params.maxPE || 15}`;
        case 'magicFormula':
          return `ROE mínimo: ${params.minROE || 15}%`;
        case 'fcd':
          return `Taxa de crescimento: ${params.growthRate || 5}%`;
        case 'gordon':
          return `Crescimento de dividendos: ${params.dividendGrowthRate || 5}%`;
        case 'fundamentalist':
          return `ROIC mín: ${params.minROIC || 10}%, Dívida/EBITDA máx: ${params.maxDebtToEbitda || 3}`;
        case 'ai':
          return `Tolerância ao risco: ${params.riskTolerance || 'moderado'}`;
        default:
          return 'Parâmetros personalizados';
      }
    };

    // Enriquecer resultados com múltiplos upsides se necessário
    let enrichedResults = ranking.results as unknown as RankBuilderResult[];

    // ETFs e FIIs têm estrutura própria — enriquecimento de ações não se aplica
    const isEtfModel = ranking.model.startsWith('etfs-');
    const isFiiModel = ranking.model === 'fiiDividendYield';

    // Verificar se os resultados precisam de enriquecimento
    // 1. Verificar se faltam upsides adicionais
    // 2. Verificar se faltam dados fundamentais básicos (para rankings antigos de IA)
    const needsEnrichment = !isEtfModel && !isFiiModel && enrichedResults.length > 0 && enrichedResults.some(r => {
      const hasGraham = r.key_metrics?.grahamUpside !== undefined && r.key_metrics?.grahamUpside !== null;
      const hasFcd = r.key_metrics?.fcdUpside !== undefined && r.key_metrics?.fcdUpside !== null;
      const hasGordon = r.key_metrics?.gordonUpside !== undefined && r.key_metrics?.gordonUpside !== null;
      const hasBasicData = r.key_metrics?.roe !== undefined || r.key_metrics?.roic !== undefined;
      
      // Precisa enriquecer se não tem upsides adicionais OU não tem dados fundamentais básicos
      return !hasGraham && !hasFcd && !hasGordon || !hasBasicData;
    });

    if (needsEnrichment) {
      try {
        console.log(`🔄 Enriquecendo ranking ${ranking.id} com dados fundamentais e múltiplos upsides...`);
        
        // Buscar dados das empresas para calcular upsides
        const tickers = enrichedResults.map(r => r.ticker);
        const companies = await prisma.company.findMany({
          where: {
            ticker: {
              in: tickers
            }
          },
          include: {
            financialData: {
              orderBy: { year: 'desc' },
              take: 8,
            },
            dailyQuotes: {
              orderBy: { date: 'desc' },
              take: 1,
            }
          }
        });

        // Mapear empresas para o formato CompanyData
        const companiesMap = new Map(
          companies.map(c => {
            const currentPrice = Number(c.dailyQuotes[0]?.price) || 0;
            const historicalFinancials = c.financialData.slice(1).map(data => ({
              year: data.year,
              roe: data.roe ? Number(data.roe) : null,
              roic: data.roic ? Number(data.roic) : null,
              pl: data.pl ? Number(data.pl) : null,
              pvp: data.pvp ? Number(data.pvp) : null,
              dy: data.dy ? Number(data.dy) : null,
              margemLiquida: data.margemLiquida ? Number(data.margemLiquida) : null,
              margemEbitda: data.margemEbitda ? Number(data.margemEbitda) : null,
              margemBruta: data.margemBruta ? Number(data.margemBruta) : null,
              liquidezCorrente: data.liquidezCorrente ? Number(data.liquidezCorrente) : null,
              liquidezRapida: data.liquidezRapida ? Number(data.liquidezRapida) : null,
              dividaLiquidaPl: data.dividaLiquidaPl ? Number(data.dividaLiquidaPl) : null,
              dividaLiquidaEbitda: data.dividaLiquidaEbitda ? Number(data.dividaLiquidaEbitda) : null,
              lpa: data.lpa ? Number(data.lpa) : null,
              vpa: data.vpa ? Number(data.vpa) : null,
              marketCap: data.marketCap ? Number(data.marketCap) : null,
              earningsYield: data.earningsYield ? Number(data.earningsYield) : null,
              evEbitda: data.evEbitda ? Number(data.evEbitda) : null,
              roa: data.roa ? Number(data.roa) : null,
              passivoAtivos: data.passivoAtivos ? Number(data.passivoAtivos) : null
            }));
            
            return [c.ticker, {
              ticker: c.ticker,
              name: c.name,
              sector: c.sector,
              industry: c.industry,
              currentPrice,
              logoUrl: c.logoUrl,
              financials: c.financialData[0] || {},
              historicalFinancials: historicalFinancials.length > 0 ? historicalFinancials : undefined
            }];
          })
        );

        // Enriquecer cada resultado
        const userIsPremium = currentUser?.isPremium || false;
        const model = ranking.model;
        
        enrichedResults = enrichedResults.map(result => {
          const company = companiesMap.get(result.ticker);
          if (!company) return result;
          
          const enrichedKeyMetrics = { ...(result.key_metrics || {}) };
          let mainUpside = result.upside;
          
          // Enriquecer com dados fundamentais básicos se não existirem
          // (Importante para rankings antigos de IA que não tinham esses dados)
          if (!enrichedKeyMetrics.roe || !enrichedKeyMetrics.roic) {
            const { financials } = company;
            
            // Função auxiliar para converter valores
            const toNumber = (value: unknown): number | null => {
              if (value === null || value === undefined) return null;
              if (typeof value === 'number') return value;
              if (typeof value === 'bigint') return Number(value);
              if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
              }
              // Para objetos Decimal do Prisma
              if (typeof value === 'object' && 'toNumber' in (value as object)) {
                return (value as { toNumber: () => number }).toNumber();
              }
              return null;
            };
            
            // Adicionar dados fundamentais básicos se não existirem
            if (enrichedKeyMetrics.pl === undefined) enrichedKeyMetrics.pl = toNumber(financials.pl);
            if (enrichedKeyMetrics.pvp === undefined) enrichedKeyMetrics.pvp = toNumber(financials.pvp);
            if (enrichedKeyMetrics.roe === undefined) enrichedKeyMetrics.roe = toNumber(financials.roe);
            if (enrichedKeyMetrics.roic === undefined) enrichedKeyMetrics.roic = toNumber(financials.roic);
            if (enrichedKeyMetrics.roa === undefined) enrichedKeyMetrics.roa = toNumber(financials.roa);
            if (enrichedKeyMetrics.dy === undefined) enrichedKeyMetrics.dy = toNumber(financials.dy);
            if (enrichedKeyMetrics.margemLiquida === undefined) enrichedKeyMetrics.margemLiquida = toNumber(financials.margemLiquida);
            if (enrichedKeyMetrics.margemEbitda === undefined) enrichedKeyMetrics.margemEbitda = toNumber(financials.margemEbitda);
            if (enrichedKeyMetrics.liquidezCorrente === undefined) enrichedKeyMetrics.liquidezCorrente = toNumber(financials.liquidezCorrente);
            if (enrichedKeyMetrics.dividaLiquidaPl === undefined) enrichedKeyMetrics.dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
            if (enrichedKeyMetrics.dividaLiquidaEbitda === undefined) enrichedKeyMetrics.dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
            if (enrichedKeyMetrics.marketCap === undefined) enrichedKeyMetrics.marketCap = toNumber(financials.marketCap);
            if (enrichedKeyMetrics.evEbitda === undefined) enrichedKeyMetrics.evEbitda = toNumber(financials.evEbitda);
            if (enrichedKeyMetrics.payout === undefined) enrichedKeyMetrics.payout = toNumber(financials.payout);
            if (enrichedKeyMetrics.earningsYield === undefined) enrichedKeyMetrics.earningsYield = toNumber(financials.earningsYield);
            if (enrichedKeyMetrics.crescimentoLucros === undefined) enrichedKeyMetrics.crescimentoLucros = toNumber(financials.crescimentoLucros);
            if (enrichedKeyMetrics.crescimentoReceitas === undefined) enrichedKeyMetrics.crescimentoReceitas = toNumber(financials.crescimentoReceitas);
          }
          
          // Se o upside principal está null, calcular baseado no modelo
          if (mainUpside === null || mainUpside === undefined) {
            try {
              // Apenas Graham, FCD e Gordon têm cálculo de preço justo
              const strategiesWithFairValue = ['graham', 'fcd', 'gordon'];
              
              if (strategiesWithFairValue.includes(model)) {
                // Calcular upside da própria estratégia
                let analysis;
                switch (model) {
                  case 'graham':
                    analysis = StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham);
                    break;
                  case 'fcd':
                    if (userIsPremium) {
                      analysis = StrategyFactory.runFCDAnalysis(company, STRATEGY_CONFIG.fcd);
                    }
                    break;
                  case 'gordon':
                    if (userIsPremium) {
                      analysis = StrategyFactory.runGordonAnalysis(company, STRATEGY_CONFIG.gordon);
                    }
                    break;
                }
                
                if (analysis && analysis.upside !== null && analysis.upside !== undefined) {
                  mainUpside = analysis.upside;
                }
              } else {
                // Para outras estratégias, usar o maior upside entre Graham, FCD e Gordon
                const upsides: number[] = [];
                
                // Graham (sempre disponível)
                try {
                  const grahamAnalysis = StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham);
                  if (grahamAnalysis.upside !== null && grahamAnalysis.upside !== undefined) {
                    upsides.push(grahamAnalysis.upside);
                  }
                } catch (e) {
                  // Ignorar erro
                }
                
                // FCD (se Premium)
                if (userIsPremium) {
                  try {
                    const fcdAnalysis = StrategyFactory.runFCDAnalysis(company, STRATEGY_CONFIG.fcd);
                    if (fcdAnalysis.upside !== null && fcdAnalysis.upside !== undefined) {
                      upsides.push(fcdAnalysis.upside);
                    }
                  } catch (e) {
                    // Ignorar erro
                  }
                }
                
                // Gordon (se Premium)
                if (userIsPremium) {
                  try {
                    const gordonAnalysis = StrategyFactory.runGordonAnalysis(company, STRATEGY_CONFIG.gordon);
                    if (gordonAnalysis.upside !== null && gordonAnalysis.upside !== undefined) {
                      upsides.push(gordonAnalysis.upside);
                    }
                  } catch (e) {
                    // Ignorar erro
                  }
                }
                
                // Usar o maior upside encontrado
                if (upsides.length > 0) {
                  mainUpside = Math.max(...upsides);
                }
              }
            } catch (e) {
              console.warn(`⚠️ Erro ao calcular upside principal para ${result.ticker}:`, e);
            }
          }
          
          // Calcular upside de Graham se ainda não tiver (disponível para todos)
          if (model !== 'graham' && (!enrichedKeyMetrics.grahamUpside || enrichedKeyMetrics.grahamUpside === null)) {
            try {
              const grahamAnalysis = StrategyFactory.runGrahamAnalysis(company, STRATEGY_CONFIG.graham);
              if (grahamAnalysis.upside !== null && grahamAnalysis.upside !== undefined) {
                enrichedKeyMetrics.grahamUpside = grahamAnalysis.upside;
              }
            } catch (e) {
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
            } catch (e) {
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
            } catch (e) {
              // Silenciosamente ignorar erros
            }
          }
          
          return {
            ...result,
            upside: mainUpside, // Atualizar upside principal
            key_metrics: enrichedKeyMetrics
          };
        });
        
        console.log(`✅ Ranking ${ranking.id} enriquecido com sucesso`);
      } catch (error) {
        console.warn('⚠️ Erro ao enriquecer ranking salvo:', error);
        // Continuar com resultados originais se houver erro
      }
    }

    // Formatar dados para resposta
    const formattedRanking = {
      id: ranking.id,
      model: ranking.model,
      params: ranking.params,
      results: enrichedResults,
      resultCount: ranking.resultCount,
      createdAt: ranking.createdAt,
      modelName: getModelDisplayName(ranking.model),
      description: generateHistoryDescription(ranking.model, ranking.params as Record<string, unknown>)
    };

    return NextResponse.json({
      ranking: formattedRanking
    });

  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
