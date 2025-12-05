/**
 * Index Screening Engine
 * 
 * Engine de screening e rebalanceamento de índices IPJ
 * Executa queries de screening baseadas no config JSON e decide rebalanceamentos
 */

import { prisma } from '@/lib/prisma';
import { calculateUpsideBatch, getAverageDailyVolumeBatch } from './index-strategy-integration';
import { executeCompanyAnalysis } from './company-analysis-service';
import { toNumber } from './strategies/base-strategy';

export interface IndexConfig {
  type?: string;
  universe?: string; // "B3"
  assetTypes?: ('STOCK' | 'BDR' | 'ETF' | 'FII' | 'INDEX' | 'OTHER')[]; // Tipos de ativos permitidos (ex: ['STOCK'], ['STOCK', 'BDR'], ['BDR'])
  excludedTickers?: string[]; // Lista de tickers específicos a excluir (ex: ["SOND5", "PETR6"])
  excludedTickerPatterns?: string[]; // Padrões de exclusão (ex: ["*5", "*6"] para excluir tickers terminados em 5 ou 6)
  liquidity?: {
    minAverageDailyVolume?: number; // Volume médio mínimo em R$
  };
  quality?: {
    roe?: { gte?: number; lte?: number };
    margemLiquida?: { gte?: number; lte?: number };
    dividaLiquidaEbitda?: { gte?: number; lte?: number };
    overallScore?: { gte?: number; lte?: number };
    payout?: { gte?: number; lte?: number };
    marketCap?: { gte?: number; lte?: number }; // Market Cap em R$ (ex: 1000000000 = R$ 1 bilhão)
    pl?: { gte?: number; lte?: number }; // P/L (Price to Earnings) - ex: { "lte": 15 } = P/L <= 15
    pvp?: { gte?: number; lte?: number }; // P/VP (Price to Book Value) - ex: { "lte": 2.0 } = P/VP <= 2.0
    strategy?: {
      type: 'graham' | 'fcd' | 'dividendYield' | 'lowPE' | 'magicFormula' | 'gordon' | 'fundamentalist' | 'barsi' | 'ai' | 'screening';
      params?: any; // Parâmetros específicos da estratégia
    };
    [key: string]: any; // Permitir outros filtros dinâmicos
  };
  selection?: {
    topN?: number; // Top N empresas
    orderBy?: 'upside' | 'dy' | 'overallScore' | 'marketCap' | 'technicalMargin' | string;
    orderDirection?: 'asc' | 'desc';
    scoreBands?: Array<{
      min: number; // Score mínimo (inclusive)
      max: number; // Score máximo (inclusive)
      maxCount: number; // Máximo de ativos nesta faixa
    }>; // Limites por faixa de score (ex: máximo 3 ativos com score 50-60)
  };
  weights?: {
    type?: 'equal' | 'marketCap' | 'overallScore' | 'custom';
    value?: number; // Para equal weight (ex: 0.10 = 10%)
    minWeight?: number; // Peso mínimo para score-based (ex: 0.02 = 2%)
    maxWeight?: number; // Peso máximo para score-based (ex: 0.15 = 15%)
    customWeights?: Record<string, number>; // Para custom: { "PETR4": 0.15, "VALE3": 0.10, ... }
  };
  rebalance?: {
    threshold?: number; // Threshold de upside para troca (ex: 0.05 = 5%)
    checkQuality?: boolean; // Verificar qualidade antes de trocar
    upsideType?: 'graham' | 'fcd' | 'gordon' | 'barsi' | 'technical' | 'best'; // Tipo de upside a usar no threshold (padrão: 'best' = melhor disponível)
  };
  diversification?: {
    type?: 'allocation' | 'maxCount'; // Tipo de diversificação
    sectorAllocation?: Record<string, number>; // Para allocation: { "Financeiro": 0.20, "Energia": 0.15, ... }
    maxCountPerSector?: Record<string, number>; // Para maxCount: { "Financeiro": 3, "Energia": 2, ... }
  };
  filters?: {
    minUpside?: number; // Upside mínimo em porcentagem (ex: 10 = 10%)
    requirePositiveUpside?: boolean; // Se true, filtra apenas empresas com upside > 0
    technicalFairValue?: {
      enabled: boolean; // Se true, habilita filtros de análise técnica
      requireBelowFairPrice?: boolean; // Se true, filtra empresas com preço atual <= aiFairEntryPrice
      requireAboveMinPrice?: boolean; // Se true, filtra empresas com preço atual >= aiMinPrice
    };
  };
}

export interface ScreeningCandidate {
  ticker: string;
  name: string;
  sector: string | null; // Setor da empresa
  currentPrice: number;
  upside: number | null; // Melhor upside disponível (compatibilidade)
  fairValueModel: string | null; // Modelo usado para calcular o melhor upside (GRAHAM, FCD, GORDON, BARSI, TECHNICAL)
  overallScore: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  averageDailyVolume: number | null;
  technicalMargin: number | null; // Margem técnica: diferença percentual entre preço atual e preço justo técnico ((currentPrice - aiFairEntryPrice) / aiFairEntryPrice * 100)
  // Upsides por tipo de estratégia
  upsides?: {
    graham: number | null;
    fcd: number | null;
    gordon: number | null;
    barsi: number | null;
    technical: number | null;
  };
  debug?: {
    scoreCalculationFailed: boolean;
    error?: string;
    hasStrategies?: boolean;
    availableStrategies?: string[];
    hasFinancialData?: boolean;
    hasPriceData?: boolean;
    companyId?: string;
  };
}

export interface CompositionChange {
  action: 'ENTRY' | 'EXIT';
  ticker: string;
  reason: string;
}

// Variável global temporária para armazenar informações detalhadas do último screening
let lastScreeningDetails: {
  candidatesBeforeSelection?: ScreeningCandidate[];
  removedByDiversification?: string[];
} = {};

/**
 * Retorna as informações detalhadas do último screening executado
 */
export function getLastScreeningDetails(): {
  candidatesBeforeSelection?: ScreeningCandidate[];
  removedByDiversification?: string[];
} {
  return { ...lastScreeningDetails };
}

/**
 * Executa screening baseado no config do índice
 */
export async function runScreening(
  indexDefinition: { id: string; config: any }
): Promise<ScreeningCandidate[]> {
  try {
    const config = indexDefinition.config as IndexConfig;

    // 1. Buscar empresas baseado no universo e tipos de ativos permitidos
    const whereClause: any = {};
    
    // Se assetTypes está especificado, usar ele (prioridade)
    if (config.assetTypes && config.assetTypes.length > 0) {
      whereClause.assetType = { in: config.assetTypes };
    } else if (config.universe === 'B3') {
      // Fallback: se universe é B3 e não há assetTypes especificado, usar apenas STOCK (comportamento padrão)
      whereClause.assetType = 'STOCK';
    }
    // Se não há universe nem assetTypes, buscar todos os tipos

    // Aplicar filtros básicos de qualidade diretamente na query
    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1
        }
      }
    });

    console.log(`📊 [SCREENING ENGINE] Found ${companies.length} companies in universe`);

    // 2. Aplicar exclusões de tickers
    let filteredCompanies = companies;
    
    if (config.excludedTickers && config.excludedTickers.length > 0) {
      const excludedSet = new Set(config.excludedTickers.map(t => t.toUpperCase()));
      const beforeExclusion = filteredCompanies.length;
      filteredCompanies = filteredCompanies.filter(c => !excludedSet.has(c.ticker.toUpperCase()));
      console.log(`🚫 [SCREENING ENGINE] Excluded ${beforeExclusion - filteredCompanies.length} tickers by specific list`);
    }
    
    if (config.excludedTickerPatterns && config.excludedTickerPatterns.length > 0) {
      const beforePatternExclusion = filteredCompanies.length;
      
      // Converter padrões em funções de teste
      const patternTests = config.excludedTickerPatterns.map(pattern => {
        if (pattern.startsWith('*')) {
          // Padrão "*5" ou "*6" - termina com o caractere após *
          const suffix = pattern.substring(1);
          return (ticker: string) => ticker.toUpperCase().endsWith(suffix.toUpperCase());
        } else if (pattern.endsWith('*')) {
          // Padrão "PET*" - começa com o prefixo antes de *
          const prefix = pattern.substring(0, pattern.length - 1);
          return (ticker: string) => ticker.toUpperCase().startsWith(prefix.toUpperCase());
        } else {
          // Padrão exato
          return (ticker: string) => ticker.toUpperCase() === pattern.toUpperCase();
        }
      });
      
      filteredCompanies = filteredCompanies.filter(c => {
        return !patternTests.some(test => test(c.ticker));
      });
      
      console.log(`🚫 [SCREENING ENGINE] Excluded ${beforePatternExclusion - filteredCompanies.length} tickers by patterns`);
    }
    
    console.log(`📊 [SCREENING ENGINE] ${filteredCompanies.length} companies after exclusions`);

    // 3. Filtrar empresas por critérios de qualidade básicos
    const initialCandidates: ScreeningCandidate[] = [];

    for (const company of filteredCompanies) {
      if (!company.financialData || company.financialData.length === 0) {
        continue;
      }

      const financials = company.financialData[0];

      // Verificar filtros de qualidade básicos
      if (config.quality) {
        let passesQuality = true;

        // ROE
        if (config.quality.roe) {
          const roe = toNumber(financials.roe);
          if (roe === null) {
            passesQuality = false;
          } else {
            if (config.quality.roe.gte !== undefined && roe < config.quality.roe.gte) {
              passesQuality = false;
            }
            if (config.quality.roe.lte !== undefined && roe > config.quality.roe.lte) {
              passesQuality = false;
            }
          }
        }

        // Margem Líquida
        if (config.quality.margemLiquida) {
          const margemLiquida = toNumber(financials.margemLiquida);
          if (margemLiquida === null) {
            passesQuality = false;
          } else {
            if (config.quality.margemLiquida.gte !== undefined && margemLiquida < config.quality.margemLiquida.gte) {
              passesQuality = false;
            }
            if (config.quality.margemLiquida.lte !== undefined && margemLiquida > config.quality.margemLiquida.lte) {
              passesQuality = false;
            }
          }
        }

        // Dívida Líquida / EBITDA
        if (config.quality.dividaLiquidaEbitda) {
          const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
          if (dividaLiquidaEbitda === null) {
            passesQuality = false;
          } else {
            if (config.quality.dividaLiquidaEbitda.gte !== undefined && dividaLiquidaEbitda < config.quality.dividaLiquidaEbitda.gte) {
              passesQuality = false;
            }
            if (config.quality.dividaLiquidaEbitda.lte !== undefined && dividaLiquidaEbitda > config.quality.dividaLiquidaEbitda.lte) {
              passesQuality = false;
            }
          }
        }

        // Payout
        if (config.quality.payout) {
          const payout = toNumber(financials.payout);
          if (payout === null) {
            passesQuality = false;
          } else {
            if (config.quality.payout.gte !== undefined && payout < config.quality.payout.gte) {
              passesQuality = false;
            }
            if (config.quality.payout.lte !== undefined && payout > config.quality.payout.lte) {
              passesQuality = false;
            }
          }
        }

        // Market Cap (em R$)
        if (config.quality.marketCap) {
          const marketCap = toNumber(financials.marketCap);
          if (marketCap === null) {
            passesQuality = false;
          } else {
            if (config.quality.marketCap.gte !== undefined && marketCap < config.quality.marketCap.gte) {
              passesQuality = false;
            }
            if (config.quality.marketCap.lte !== undefined && marketCap > config.quality.marketCap.lte) {
              passesQuality = false;
            }
          }
        }

        // P/L (Price to Earnings)
        if (config.quality.pl) {
          const pl = toNumber(financials.pl);
          if (pl === null) {
            passesQuality = false;
          } else {
            if (config.quality.pl.gte !== undefined && pl < config.quality.pl.gte) {
              passesQuality = false;
            }
            if (config.quality.pl.lte !== undefined && pl > config.quality.pl.lte) {
              passesQuality = false;
            }
          }
        }

        // P/VP (Price to Book Value)
        if (config.quality.pvp) {
          const pvp = toNumber(financials.pvp);
          if (pvp === null) {
            passesQuality = false;
          } else {
            if (config.quality.pvp.gte !== undefined && pvp < config.quality.pvp.gte) {
              passesQuality = false;
            }
            if (config.quality.pvp.lte !== undefined && pvp > config.quality.pvp.lte) {
              passesQuality = false;
            }
          }
        }

        if (!passesQuality) {
          continue;
        }
      }

      initialCandidates.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice: 0, // Será preenchido depois
        upside: null,
        fairValueModel: null,
        overallScore: null,
        dividendYield: toNumber(financials.dy) ? toNumber(financials.dy)! * 100 : null,
        marketCap: toNumber(financials.marketCap),
        averageDailyVolume: null,
        technicalMargin: null,
        upsides: {
          graham: null,
          fcd: null,
          gordon: null,
          barsi: null,
          technical: null
        },
        debug: undefined // Será preenchido durante cálculo do score
      });
    }

    console.log(`✅ [SCREENING ENGINE] ${initialCandidates.length} companies passed basic quality filters`);

    // 3. Buscar dados em batch para otimizar performance
    const tickers = initialCandidates.map(c => c.ticker);
    
    // Buscar preços em batch
    const { getLatestPrices } = await import('./quote-service');
    const prices = await getLatestPrices(tickers);
    
    // Buscar volumes em batch (se necessário)
    let volumes: Map<string, any> = new Map();
    let volumesAvailable = false;
    if (config.liquidity?.minAverageDailyVolume) {
      volumes = await getAverageDailyVolumeBatch(tickers, 30);
      volumesAvailable = volumes.size > 0;
      console.log(`📊 [SCREENING ENGINE] Volume data available for ${volumes.size}/${tickers.length} companies`);
    }

    // Buscar upside em batch
    const upsideData = await calculateUpsideBatch(tickers);

    // 4. Preencher dados e aplicar filtros finais
    let finalCandidates: ScreeningCandidate[] = [];

    for (const candidate of initialCandidates) {
      const priceData = prices.get(candidate.ticker);
      if (!priceData) {
        continue;
      }

      candidate.currentPrice = priceData.price;

      // Verificar liquidez
      if (config.liquidity?.minAverageDailyVolume) {
        const volume = volumes.get(candidate.ticker);
        
        // Se não temos dados de volume disponíveis para a maioria das empresas,
        // relaxar o filtro (assumir que empresas com dados financeiros têm liquidez mínima)
        if (!volumesAvailable || volumes.size < tickers.length * 0.3) {
          // Não aplicar filtro de liquidez se não temos dados suficientes
          // Apenas logar uma vez
          if (finalCandidates.length === 0 && candidate === initialCandidates[0]) {
            console.log(`    ⚠️ [SCREENING ENGINE] Volume data not available for most companies (${volumes.size}/${tickers.length}). Relaxing liquidity filter.`);
          }
          candidate.averageDailyVolume = volume?.averageDailyVolume || null;
        } else {
          // Aplicar filtro normalmente apenas se temos dados
          if (volume && volume.averageDailyVolume) {
            if (volume.averageDailyVolume < config.liquidity.minAverageDailyVolume) {
              // Log para debug apenas para primeiras empresas
              if (finalCandidates.length < 3) {
                console.log(`    ⚠️ ${candidate.ticker}: Volume insuficiente (R$ ${volume.averageDailyVolume.toFixed(0)} < R$ ${config.liquidity.minAverageDailyVolume.toFixed(0)})`);
              }
              continue;
            }
            candidate.averageDailyVolume = volume.averageDailyVolume;
          } else {
            // Se não temos dados de volume para esta empresa específica, mas temos para outras,
            // assumir que passa (pode ter liquidez mas não temos dados históricos)
            candidate.averageDailyVolume = null;
          }
        }
      } else {
        // Se não há filtro de liquidez, não precisa verificar
        candidate.averageDailyVolume = null;
      }

      // Preencher upside
      const upside = upsideData.get(candidate.ticker);
      if (upside) {
        candidate.upside = upside.upside;
        candidate.fairValueModel = upside.fairValueModel;
        candidate.dividendYield = upside.dividendYield;
        // Preencher upsides por tipo
        candidate.upsides = upside.upsides || {
          graham: null,
          fcd: null,
          gordon: null,
          barsi: null,
          technical: null
        };
      }

      // Aplicar filtro de upside positivo se configurado
      if (config.filters?.requirePositiveUpside) {
        if (candidate.upside === null || candidate.upside <= 0) {
          continue; // Excluir candidatos sem upside positivo
        }
      }

      // Aplicar filtro de upside mínimo se configurado
      if (config.filters?.minUpside !== undefined) {
        if (candidate.upside === null || candidate.upside < config.filters.minUpside) {
          continue; // Excluir candidatos com upside abaixo do mínimo
        }
      }

      finalCandidates.push(candidate);
    }

    console.log(`✅ [SCREENING ENGINE] ${finalCandidates.length} companies passed liquidity and upside filters`);

    // 5. Buscar scores do asset_snapshots primeiro (otimização de performance)
    const candidateTickers = finalCandidates.map(c => c.ticker);
    const companiesMapForScores = new Map<string, { id: number; ticker: string }>();
    
    // Buscar companyIds em batch
    const companiesForScores = await prisma.company.findMany({
      where: { ticker: { in: candidateTickers } },
      select: { id: true, ticker: true }
    });
    
    for (const company of companiesForScores) {
      companiesMapForScores.set(company.ticker, company);
    }
    
    const companyIdsForScores = Array.from(companiesMapForScores.values()).map(c => c.id);
    
    // Buscar scores mais recentes do asset_snapshots em batch
    const latestSnapshots = await prisma.assetSnapshot.findMany({
      where: {
        companyId: { in: companyIdsForScores },
        isLatest: true
      },
      select: {
        companyId: true,
        overallScore: true
      }
    });
    
    // Criar mapa de scores por companyId
    const scoresByCompanyId = new Map<number, number>();
    for (const snapshot of latestSnapshots) {
      scoresByCompanyId.set(snapshot.companyId, Number(snapshot.overallScore));
    }
    
    // Criar mapa de scores por ticker
    const scoresByTicker = new Map<string, number>();
    for (const [ticker, company] of companiesMapForScores.entries()) {
      const score = scoresByCompanyId.get(company.id);
      if (score !== undefined) {
        scoresByTicker.set(ticker, score);
      }
    }
    
    console.log(`📊 [SCREENING ENGINE] Found ${scoresByTicker.size}/${finalCandidates.length} scores in asset_snapshots`);
    
    // 6. Preencher scores do snapshot e identificar quais precisam recalcular
    const candidatesToRecalculate: ScreeningCandidate[] = [];
    
    for (const candidate of finalCandidates) {
      const snapshotScore = scoresByTicker.get(candidate.ticker);
      
      if (snapshotScore !== undefined) {
        // Usar score do snapshot
        candidate.overallScore = snapshotScore;
        
        // Verificar se precisa recalcular (se não passa no filtro)
        if (config.quality?.overallScore) {
          const needsRecalc = 
            (config.quality.overallScore.gte !== undefined && snapshotScore < config.quality.overallScore.gte) ||
            (config.quality.overallScore.lte !== undefined && snapshotScore > config.quality.overallScore.lte);
          
          if (needsRecalc) {
            // Score do snapshot não passa no filtro, precisa recalcular
            candidatesToRecalculate.push(candidate);
          }
        }
      } else {
        // Não tem score no snapshot, precisa calcular
        candidatesToRecalculate.push(candidate);
      }
    }
    
    console.log(`🔄 [SCREENING ENGINE] Recalculating scores for ${candidatesToRecalculate.length}/${finalCandidates.length} candidates`);
    
    // 7. Recalcular scores apenas para candidatos que precisam
    for (const candidate of candidatesToRecalculate) {
      try {
        const company = await prisma.company.findUnique({
          where: { ticker: candidate.ticker },
          include: {
            financialData: {
              orderBy: { year: 'desc' },
              take: 7
            }
          }
        });

        if (!company || !company.financialData || company.financialData.length === 0) {
          // Se não tem dados financeiros e há filtro de overallScore, remover
          if (config.quality?.overallScore) {
            candidate.debug = {
              scoreCalculationFailed: true,
              error: 'Sem dados financeiros disponíveis',
              hasFinancialData: false,
              hasPriceData: !!prices.get(candidate.ticker)
            };
            const index = finalCandidates.indexOf(candidate);
            if (index > -1) {
              finalCandidates.splice(index, 1);
            }
          }
          continue;
        }

        const priceData = prices.get(candidate.ticker);
        if (!priceData) {
          // Se não tem preço e há filtro de overallScore, remover
          if (config.quality?.overallScore) {
            candidate.debug = {
              scoreCalculationFailed: true,
              error: 'Sem dados de preço disponíveis',
              hasFinancialData: true,
              hasPriceData: false
            };
            const index = finalCandidates.indexOf(candidate);
            if (index > -1) {
              finalCandidates.splice(index, 1);
            }
          }
          continue;
        }

        const latestFinancials = company.financialData[0];
        
        // Buscar companyId para passar para executeCompanyAnalysis (necessário para análise do YouTube)
        const companyId = String(company.id);
        
        // Inicializar debug info
        candidate.debug = {
          scoreCalculationFailed: false,
          hasFinancialData: true,
          hasPriceData: true,
          companyId: companyId
        };
        
        const analysisResult = await executeCompanyAnalysis({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          currentPrice: priceData.price,
          financials: latestFinancials as any,
          historicalFinancials: company.financialData.map(fd => ({
            year: fd.year,
            roe: toNumber(fd.roe),
            roic: toNumber(fd.roic),
            pl: toNumber(fd.pl),
            pvp: toNumber(fd.pvp),
            dy: toNumber(fd.dy),
            margemLiquida: toNumber(fd.margemLiquida),
            margemEbitda: toNumber(fd.margemEbitda),
            margemBruta: toNumber(fd.margemBruta),
            liquidezCorrente: toNumber(fd.liquidezCorrente),
            liquidezRapida: toNumber(fd.liquidezRapida),
            dividaLiquidaPl: toNumber(fd.dividaLiquidaPl),
            dividaLiquidaEbitda: toNumber(fd.dividaLiquidaEbitda),
            lpa: toNumber(fd.lpa),
            vpa: toNumber(fd.vpa),
            marketCap: toNumber(fd.marketCap),
            earningsYield: toNumber(fd.earningsYield),
            evEbitda: toNumber(fd.evEbitda),
            roa: toNumber(fd.roa),
            passivoAtivos: toNumber(fd.passivoAtivos)
          }))
        }, {
          isLoggedIn: true, // Para índices, sempre usar análise completa
          isPremium: true, // Para índices, sempre usar análise completa
          includeStatements: true, // Sempre INCLUIR statements
          includeBreakdown: false,
          companyId: companyId // Passar companyId para permitir busca de análise do YouTube
        });

        // Verificar se overallScore foi calculado corretamente
        candidate.overallScore = analysisResult.overallScore?.score || null;
        
        if (candidate.overallScore === null) {
          // Sempre criar debug quando score é null
          if (!candidate.debug) {
            candidate.debug = {
              scoreCalculationFailed: true,
              hasFinancialData: true,
              hasPriceData: true,
              companyId: companyId
            };
          }
          
          candidate.debug.scoreCalculationFailed = true;
          candidate.debug.error = analysisResult.overallScore === null || analysisResult.overallScore === undefined
            ? 'executeCompanyAnalysis retornou overallScore null/undefined'
            : 'overallScore.score é null/undefined';
          
          // Verificar estratégias disponíveis
          if (analysisResult.strategies) {
            candidate.debug.hasStrategies = true;
            const strategies = analysisResult.strategies;
            candidate.debug.availableStrategies = Object.keys(strategies).filter(
              k => strategies[k as keyof typeof strategies] !== null
            );
          } else {
            candidate.debug.hasStrategies = false;
          }
        }
      } catch (error) {
        // Se falhar no cálculo, definir como null e adicionar debug
        candidate.overallScore = null;
        
        // Buscar company e priceData novamente para debug (se disponíveis)
        let hasFinancialData = false;
        let hasPriceData = false;
        let companyIdForDebug: string | undefined = undefined;
        
        try {
          const companyForDebug = await prisma.company.findUnique({
            where: { ticker: candidate.ticker },
            select: { id: true, financialData: { take: 1 } }
          });
          hasFinancialData = !!companyForDebug?.financialData?.length;
          companyIdForDebug = companyForDebug?.id ? String(companyForDebug.id) : undefined;
        } catch {
          // Ignorar erro ao buscar company para debug
        }
        
        const priceDataForDebug = prices.get(candidate.ticker);
        hasPriceData = !!priceDataForDebug;
        
        candidate.debug = {
          scoreCalculationFailed: true,
          error: error instanceof Error ? error.message : String(error),
          hasFinancialData,
          hasPriceData,
          companyId: companyIdForDebug
        };
      }

      // Verificar filtro de overall score FORA do try-catch para garantir que sempre seja executado
      if (config.quality?.overallScore) {
        if (candidate.overallScore === null) {
          // Garantir que debug existe antes de remover
          if (!candidate.debug) {
            candidate.debug = {
              scoreCalculationFailed: true,
              error: 'overallScore é null e candidato será removido pelo filtro',
              hasFinancialData: true,
              hasPriceData: true
            };
          }
          const index = finalCandidates.indexOf(candidate);
          if (index > -1) {
            finalCandidates.splice(index, 1);
          }
          continue;
        }
        if (config.quality.overallScore.gte !== undefined && candidate.overallScore < config.quality.overallScore.gte) {
          const index = finalCandidates.indexOf(candidate);
          if (index > -1) {
            finalCandidates.splice(index, 1);
          }
          continue;
        }
        if (config.quality.overallScore.lte !== undefined && candidate.overallScore > config.quality.overallScore.lte) {
          const index = finalCandidates.indexOf(candidate);
          if (index > -1) {
            finalCandidates.splice(index, 1);
          }
          continue;
        }
      }
    }

    console.log(`✅ [SCREENING ENGINE] ${finalCandidates.length} companies passed all filters`);
    
    // Log detalhado dos candidatos que passaram nos filtros (antes do ranking)
    if (finalCandidates.length > 0) {
      console.log(`📊 [SCREENING ENGINE] Top ${Math.min(15, finalCandidates.length)} candidatos após filtros (antes do ranking):`);
      finalCandidates.slice(0, 15).forEach((c, idx) => {
        const upside = c.upside !== null && c.upside !== undefined ? `${c.upside.toFixed(1)}%` : 'N/A';
        const score = c.overallScore !== null && c.overallScore !== undefined ? c.overallScore.toFixed(0) : 'N/A';
        const price = c.currentPrice ? `R$ ${c.currentPrice.toFixed(2)}` : 'N/A';
        console.log(`   ${idx + 1}. ${c.ticker} - Preço: ${price}, Upside: ${upside}, Score: ${score}, Setor: ${c.sector || 'N/A'}`);
      });
    }

    // 5.5. Buscar análises técnicas em batch se necessário
    let technicalAnalyses: Map<string, any> = new Map();
    if (config.filters?.technicalFairValue?.enabled) {
      console.log(`🔍 [SCREENING ENGINE] Fetching technical analyses for ${finalCandidates.length} candidates...`);
      const { getOrCalculateTechnicalAnalysis } = await import('./technical-analysis-service');
      
      // Buscar análises técnicas em paralelo (limitado para não sobrecarregar)
      const technicalPromises = finalCandidates.slice(0, 100).map(async (candidate) => {
        try {
          const analysis = await getOrCalculateTechnicalAnalysis(candidate.ticker, false, true);
          if (analysis) {
            technicalAnalyses.set(candidate.ticker, analysis);
          }
        } catch (error) {
          console.error(`⚠️ [SCREENING ENGINE] Error fetching technical analysis for ${candidate.ticker}:`, error);
        }
      });
      
      await Promise.all(technicalPromises);
      console.log(`✅ [SCREENING ENGINE] Technical analyses fetched for ${technicalAnalyses.size}/${finalCandidates.length} candidates`);
      
      // Aplicar filtros técnicos e calcular margem técnica
      const candidatesAfterTechnicalFilter: ScreeningCandidate[] = [];
      for (const candidate of finalCandidates) {
        const analysis = technicalAnalyses.get(candidate.ticker);
        
        // Se não há análise técnica disponível e o filtro está habilitado, excluir candidato
        if (!analysis && config.filters.technicalFairValue?.enabled) {
          // Se requireBelowFairPrice ou requireAboveMinPrice estão ativos, precisamos da análise
          if (config.filters.technicalFairValue.requireBelowFairPrice || config.filters.technicalFairValue.requireAboveMinPrice) {
            continue; // Excluir candidato sem análise técnica
          }
        }
        
        if (analysis) {
          const fairPrice = analysis.aiFairEntryPrice;
          const minPrice = analysis.aiMinPrice;
          
          // Calcular margem técnica
          if (fairPrice && candidate.currentPrice > 0) {
            candidate.technicalMargin = ((candidate.currentPrice - fairPrice) / fairPrice) * 100;
          }
          
          // Aplicar filtro de preço abaixo do justo técnico
          if (config.filters.technicalFairValue.requireBelowFairPrice) {
            if (!fairPrice || candidate.currentPrice > fairPrice) {
              continue; // Excluir candidatos com preço acima do justo técnico
            }
          }
          
          // Aplicar filtro de preço acima do mínimo técnico
          if (config.filters.technicalFairValue.requireAboveMinPrice) {
            if (!minPrice || candidate.currentPrice < minPrice) {
              continue; // Excluir candidatos com preço abaixo do mínimo técnico
            }
          }
        }
        
        candidatesAfterTechnicalFilter.push(candidate);
      }
      
      finalCandidates = candidatesAfterTechnicalFilter;
      console.log(`✅ [SCREENING ENGINE] ${finalCandidates.length} companies passed technical filters`);
    }

    // 6. Se uma estratégia foi especificada, executar ranking da estratégia
    let strategyRankedCandidates: ScreeningCandidate[] = finalCandidates;
    
    if (config.quality?.strategy?.type) {
      try {
        console.log(`🎯 [SCREENING ENGINE] Executing strategy ranking: ${config.quality.strategy.type}`);
        
        const { StrategyFactory } = await import('./strategies/strategy-factory');
        const { executeCompanyAnalysis } = await import('./company-analysis-service');
        
        // Preparar dados das empresas para a estratégia
        const companiesData: any[] = [];
        for (const candidate of finalCandidates) {
          const company = await prisma.company.findUnique({
            where: { ticker: candidate.ticker },
            include: {
              financialData: {
                orderBy: { year: 'desc' },
                take: 7
              }
            }
          });

          if (!company || !company.financialData || company.financialData.length === 0) {
            continue;
          }

          const priceData = prices.get(candidate.ticker);
          if (!priceData) continue;

          const latestFinancials = company.financialData[0];
          
          // Preparar dados no formato CompanyData
          companiesData.push({
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            industry: company.industry || null,
            currentPrice: priceData.price,
            logoUrl: company.logoUrl,
            financials: latestFinancials as any, // Já está no formato correto (aceita Decimal)
            historicalFinancials: company.financialData.map(fd => ({
              year: fd.year,
              roe: toNumber(fd.roe),
              roic: toNumber(fd.roic),
              pl: toNumber(fd.pl),
              pvp: toNumber(fd.pvp),
              dy: toNumber(fd.dy),
              margemLiquida: toNumber(fd.margemLiquida),
              margemEbitda: toNumber(fd.margemEbitda),
              margemBruta: toNumber(fd.margemBruta),
              liquidezCorrente: toNumber(fd.liquidezCorrente),
              liquidezRapida: toNumber(fd.liquidezRapida),
              dividaLiquidaPl: toNumber(fd.dividaLiquidaPl),
              dividaLiquidaEbitda: toNumber(fd.dividaLiquidaEbitda),
              lpa: toNumber(fd.lpa),
              vpa: toNumber(fd.vpa),
              marketCap: toNumber(fd.marketCap),
              earningsYield: toNumber(fd.earningsYield),
              evEbitda: toNumber(fd.evEbitda),
              roa: toNumber(fd.roa),
              passivoAtivos: toNumber(fd.passivoAtivos),
              cagrLucros5a: toNumber(fd.cagrLucros5a),
              cagrReceitas5a: toNumber(fd.cagrReceitas5a),
              payout: toNumber(fd.payout),
              crescimentoLucros: toNumber(fd.crescimentoLucros),
              crescimentoReceitas: toNumber(fd.crescimentoReceitas),
              fluxoCaixaOperacional: toNumber(fd.fluxoCaixaOperacional),
              fluxoCaixaLivre: toNumber(fd.fluxoCaixaLivre)
            }))
          });
        }

        // Executar ranking da estratégia
        const strategyType = config.quality.strategy.type as any;
        const strategyParams = config.quality.strategy.params || {};
        
        // Adicionar limite baseado no topN
        const topN = config.selection?.topN || 10;
        const strategyParamsWithLimit = {
          ...strategyParams,
          limit: topN * 2, // Buscar mais resultados para ter margem após remover duplicatas
          includeBDRs: config.universe !== 'B3',
          assetTypeFilter: config.universe === 'B3' ? 'b3' : 'both'
        };

        const rankingResults = await StrategyFactory.runRanking(
          strategyType,
          companiesData,
          strategyParamsWithLimit
        );

        // Converter resultados do ranking em ScreeningCandidate
        const strategyCandidatesMap = new Map<string, ScreeningCandidate>();
        
        for (const result of rankingResults) {
          const originalCandidate = finalCandidates.find(c => c.ticker === result.ticker);
          if (!originalCandidate) continue;

          // Determinar o modelo baseado no tipo da estratégia
          let fairValueModel: string | null = originalCandidate.fairValueModel;
          if (result.fairValueModel) {
            fairValueModel = result.fairValueModel;
          } else if (config.quality?.strategy?.type) {
            // Se não há fairValueModel no resultado, usar o tipo da estratégia
            const strategyType = config.quality.strategy.type.toUpperCase();
            fairValueModel = strategyType === 'GRAHAM' || strategyType === 'FCD' || strategyType === 'GORDON' || strategyType === 'BARSI' 
              ? strategyType 
              : null;
          }
          
          strategyCandidatesMap.set(result.ticker, {
            ...originalCandidate,
            upside: result.upside,
            fairValueModel: fairValueModel,
            overallScore: result.key_metrics?.overallScore || originalCandidate.overallScore,
            // Preservar upsides do candidato original
            upsides: originalCandidate.upsides || {
              graham: null,
              fcd: null,
              gordon: null,
              barsi: null,
              technical: null
            }
          });
        }

        // Manter apenas candidatos que apareceram no ranking da estratégia
        strategyRankedCandidates = Array.from(strategyCandidatesMap.values());
        
        console.log(`✅ [SCREENING ENGINE] Strategy ${config.quality.strategy.type} returned ${strategyRankedCandidates.length} ranked companies`);
        
        // Log detalhado do ranking da estratégia
        if (strategyRankedCandidates.length > 0) {
          console.log(`📊 [SCREENING ENGINE] Top ${Math.min(15, strategyRankedCandidates.length)} candidatos após ranking da estratégia:`);
          strategyRankedCandidates.slice(0, 15).forEach((c, idx) => {
            const upside = c.upside !== null && c.upside !== undefined ? `${c.upside.toFixed(1)}%` : 'N/A';
            const score = c.overallScore !== null && c.overallScore !== undefined ? c.overallScore.toFixed(0) : 'N/A';
            const price = c.currentPrice ? `R$ ${c.currentPrice.toFixed(2)}` : 'N/A';
            console.log(`   ${idx + 1}. ${c.ticker} - Preço: ${price}, Upside: ${upside}, Score: ${score}, Modelo: ${c.fairValueModel || 'N/A'}`);
          });
        }
      } catch (error) {
        console.error(`❌ [SCREENING ENGINE] Error executing strategy ranking:`, error);
        // Em caso de erro, continuar com ordenação padrão
        strategyRankedCandidates = finalCandidates;
      }
    }

    // 7. Ordenar por critério especificado (se não foi usado ranking de estratégia)
    if (!config.quality?.strategy?.type) {
      const orderBy = config.selection?.orderBy || 'upside';
      const orderDirection = config.selection?.orderDirection || 'desc';

      strategyRankedCandidates.sort((a, b) => {
        let aValue: number | null = null;
        let bValue: number | null = null;

        switch (orderBy) {
          case 'upside':
            aValue = a.upside;
            bValue = b.upside;
            break;
          case 'dy':
            aValue = a.dividendYield;
            bValue = b.dividendYield;
            break;
          case 'overallScore':
            aValue = a.overallScore;
            bValue = b.overallScore;
            break;
          case 'marketCap':
            aValue = a.marketCap;
            bValue = b.marketCap;
            break;
          case 'technicalMargin':
            aValue = a.technicalMargin;
            bValue = b.technicalMargin;
            break;
          default:
            aValue = a.upside;
            bValue = b.upside;
        }

        // Tratar nulls (colocar no final)
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        const diff = aValue - bValue;
        return orderDirection === 'desc' ? -diff : diff;
      });
    }

    // 8. Remover duplicatas de empresas (ex: BEES3 e BEES4 são da mesma empresa)
    // Extrair código base do ticker (ex: BEES3 -> BEES, PETR4 -> PETR)
    const getCompanyBase = (ticker: string): string => {
      // Remover últimos caracteres numéricos para obter o código base
      // Ex: BEES3 -> BEES, PETR4 -> PETR, VALE3 -> VALE
      return ticker.replace(/\d+$/, '').toUpperCase();
    };

    // Agrupar por empresa e manter apenas o melhor ticker de cada empresa
    const companyMap = new Map<string, ScreeningCandidate>();
    // Se há estratégia configurada, manter ordem original do ranking (primeiro que aparece)
    const hasStrategy = !!config.quality?.strategy?.type;
    
    for (const candidate of strategyRankedCandidates) {
      const companyBase = getCompanyBase(candidate.ticker);
      const existing = companyMap.get(companyBase);
      
      if (!existing) {
        companyMap.set(companyBase, candidate);
      } else {
        if (hasStrategy) {
          // Quando há estratégia, manter o primeiro que aparece (já está na ordem correta do ranking)
          // Não substituir, manter o que já está no mapa
        } else {
          // Quando não há estratégia, usar critério de ordenação configurado
          const orderBy = config.selection?.orderBy || 'upside';
          let existingValue: number | null = null;
          let candidateValue: number | null = null;

          switch (orderBy) {
            case 'upside':
              existingValue = existing.upside;
              candidateValue = candidate.upside;
              break;
            case 'dy':
              existingValue = existing.dividendYield;
              candidateValue = candidate.dividendYield;
              break;
            case 'overallScore':
              existingValue = existing.overallScore;
              candidateValue = candidate.overallScore;
              break;
            case 'marketCap':
              existingValue = existing.marketCap;
              candidateValue = candidate.marketCap;
              break;
            case 'technicalMargin':
              existingValue = existing.technicalMargin;
              candidateValue = candidate.technicalMargin;
              break;
          }

          const orderDirection = config.selection?.orderDirection || 'desc';
          const shouldReplace = 
            candidateValue !== null && 
            (existingValue === null || 
             (orderDirection === 'desc' && candidateValue > existingValue) ||
             (orderDirection === 'asc' && candidateValue < existingValue));

          if (shouldReplace) {
            companyMap.set(companyBase, candidate);
          }
        }
      }
    }

    // Preservar ordem original quando há estratégia configurada
    let uniqueCandidates: ScreeningCandidate[];
    if (hasStrategy) {
      // Manter ordem original do ranking da estratégia
      const seenCompanies = new Set<string>();
      uniqueCandidates = [];
      for (const candidate of strategyRankedCandidates) {
        const companyBase = getCompanyBase(candidate.ticker);
        if (!seenCompanies.has(companyBase)) {
          seenCompanies.add(companyBase);
          uniqueCandidates.push(candidate);
        }
      }
    } else {
      uniqueCandidates = Array.from(companyMap.values());
    }
    
    console.log(`🔄 [SCREENING ENGINE] Removed ${strategyRankedCandidates.length - uniqueCandidates.length} duplicate company tickers`);

    // Ordenar uniqueCandidates ANTES da seleção para garantir ordem consistente
    // MAS: quando há estratégia configurada, não reordenar (manter ordem original do ranking)
    if (!hasStrategy) {
      const orderBy = config.selection?.orderBy || 'upside';
      const orderDirection = config.selection?.orderDirection || 'desc';
      
      uniqueCandidates.sort((a, b) => {
        let aValue: number | null = null;
        let bValue: number | null = null;

        switch (orderBy) {
          case 'upside':
            aValue = a.upside;
            bValue = b.upside;
            break;
          case 'dy':
            aValue = a.dividendYield;
            bValue = b.dividendYield;
            break;
          case 'overallScore':
            aValue = a.overallScore;
            bValue = b.overallScore;
            break;
          case 'marketCap':
            aValue = a.marketCap;
            bValue = b.marketCap;
            break;
          case 'technicalMargin':
            aValue = a.technicalMargin;
            bValue = b.technicalMargin;
            break;
          default:
            aValue = a.upside;
            bValue = b.upside;
        }

        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        const diff = aValue - bValue;
        return orderDirection === 'desc' ? -diff : diff;
      });
    } else {
      const strategyType = config.quality?.strategy?.type || 'unknown';
      console.log(`📊 [SCREENING ENGINE] Preserving original strategy ranking order (${strategyType})`);
    }

    // 9. Aplicar limites por faixa de score (se especificado)
    let selected: ScreeningCandidate[] = [];
    
    if (config.selection?.scoreBands && config.selection.scoreBands.length > 0) {
      // Seleção por faixas de score
      const scoreBands = config.selection.scoreBands.sort((a, b) => b.min - a.min); // Ordenar por score decrescente
      const selectedByBand: ScreeningCandidate[] = [];
      const usedTickers = new Set<string>();
      
      for (const band of scoreBands) {
        const candidatesInBand = uniqueCandidates.filter(c => {
          if (usedTickers.has(c.ticker)) return false;
          const score = c.overallScore;
          if (score === null || score === undefined) return false;
          return score >= band.min && score <= band.max;
        });
        
        // Ordenar por critério de ordenação dentro da banda
        // MAS: quando há estratégia configurada, manter ordem original do ranking
        if (!hasStrategy) {
          const orderBy = config.selection?.orderBy || 'upside';
          const orderDirection = config.selection?.orderDirection || 'desc';
          
          candidatesInBand.sort((a, b) => {
            let aValue: number | null = null;
            let bValue: number | null = null;

            switch (orderBy) {
              case 'upside':
                aValue = a.upside;
                bValue = b.upside;
                break;
              case 'dy':
                aValue = a.dividendYield;
                bValue = b.dividendYield;
                break;
              case 'overallScore':
                aValue = a.overallScore;
                bValue = b.overallScore;
                break;
              case 'marketCap':
                aValue = a.marketCap;
                bValue = b.marketCap;
                break;
              case 'technicalMargin':
                aValue = a.technicalMargin;
                bValue = b.technicalMargin;
                break;
              default:
                aValue = a.upside;
                bValue = b.upside;
            }

            if (aValue === null && bValue === null) return 0;
            if (aValue === null) return 1;
            if (bValue === null) return -1;

            const diff = aValue - bValue;
            return orderDirection === 'desc' ? -diff : diff;
          });
        }
        
        // Selecionar até o máximo permitido para esta banda
        const selectedFromBand = candidatesInBand.slice(0, band.maxCount);
        selectedFromBand.forEach(c => {
          selectedByBand.push(c);
          usedTickers.add(c.ticker);
        });
        
        console.log(`📊 [SCREENING ENGINE] Score band [${band.min}-${band.max}]: Selected ${selectedFromBand.length}/${band.maxCount} max`);
      }
      
      selected = selectedByBand;
      
      // Se ainda há espaço e há um topN definido, preencher com os melhores restantes
      const topN = config.selection?.topN;
      if (topN && selected.length < topN) {
        const remaining = uniqueCandidates.filter(c => !usedTickers.has(c.ticker));
        
        // Ordenar apenas se não há estratégia configurada (manter ordem original quando há estratégia)
        const sortedRemaining = hasStrategy 
          ? remaining // Manter ordem original quando há estratégia
          : remaining.sort((a, b) => {
              const orderBy = config.selection?.orderBy || 'upside';
              const orderDirection = config.selection?.orderDirection || 'desc';
              
              let aValue: number | null = null;
              let bValue: number | null = null;

              switch (orderBy) {
                case 'upside':
                  aValue = a.upside;
                  bValue = b.upside;
                  break;
                case 'dy':
                  aValue = a.dividendYield;
                  bValue = b.dividendYield;
                  break;
                case 'overallScore':
                  aValue = a.overallScore;
                  bValue = b.overallScore;
                  break;
                case 'marketCap':
                  aValue = a.marketCap;
                  bValue = b.marketCap;
                  break;
                case 'technicalMargin':
                  aValue = a.technicalMargin;
                  bValue = b.technicalMargin;
                  break;
              }

              if (aValue === null && bValue === null) return 0;
              if (aValue === null) return 1;
              if (bValue === null) return -1;

              const diff = aValue - bValue;
              return orderDirection === 'desc' ? -diff : diff;
            });
        
        selected.push(...sortedRemaining.slice(0, topN - selected.length));
        
        selected.push(...remaining);
      }
    } else {
      // Seleção tradicional: top N
      const topN = config.selection?.topN || 10;
      selected = uniqueCandidates.slice(0, topN);
    }

    console.log(`🎯 [SCREENING ENGINE] Selected ${selected.length} companies${config.selection?.scoreBands ? ' using score bands' : ''}`);
    
    // Guardar candidatos ANTES da seleção (topN/scoreBands) para logs detalhados
    // Isso inclui todos os candidatos que passaram nos filtros mas podem não ter sido selecionados
    const candidatesBeforeSelection = [...uniqueCandidates];
    
    // Log detalhado dos candidatos selecionados antes da diversificação
    if (selected.length > 0) {
      console.log(`📊 [SCREENING ENGINE] Top ${Math.min(10, selected.length)} candidatos antes da diversificação:`);
      selected.slice(0, 10).forEach((c, idx) => {
        const upside = c.upside !== null && c.upside !== undefined ? `${c.upside.toFixed(1)}%` : 'N/A';
        const score = c.overallScore !== null && c.overallScore !== undefined ? c.overallScore.toFixed(0) : 'N/A';
        console.log(`   ${idx + 1}. ${c.ticker} - Upside: ${upside}, Score: ${score}, Setor: ${c.sector || 'N/A'}, Modelo: ${c.fairValueModel || 'N/A'}`);
      });
    }

    // Guardar candidatos antes da diversificação para identificar removidos por diversificação
    const candidatesBeforeDiversification = [...selected];
    
    // 10. Aplicar diversificação por setor (se especificado)
    let removedByDiversification: string[] = [];
    if (config.diversification) {
      const beforeDiversification = selected.length;
      const beforeTickers = new Set(selected.map(c => c.ticker));
      selected = applyDiversification(selected, config);
      const afterTickers = new Set(selected.map(c => c.ticker));
      removedByDiversification = Array.from(beforeTickers).filter(t => !afterTickers.has(t));
      
      console.log(`📊 [SCREENING ENGINE] After diversification: ${selected.length} companies (removed ${beforeDiversification - selected.length})`);
      if (removedByDiversification.length > 0) {
        console.log(`   Removidos por diversificação: ${removedByDiversification.join(', ')}`);
      }
    }

    // Garantir que candidatos com overallScore null tenham debug antes de retornar
    for (const candidate of selected) {
      if (candidate.overallScore === null && !candidate.debug) {
        candidate.debug = {
          scoreCalculationFailed: true,
          error: 'overallScore é null mas candidato não foi removido pelo filtro',
          hasFinancialData: true,
          hasPriceData: true
        };
      }
    }

    // Armazenar informações detalhadas para uso em compareComposition
    lastScreeningDetails = {
      candidatesBeforeSelection, // Candidatos que passaram nos filtros mas podem não ter sido selecionados
      removedByDiversification
    };
    
    // Retornar array diretamente para compatibilidade retroativa
    return selected;
  } catch (error) {
    console.error(`❌ [SCREENING ENGINE] Error running screening:`, error);
    return [];
  }
}

/**
 * Aplica regras de diversificação por setor
 */
function applyDiversification(
  candidates: ScreeningCandidate[],
  config: IndexConfig
): ScreeningCandidate[] {
  const diversification = config.diversification;
  if (!diversification) return candidates;

  const orderBy = config.selection?.orderBy || 'upside';
  const orderDirection = config.selection?.orderDirection || 'desc';

  // Função auxiliar para ordenar candidatos
  const sortCandidates = (cands: ScreeningCandidate[]) => {
    return cands.sort((a, b) => {
      let aValue: number | null = null;
      let bValue: number | null = null;

      switch (orderBy) {
        case 'upside':
          aValue = a.upside;
          bValue = b.upside;
          break;
        case 'dy':
          aValue = a.dividendYield;
          bValue = b.dividendYield;
          break;
        case 'overallScore':
          aValue = a.overallScore;
          bValue = b.overallScore;
          break;
        case 'marketCap':
          aValue = a.marketCap;
          bValue = b.marketCap;
          break;
        case 'technicalMargin':
          aValue = a.technicalMargin;
          bValue = b.technicalMargin;
          break;
        default:
          aValue = a.upside;
          bValue = b.upside;
      }

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const diff = aValue - bValue;
      return orderDirection === 'desc' ? -diff : diff;
    });
  };

  if (diversification.type === 'maxCount') {
    // Diversificação por quantidade máxima por setor
    const maxCountPerSector = diversification.maxCountPerSector || {};
    const selected: ScreeningCandidate[] = [];
    const sectorCounts = new Map<string, number>();
    
    // Se maxCountPerSector está vazio, aplicar limite padrão de 4 para todos os setores
    const hasSpecificLimits = Object.keys(maxCountPerSector).length > 0;
    const defaultMaxCount = hasSpecificLimits ? undefined : 4;

    // Ordenar todos os candidatos primeiro
    const sortedCandidates = sortCandidates([...candidates]);

    for (const candidate of sortedCandidates) {
      const sector = candidate.sector || 'Outros';
      const currentCount = sectorCounts.get(sector) || 0;
      
      // Determinar o limite máximo para este setor
      let maxCount: number | undefined;
      if (hasSpecificLimits) {
        // Se há limites específicos definidos, usar apenas os especificados
        maxCount = maxCountPerSector[sector];
      } else {
        // Se não há limites específicos, aplicar limite padrão para todos
        maxCount = defaultMaxCount;
      }

      if (maxCount === undefined) {
        // Setor não tem limite, adicionar normalmente
        selected.push(candidate);
      } else if (currentCount < maxCount) {
        // Ainda há espaço para este setor
        selected.push(candidate);
        sectorCounts.set(sector, currentCount + 1);
      }
      // Se já atingiu o limite, não adiciona
    }

    console.log(`📊 [DIVERSIFICATION] Max count per sector applied:`);
    sectorCounts.forEach((count, sector) => {
      const maxCount = maxCountPerSector[sector];
      console.log(`   - ${sector}: ${count}/${maxCount || 'unlimited'}`);
    });

    return selected;
  } else if (diversification.type === 'allocation' && diversification.sectorAllocation) {
    // Diversificação por alocação percentual por setor
    const sectorAllocation = diversification.sectorAllocation;
    const totalAllocation = Object.values(sectorAllocation).reduce((sum, val) => sum + val, 0);
    
    if (totalAllocation > 1.0) {
      console.warn(`⚠️ [DIVERSIFICATION] Total allocation exceeds 100% (${(totalAllocation * 100).toFixed(1)}%). Normalizing...`);
      // Normalizar
      Object.keys(sectorAllocation).forEach(sector => {
        sectorAllocation[sector] = sectorAllocation[sector] / totalAllocation;
      });
    }

    const selected: ScreeningCandidate[] = [];
    const sectorWeights = new Map<string, number>();
    const sectorCandidates = new Map<string, ScreeningCandidate[]>();

    // Agrupar candidatos por setor
    for (const candidate of candidates) {
      const sector = candidate.sector || 'Outros';
      if (!sectorCandidates.has(sector)) {
        sectorCandidates.set(sector, []);
      }
      sectorCandidates.get(sector)!.push(candidate);
    }

    // Ordenar candidatos dentro de cada setor
    sectorCandidates.forEach((cands, sector) => {
      sectorCandidates.set(sector, sortCandidates(cands));
    });

    // Calcular quantos ativos de cada setor precisamos (baseado na alocação)
    const topN = config.selection?.topN || 10;
    const sectorTargets = new Map<string, number>();

    sectorCandidates.forEach((cands, sector) => {
      const allocation = sectorAllocation[sector] || 0;
      if (allocation > 0 && cands.length > 0) {
        // Calcular quantos ativos precisamos para atingir a alocação
        // Assumindo equal weight dentro do setor
        const targetCount = Math.ceil(topN * allocation);
        sectorTargets.set(sector, Math.min(targetCount, cands.length));
      }
    });

    // Selecionar ativos de cada setor
    sectorTargets.forEach((targetCount, sector) => {
      const cands = sectorCandidates.get(sector) || [];
      const selectedFromSector = cands.slice(0, targetCount);
      selected.push(...selectedFromSector);
      sectorWeights.set(sector, selectedFromSector.length / topN);
    });

    // Se ainda há espaço, preencher com os melhores restantes (sem limite de setor)
    if (selected.length < topN) {
      const usedTickers = new Set(selected.map(c => c.ticker));
      const remaining = sortCandidates(
        candidates.filter(c => !usedTickers.has(c.ticker))
      ).slice(0, topN - selected.length);
      selected.push(...remaining);
    }

    console.log(`📊 [DIVERSIFICATION] Sector allocation applied:`);
    sectorWeights.forEach((weight, sector) => {
      console.log(`   - ${sector}: ${(weight * 100).toFixed(1)}%`);
    });

    return selected.slice(0, topN);
  }

  // Se não há tipo válido, retornar sem alterações
  return candidates;
}

/**
 * Obtém o upside correto baseado no tipo especificado no config
 * Se não especificado ou 'best', retorna o melhor disponível
 */
function getUpsideForRebalance(
  candidate: ScreeningCandidate,
  upsideType?: 'graham' | 'fcd' | 'gordon' | 'barsi' | 'technical' | 'best'
): number | null {
  // Se não há upsides por tipo, usar o upside padrão (compatibilidade)
  if (!candidate.upsides) {
    return candidate.upside;
  }

  // Se não especificado ou 'best', retornar o melhor disponível
  if (!upsideType || upsideType === 'best') {
    const allUpsides = [
      candidate.upsides.graham,
      candidate.upsides.fcd,
      candidate.upsides.gordon,
      candidate.upsides.barsi,
      candidate.upsides.technical
    ].filter(u => u !== null && u !== undefined) as number[];

    if (allUpsides.length === 0) {
      return candidate.upside; // Fallback para upside padrão
    }

    return Math.max(...allUpsides);
  }

  // Retornar o upside do tipo especificado
  switch (upsideType) {
    case 'graham':
      return candidate.upsides.graham ?? candidate.upside;
    case 'fcd':
      return candidate.upsides.fcd ?? candidate.upside;
    case 'gordon':
      return candidate.upsides.gordon ?? candidate.upside;
    case 'barsi':
      return candidate.upsides.barsi ?? candidate.upside;
    case 'technical':
      return candidate.upsides.technical ?? candidate.upside;
    default:
      return candidate.upside;
  }
}

/**
 * Compara composição atual com resultado ideal do screening
 */
export function compareComposition(
  current: Array<{ assetTicker: string }>,
  ideal: ScreeningCandidate[],
  config?: IndexConfig,
  qualityRejected?: Array<{ candidate: ScreeningCandidate; reason: string }>,
  screeningRejected?: Array<{ ticker: string; reason: string }>,
  candidatesBeforeSelection?: ScreeningCandidate[], // Candidatos que passaram nos filtros mas não foram selecionados
  removedByDiversification?: string[] // Tickers removidos por diversificação
): CompositionChange[] {
  // Se não foram fornecidos, tentar usar informações do último screening
  if (!candidatesBeforeSelection && lastScreeningDetails.candidatesBeforeSelection) {
    candidatesBeforeSelection = lastScreeningDetails.candidatesBeforeSelection;
  }
  if (!removedByDiversification && lastScreeningDetails.removedByDiversification) {
    removedByDiversification = lastScreeningDetails.removedByDiversification;
  }
  const changes: CompositionChange[] = [];
  const currentTickers = new Set(current.map(c => c.assetTicker));
  const idealTickers = new Set(ideal.map(c => c.ticker));
  
  // Criar mapas para busca rápida de motivos
  const qualityRejectedMap = new Map<string, string>();
  if (qualityRejected) {
    qualityRejected.forEach(r => qualityRejectedMap.set(r.candidate.ticker, r.reason));
  }
  
  const screeningRejectedMap = new Map<string, string>();
  if (screeningRejected) {
    screeningRejected.forEach(r => screeningRejectedMap.set(r.ticker, r.reason));
  }

  // Criar mapa de posições no ranking ideal (para logs mais detalhados)
  const idealRankingMap = new Map<string, number>();
  ideal.forEach((candidate, index) => {
    idealRankingMap.set(candidate.ticker, index + 1);
  });

  // Criar mapa de setores para análise de diversificação
  const sectorMap = new Map<string, string>();
  ideal.forEach(candidate => {
    sectorMap.set(candidate.ticker, candidate.sector || 'Outros');
  });

  // Criar mapa de candidatos que passaram nos filtros mas não foram selecionados
  const candidatesBeforeSelectionMap = new Map<string, ScreeningCandidate>();
  if (candidatesBeforeSelection) {
    candidatesBeforeSelection.forEach(c => {
      candidatesBeforeSelectionMap.set(c.ticker, c);
    });
  }

  // Criar set de tickers removidos por diversificação
  const removedByDiversificationSet = new Set<string>();
  if (removedByDiversification) {
    removedByDiversification.forEach(ticker => removedByDiversificationSet.add(ticker));
  }

  // Analisar diversificação para identificar setores acima do limite
  const sectorCounts = new Map<string, number>();
  ideal.forEach(candidate => {
    const sector = candidate.sector || 'Outros';
    sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
  });

  // Identificar saídas (ativos que estão na composição atual mas não no ideal)
  for (const comp of current) {
    if (!idealTickers.has(comp.assetTicker)) {
      let reason = 'Ativo removido: ';
      
      // Verificar se foi rejeitado por qualidade
      if (qualityRejectedMap.has(comp.assetTicker)) {
        reason += `não passou na validação de qualidade (${qualityRejectedMap.get(comp.assetTicker)})`;
      }
      // Verificar se foi rejeitado no screening (não passou nos filtros)
      else if (screeningRejectedMap.has(comp.assetTicker)) {
        reason += screeningRejectedMap.get(comp.assetTicker) || 'não passou nos filtros do screening';
      }
      // Verificar se foi removido por diversificação
      else if (removedByDiversificationSet.has(comp.assetTicker)) {
        const tickerSector = sectorMap.get(comp.assetTicker) || candidatesBeforeSelectionMap.get(comp.assetTicker)?.sector || 'Outros';
        const sectorCount = sectorCounts.get(tickerSector) || 0;
        const maxCountPerSector = config?.diversification?.maxCountPerSector || {};
        const maxCount = maxCountPerSector[tickerSector] || (Object.keys(maxCountPerSector).length === 0 ? 4 : undefined);
        
        if (maxCount !== undefined) {
          reason += `removido por diversificação (setor "${tickerSector}" com ${sectorCount} ativos selecionados, limite: ${maxCount} por setor)`;
        } else {
          reason += `removido por regras de diversificação (setor "${tickerSector}")`;
        }
      }
      // Verificar se passou nos filtros mas não foi selecionado (selection ou scoreBands)
      else if (candidatesBeforeSelectionMap.has(comp.assetTicker)) {
        const candidate = candidatesBeforeSelectionMap.get(comp.assetTicker)!;
        const topN = config?.selection?.topN;
        const scoreBands = config?.selection?.scoreBands;
        const candidateScore = candidate.overallScore;
        
        if (scoreBands && scoreBands.length > 0) {
          // Verificar em qual banda o ativo deveria estar
          const matchingBand = scoreBands.find(band => 
            candidateScore !== null && candidateScore !== undefined &&
            candidateScore >= band.min && candidateScore <= band.max
          );
          
          if (matchingBand) {
            // Contar quantos ativos já estão nesta banda no ideal
            const countInBand = ideal.filter(c => {
              const score = c.overallScore;
              return score !== null && score !== undefined && 
                     score >= matchingBand.min && score <= matchingBand.max;
            }).length;
            
            reason += `não está dentro da faixa de score [${matchingBand.min}-${matchingBand.max}] (Score: ${candidateScore?.toFixed(0) || 'N/A'}, ${countInBand}/${matchingBand.maxCount} ativos já selecionados nesta faixa)`;
          } else {
            reason += `não está dentro das faixas de score configuradas (Score: ${candidateScore?.toFixed(0) || 'N/A'})`;
          }
        } else if (topN) {
          // Encontrar posição do candidato no ranking antes da seleção
          const allCandidatesBeforeSelection = Array.from(candidatesBeforeSelectionMap.values());
          const orderBy = config?.selection?.orderBy || 'upside';
          const orderDirection = config?.selection?.orderDirection || 'desc';
          
          // Ordenar como foi ordenado antes da seleção
          allCandidatesBeforeSelection.sort((a, b) => {
            let aValue: number | null = null;
            let bValue: number | null = null;

            switch (orderBy) {
              case 'upside':
                aValue = a.upside;
                bValue = b.upside;
                break;
              case 'dy':
                aValue = a.dividendYield;
                bValue = b.dividendYield;
                break;
              case 'overallScore':
                aValue = a.overallScore;
                bValue = b.overallScore;
                break;
              case 'marketCap':
                aValue = a.marketCap;
                bValue = b.marketCap;
                break;
              case 'technicalMargin':
                aValue = a.technicalMargin;
                bValue = b.technicalMargin;
                break;
            }

            if (aValue === null && bValue === null) return 0;
            if (aValue === null) return 1;
            if (bValue === null) return -1;

            const diff = aValue - bValue;
            return orderDirection === 'desc' ? -diff : diff;
          });
          
          const position = allCandidatesBeforeSelection.findIndex(c => c.ticker === comp.assetTicker) + 1;
          
          if (position > topN) {
            reason += `não está entre os top ${topN} selecionados (posição ${position} no ranking por ${orderBy})`;
          } else {
            reason += `não está entre os top ${topN} selecionados (posição ${position}/${topN})`;
          }
        } else {
          reason += 'passou nos filtros mas não foi selecionado pelo critério de seleção configurado';
        }
      }
      // Se não está em nenhum dos mapas acima, tentar inferir o motivo
      else {
        // Tentar inferir motivo comparando com os ativos selecionados
        const topN = config?.selection?.topN;
        const scoreBands = config?.selection?.scoreBands;
        
        if (scoreBands && scoreBands.length > 0) {
          // Se usa scoreBands, provavelmente não está dentro das faixas
          reason += 'não está dentro das faixas de score configuradas (não passou nos filtros ou não está nas faixas permitidas)';
        } else if (topN) {
          // Se usa topN, provavelmente não está entre os top N
          reason += `não está entre os top ${topN} selecionados (não passou nos filtros ou ranking insuficiente)`;
        } else if (config?.diversification) {
          // Se tem diversificação, pode ter sido removido por diversificação
          reason += 'não passou nos filtros do screening ou foi removido por diversificação';
        } else {
          reason += 'não passou nos filtros do screening (não atende aos critérios configurados)';
        }
      }
      
      changes.push({
        action: 'EXIT',
        ticker: comp.assetTicker,
        reason
      });
    }
  }

  // Identificar entradas (ativos que estão no ideal mas não na composição atual)
  ideal.forEach((candidate, index) => {
    if (!currentTickers.has(candidate.ticker)) {
      const position = index + 1;
      let reason = `Ativo adicionado: selecionado pelo screening`;
      
      // Adicionar posição no ranking
      reason += ` (posição ${position}/${ideal.length}`;
      
      // Adicionar informações sobre o modelo usado
      if (candidate.fairValueModel) {
        reason += `, Modelo: ${candidate.fairValueModel}`;
      }
      
      if (candidate.upside !== null && candidate.upside !== undefined) {
        reason += `, Upside: ${candidate.upside.toFixed(1)}%`;
      }
      if (candidate.overallScore !== null && candidate.overallScore !== undefined) {
        reason += `, Score: ${candidate.overallScore.toFixed(0)}`;
      }
      if (candidate.technicalMargin !== null && candidate.technicalMargin !== undefined) {
        reason += `, Margem técnica: ${candidate.technicalMargin.toFixed(1)}%`;
      }
      
      reason += ')';
      
      // Verificar se foi adicionado por threshold
      if (config?.rebalance?.threshold && current.length > 0) {
        const currentInIdeal = ideal.filter(c => currentTickers.has(c.ticker));
        if (currentInIdeal.length > 0) {
          const lastCurrentUpside = getUpsideForRebalance(currentInIdeal[currentInIdeal.length - 1], config.rebalance?.upsideType);
          const newUpside = getUpsideForRebalance(candidate, config.rebalance?.upsideType);
          if (newUpside !== null && lastCurrentUpside !== null) {
            const upsideDiff = newUpside - lastCurrentUpside;
            if (upsideDiff > (config.rebalance.threshold * 100)) {
              reason += ` - adicionado por threshold (${upsideDiff.toFixed(1)}% superior ao último da lista)`;
            }
          }
        }
      }
      
      // Verificar se foi adicionado por scoreBands
      if (config?.selection?.scoreBands && candidate.overallScore !== null && candidate.overallScore !== undefined) {
        const matchingBand = config.selection.scoreBands.find(band => 
          candidate.overallScore! >= band.min && candidate.overallScore! <= band.max
        );
        if (matchingBand) {
          reason += ` - dentro da faixa de score [${matchingBand.min}-${matchingBand.max}]`;
        }
      }
      
      changes.push({
        action: 'ENTRY',
        ticker: candidate.ticker,
        reason
      });
    }
  });

  return changes;
}

/**
 * Gera motivo detalhado do rebalanceamento baseado na análise de mudanças
 */
export function generateRebalanceReason(
  current: Array<{ assetTicker: string }>,
  ideal: ScreeningCandidate[],
  threshold: number,
  hasQualityFilter: boolean,
  upsideType?: 'graham' | 'fcd' | 'gordon' | 'barsi' | 'technical' | 'best',
  config?: IndexConfig,
  qualityRejected?: Array<{ candidate: ScreeningCandidate; reason: string }>
): string {
  const currentTickers = new Set(current.map(c => c.assetTicker));
  const idealTickers = new Set(ideal.map(c => c.ticker));
  
  const exits = Array.from(currentTickers).filter(t => !idealTickers.has(t));
  const entries = ideal.filter(c => !currentTickers.has(c.ticker));
  
  const reasons: string[] = [];
  
  // Motivo 1: Mudança na composição
  if (exits.length > 0 || entries.length > 0) {
    if (exits.length > 0 && entries.length > 0) {
      reasons.push(`${exits.length} ativo(s) removido(s) e ${entries.length} ativo(s) adicionado(s)`);
    } else if (exits.length > 0) {
      reasons.push(`${exits.length} ativo(s) removido(s) da composição`);
    } else if (entries.length > 0) {
      reasons.push(`${entries.length} ativo(s) adicionado(s) à composição`);
    }
  }
  
  // Motivo 2: Threshold de upside atingido
  if (entries.length > 0 && current.length > 0) {
    const currentInIdeal = ideal.filter(c => currentTickers.has(c.ticker));
    if (currentInIdeal.length > 0) {
      const lastCurrentUpside = getUpsideForRebalance(currentInIdeal[currentInIdeal.length - 1], upsideType);
      const firstNewUpside = getUpsideForRebalance(entries[0], upsideType);
      
      if (firstNewUpside !== null && firstNewUpside !== undefined && lastCurrentUpside !== null) {
        const upsideDiff = firstNewUpside - lastCurrentUpside;
        if (upsideDiff > threshold * 100) {
          const upsideTypeLabel = upsideType && upsideType !== 'best' 
            ? ` (${upsideType === 'fcd' ? 'FCD' : upsideType === 'technical' ? 'Análise Técnica' : upsideType.charAt(0).toUpperCase() + upsideType.slice(1)})`
            : '';
          reasons.push(`novo ativo com upside${upsideTypeLabel} ${upsideDiff.toFixed(1)}% superior ao último da lista atual (threshold: ${(threshold * 100).toFixed(0)}%)`);
        }
      }
    }
  }
  
  // Motivo 3: Filtro de qualidade (mais específico)
  if (hasQualityFilter && exits.length > 0 && qualityRejected && qualityRejected.length > 0) {
    const rejectedFromCurrent = qualityRejected.filter(r => currentTickers.has(r.candidate.ticker));
    if (rejectedFromCurrent.length > 0) {
      reasons.push(`${rejectedFromCurrent.length} ativo(s) removido(s) por não passar na validação de qualidade`);
    }
  }
  
  // Motivo 4: Selection (topN ou scoreBands)
  if (config?.selection && exits.length > 0) {
    const topN = config.selection.topN;
    const scoreBands = config.selection.scoreBands;
    if (scoreBands && scoreBands.length > 0) {
      reasons.push(`alguns ativos removidos por não estarem nas faixas de score configuradas`);
    } else if (topN) {
      reasons.push(`alguns ativos removidos por não estarem entre os top ${topN} selecionados`);
    }
  }
  
  // Motivo 5: Diversificação
  if (config?.diversification && exits.length > 0) {
    reasons.push(`alguns ativos removidos por regras de diversificação`);
  }
  
  if (reasons.length === 0) {
    return 'Rebalanceamento executado após screening';
  }
  
  return `Rebalanceamento necessário: ${reasons.join(', ')}`;
}

/**
 * Valida se um candidato atende aos critérios de qualidade do config
 * Retorna objeto com resultado e motivo da rejeição (se aplicável)
 */
export async function validateCandidateQuality(
  candidate: ScreeningCandidate,
  config: IndexConfig
): Promise<{ passes: boolean; rejectionReason?: string }> {
  if (!config.quality) {
    return { passes: true }; // Sem filtros de qualidade, aceita qualquer candidato
  }

  try {
    // Buscar dados financeiros da empresa
    const company = await prisma.company.findUnique({
      where: { ticker: candidate.ticker },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 1
        }
      }
    });

    if (!company || !company.financialData || company.financialData.length === 0) {
      return { passes: false, rejectionReason: 'sem dados financeiros disponíveis' };
    }

    const financials = company.financialData[0];

    // Validar ROE
    if (config.quality.roe) {
      const roe = toNumber(financials.roe);
      if (roe === null) {
        return { passes: false, rejectionReason: 'ROE não disponível' };
      }
      if (config.quality.roe.gte !== undefined && roe < config.quality.roe.gte) {
        return { passes: false, rejectionReason: `ROE ${(roe * 100).toFixed(1)}% abaixo do mínimo ${(config.quality.roe.gte * 100).toFixed(1)}%` };
      }
      if (config.quality.roe.lte !== undefined && roe > config.quality.roe.lte) {
        return { passes: false, rejectionReason: `ROE ${(roe * 100).toFixed(1)}% acima do máximo ${(config.quality.roe.lte * 100).toFixed(1)}%` };
      }
    }

    // Validar Margem Líquida
    if (config.quality.margemLiquida) {
      const margemLiquida = toNumber(financials.margemLiquida);
      if (margemLiquida === null) {
        return { passes: false, rejectionReason: 'Margem Líquida não disponível' };
      }
      if (config.quality.margemLiquida.gte !== undefined && margemLiquida < config.quality.margemLiquida.gte) {
        return { passes: false, rejectionReason: `Margem Líquida ${(margemLiquida * 100).toFixed(1)}% abaixo do mínimo ${(config.quality.margemLiquida.gte * 100).toFixed(1)}%` };
      }
      if (config.quality.margemLiquida.lte !== undefined && margemLiquida > config.quality.margemLiquida.lte) {
        return { passes: false, rejectionReason: `Margem Líquida ${(margemLiquida * 100).toFixed(1)}% acima do máximo ${(config.quality.margemLiquida.lte * 100).toFixed(1)}%` };
      }
    }

    // Validar Dívida Líquida / EBITDA
    if (config.quality.dividaLiquidaEbitda) {
      const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
      if (dividaLiquidaEbitda === null) {
        return { passes: false, rejectionReason: 'Dívida Líq./EBITDA não disponível' };
      }
      if (config.quality.dividaLiquidaEbitda.gte !== undefined && dividaLiquidaEbitda < config.quality.dividaLiquidaEbitda.gte) {
        return { passes: false, rejectionReason: `Dívida Líq./EBITDA ${dividaLiquidaEbitda.toFixed(2)}x abaixo do mínimo ${config.quality.dividaLiquidaEbitda.gte.toFixed(2)}x` };
      }
      if (config.quality.dividaLiquidaEbitda.lte !== undefined && dividaLiquidaEbitda > config.quality.dividaLiquidaEbitda.lte) {
        return { passes: false, rejectionReason: `Dívida Líq./EBITDA ${dividaLiquidaEbitda.toFixed(2)}x acima do máximo ${config.quality.dividaLiquidaEbitda.lte.toFixed(2)}x` };
      }
    }

    // Validar Payout
    if (config.quality.payout) {
      const payout = toNumber(financials.payout);
      if (payout === null) {
        return { passes: false, rejectionReason: 'Payout não disponível' };
      }
      if (config.quality.payout.gte !== undefined && payout < config.quality.payout.gte) {
        return { passes: false, rejectionReason: `Payout ${(payout * 100).toFixed(1)}% abaixo do mínimo ${(config.quality.payout.gte * 100).toFixed(1)}%` };
      }
      if (config.quality.payout.lte !== undefined && payout > config.quality.payout.lte) {
        return { passes: false, rejectionReason: `Payout ${(payout * 100).toFixed(1)}% acima do máximo ${(config.quality.payout.lte * 100).toFixed(1)}%` };
      }
    }

    // Validar Market Cap (em R$)
    if (config.quality.marketCap) {
      const marketCap = toNumber(financials.marketCap);
      if (marketCap === null) {
        return { passes: false, rejectionReason: 'Market Cap não disponível' };
      }
      if (config.quality.marketCap.gte !== undefined && marketCap < config.quality.marketCap.gte) {
        return { passes: false, rejectionReason: `Market Cap R$ ${(marketCap / 1_000_000_000).toFixed(2)}bi abaixo do mínimo R$ ${(config.quality.marketCap.gte / 1_000_000_000).toFixed(2)}bi` };
      }
      if (config.quality.marketCap.lte !== undefined && marketCap > config.quality.marketCap.lte) {
        return { passes: false, rejectionReason: `Market Cap R$ ${(marketCap / 1_000_000_000).toFixed(2)}bi acima do máximo R$ ${(config.quality.marketCap.lte / 1_000_000_000).toFixed(2)}bi` };
      }
    }

    // Validar P/L (Price to Earnings)
    if (config.quality.pl) {
      const pl = toNumber(financials.pl);
      if (pl === null) {
        return { passes: false, rejectionReason: 'P/L não disponível' };
      }
      if (config.quality.pl.gte !== undefined && pl < config.quality.pl.gte) {
        return { passes: false, rejectionReason: `P/L ${pl.toFixed(2)} abaixo do mínimo ${config.quality.pl.gte.toFixed(2)}` };
      }
      if (config.quality.pl.lte !== undefined && pl > config.quality.pl.lte) {
        return { passes: false, rejectionReason: `P/L ${pl.toFixed(2)} acima do máximo ${config.quality.pl.lte.toFixed(2)}` };
      }
    }

    // Validar P/VP (Price to Book Value)
    if (config.quality.pvp) {
      const pvp = toNumber(financials.pvp);
      if (pvp === null) {
        return { passes: false, rejectionReason: 'P/VP não disponível' };
      }
      if (config.quality.pvp.gte !== undefined && pvp < config.quality.pvp.gte) {
        return { passes: false, rejectionReason: `P/VP ${pvp.toFixed(2)} abaixo do mínimo ${config.quality.pvp.gte.toFixed(2)}` };
      }
      if (config.quality.pvp.lte !== undefined && pvp > config.quality.pvp.lte) {
        return { passes: false, rejectionReason: `P/VP ${pvp.toFixed(2)} acima do máximo ${config.quality.pvp.lte.toFixed(2)}` };
      }
    }

    // Validar Overall Score (se disponível no candidato)
    if (config.quality.overallScore) {
      if (candidate.overallScore === null) {
        return { passes: false, rejectionReason: 'Overall Score não disponível' };
      }
      if (config.quality.overallScore.gte !== undefined && candidate.overallScore < config.quality.overallScore.gte) {
        return { passes: false, rejectionReason: `Overall Score ${candidate.overallScore.toFixed(0)} abaixo do mínimo ${config.quality.overallScore.gte.toFixed(0)}` };
      }
      if (config.quality.overallScore.lte !== undefined && candidate.overallScore > config.quality.overallScore.lte) {
        return { passes: false, rejectionReason: `Overall Score ${candidate.overallScore.toFixed(0)} acima do máximo ${config.quality.overallScore.lte.toFixed(0)}` };
      }
    }

    return { passes: true }; // Passou em todos os critérios
  } catch (error) {
    console.error(`⚠️ [SCREENING ENGINE] Error validating quality for ${candidate.ticker}:`, error);
    return { passes: false, rejectionReason: 'erro ao validar critérios de qualidade' };
  }
}

/**
 * Filtra candidatos que não atendem aos critérios de qualidade
 * Retorna apenas os candidatos que passam na validação de qualidade
 */
export async function filterByQuality(
  candidates: ScreeningCandidate[],
  config: IndexConfig
): Promise<{ valid: ScreeningCandidate[]; rejected: Array<{ candidate: ScreeningCandidate; reason: string }> }> {
  if (!config.rebalance?.checkQuality) {
    return { valid: candidates, rejected: [] }; // Se checkQuality não está ativado, retorna todos
  }

  const valid: ScreeningCandidate[] = [];
  const rejected: Array<{ candidate: ScreeningCandidate; reason: string }> = [];

  for (const candidate of candidates) {
    const qualityResult = await validateCandidateQuality(candidate, config);
    if (qualityResult.passes) {
      valid.push(candidate);
    } else {
      rejected.push({
        candidate,
        reason: qualityResult.rejectionReason || 'não atende critérios de qualidade'
      });
      console.log(`    ⚠️ [REBALANCE] ${candidate.ticker}: Não atende critérios de qualidade - ${qualityResult.rejectionReason || 'motivo desconhecido'}`);
    }
  }

  return { valid, rejected };
}

/**
 * Decide se deve rebalancear baseado em threshold
 */
export function shouldRebalance(
  current: Array<{ assetTicker: string; entryPrice: number }>,
  ideal: ScreeningCandidate[],
  threshold: number = 0.05,
  upsideType?: 'graham' | 'fcd' | 'gordon' | 'barsi' | 'technical' | 'best'
): boolean {
  // Se há mudanças na composição, sempre rebalancear
  const currentTickers = new Set(current.map(c => c.assetTicker));
  const idealTickers = new Set(ideal.map(c => c.ticker));

  if (currentTickers.size !== idealTickers.size) {
    return true;
  }

  for (const ticker of currentTickers) {
    if (!idealTickers.has(ticker)) {
      return true;
    }
  }

  // Verificar se algum ativo novo tem upside significativamente maior que o último da lista atual
  if (ideal.length > 0 && current.length > 0) {
    // Encontrar o último ativo atual na lista ideal (menor upside)
    const currentInIdeal = ideal.filter(c => currentTickers.has(c.ticker));
    if (currentInIdeal.length === 0) {
      return true;
    }

    const lastCurrentUpside = getUpsideForRebalance(currentInIdeal[currentInIdeal.length - 1], upsideType);
    const firstNewCandidate = ideal.find(c => !currentTickers.has(c.ticker));
    const firstNewUpside = firstNewCandidate ? getUpsideForRebalance(firstNewCandidate, upsideType) : null;

    if (firstNewUpside !== null && firstNewUpside !== undefined && lastCurrentUpside !== null) {
      const upsideDiff = firstNewUpside - lastCurrentUpside;
      if (upsideDiff > threshold * 100) { // threshold em decimal, converter para porcentagem
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcula pesos para composição baseado no tipo configurado
 */
function calculateWeights(
  candidates: ScreeningCandidate[],
  config: IndexConfig
): Map<string, number> {
  const weights = new Map<string, number>();
  const weightType = config.weights?.type || 'equal';

  if (weightType === 'equal') {
    // Equal weight: todos recebem o mesmo peso
    const equalWeight = 1.0 / candidates.length;
    candidates.forEach(c => weights.set(c.ticker, equalWeight));
  } else if (weightType === 'overallScore') {
    // Score-based: pesos proporcionais ao overallScore (Score Geral da empresa)
    const minWeight = config.weights?.minWeight || 0.02; // 2% mínimo
    const maxWeight = config.weights?.maxWeight || 0.15; // 15% máximo

    // Filtrar candidatos com score válido
    const candidatesWithScore = candidates.filter(c => c.overallScore !== null && c.overallScore !== undefined);
    const candidatesWithoutScore = candidates.filter(c => c.overallScore === null || c.overallScore === undefined);

    if (candidatesWithScore.length === 0) {
      // Se nenhum tem score, usar equal weight
      const equalWeight = 1.0 / candidates.length;
      candidates.forEach(c => weights.set(c.ticker, equalWeight));
      return weights;
    }

    // Calcular soma total de scores
    const totalScore = candidatesWithScore.reduce((sum, c) => sum + (c.overallScore || 0), 0);

    if (totalScore === 0) {
      // Se todos os scores são 0, usar equal weight
      const equalWeight = 1.0 / candidates.length;
      candidates.forEach(c => weights.set(c.ticker, equalWeight));
      return weights;
    }

    // Calcular pesos proporcionais ao score
    let totalAssignedWeight = 0;
    const rawWeights = new Map<string, number>();

    for (const candidate of candidatesWithScore) {
      const score = candidate.overallScore || 0;
      // Peso proporcional ao score
      const proportionalWeight = score / totalScore;
      // Aplicar min/max constraints
      const constrainedWeight = Math.max(minWeight, Math.min(maxWeight, proportionalWeight));
      rawWeights.set(candidate.ticker, constrainedWeight);
      totalAssignedWeight += constrainedWeight;
    }

    // Distribuir peso restante entre candidatos sem score (se houver)
    const remainingWeight = 1.0 - totalAssignedWeight;
    const weightForNoScore = candidatesWithoutScore.length > 0 
      ? remainingWeight / candidatesWithoutScore.length 
      : 0;

    // Normalizar se necessário (se totalAssignedWeight > 1.0 devido a constraints)
    if (totalAssignedWeight > 1.0) {
      const normalizationFactor = 1.0 / totalAssignedWeight;
      rawWeights.forEach((weight, ticker) => {
        weights.set(ticker, weight * normalizationFactor);
      });
      // Candidatos sem score recebem 0
      candidatesWithoutScore.forEach(c => weights.set(c.ticker, 0));
    } else {
      // Aplicar pesos calculados
      rawWeights.forEach((weight, ticker) => {
        weights.set(ticker, weight);
      });
      // Distribuir peso restante entre candidatos sem score
      candidatesWithoutScore.forEach(c => {
        weights.set(c.ticker, weightForNoScore);
      });
    }

    // Garantir que a soma seja exatamente 1.0 (normalização final)
    const finalTotal = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    if (Math.abs(finalTotal - 1.0) > 0.0001) {
      const normalizationFactor = 1.0 / finalTotal;
      weights.forEach((weight, ticker) => {
        weights.set(ticker, weight * normalizationFactor);
      });
    }
  } else if (weightType === 'marketCap') {
    // Market cap weighted: pesos proporcionais ao market cap
    const totalMarketCap = candidates.reduce((sum, c) => sum + (c.marketCap || 0), 0);
    
    if (totalMarketCap === 0) {
      // Se não há market cap, usar equal weight
      const equalWeight = 1.0 / candidates.length;
      candidates.forEach(c => weights.set(c.ticker, equalWeight));
    } else {
      candidates.forEach(c => {
        const marketCap = c.marketCap || 0;
        weights.set(c.ticker, marketCap / totalMarketCap);
      });
    }
  } else if (weightType === 'custom') {
    // Custom weights: pesos definidos manualmente no config
    const customWeights = config.weights?.customWeights || {};
    
    if (Object.keys(customWeights).length === 0) {
      // Se não há pesos customizados definidos, usar equal weight
      console.warn('⚠️ [SCREENING ENGINE] Custom weight type specified but no customWeights provided. Using equal weight.');
      const equalWeight = 1.0 / candidates.length;
      candidates.forEach(c => weights.set(c.ticker, equalWeight));
    } else {
      // Aplicar pesos customizados
      let totalCustomWeight = 0;
      const customWeightsMap = new Map<string, number>();
      
      for (const candidate of candidates) {
        const ticker = candidate.ticker.toUpperCase();
        const customWeight = customWeights[ticker] || customWeights[candidate.ticker];
        
        if (customWeight !== undefined && customWeight !== null) {
          customWeightsMap.set(candidate.ticker, customWeight);
          totalCustomWeight += customWeight;
        }
      }
      
      // Verificar se há candidatos sem peso definido
      const candidatesWithoutWeight = candidates.filter(c => !customWeightsMap.has(c.ticker));
      
      if (totalCustomWeight === 0) {
        // Se nenhum peso foi aplicado, usar equal weight
        console.warn('⚠️ [SCREENING ENGINE] No valid custom weights found. Using equal weight.');
        const equalWeight = 1.0 / candidates.length;
        candidates.forEach(c => weights.set(c.ticker, equalWeight));
      } else {
        // Normalizar pesos customizados para somar 1.0
        if (totalCustomWeight > 1.0 || candidatesWithoutWeight.length > 0) {
          // Se soma > 1.0 ou há candidatos sem peso, normalizar
          const normalizationFactor = 1.0 / totalCustomWeight;
          customWeightsMap.forEach((weight, ticker) => {
            weights.set(ticker, weight * normalizationFactor);
          });
          
          // Distribuir peso restante entre candidatos sem peso definido
          if (candidatesWithoutWeight.length > 0) {
            const remainingWeight = 1.0 - Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
            const weightForUndefined = remainingWeight / candidatesWithoutWeight.length;
            candidatesWithoutWeight.forEach(c => {
              weights.set(c.ticker, weightForUndefined);
            });
          }
        } else {
          // Aplicar pesos como estão
          customWeightsMap.forEach((weight, ticker) => {
            weights.set(ticker, weight);
          });
          
          // Distribuir peso restante entre candidatos sem peso definido
          if (candidatesWithoutWeight.length > 0) {
            const remainingWeight = 1.0 - totalCustomWeight;
            const weightForUndefined = remainingWeight / candidatesWithoutWeight.length;
            candidatesWithoutWeight.forEach(c => {
              weights.set(c.ticker, weightForUndefined);
            });
          }
        }
        
        // Garantir normalização final
        const finalTotal = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
        if (Math.abs(finalTotal - 1.0) > 0.0001) {
          const normalizationFactor = 1.0 / finalTotal;
          weights.forEach((weight, ticker) => {
            weights.set(ticker, weight * normalizationFactor);
          });
        }
      }
    }
  } else {
    // Fallback: equal weight
    const equalWeight = 1.0 / candidates.length;
    candidates.forEach(c => weights.set(c.ticker, equalWeight));
  }

  return weights;
}

/**
 * Atualiza composição do índice
 */
export async function updateComposition(
  indexId: string,
  newComposition: ScreeningCandidate[],
  changes: CompositionChange[],
  rebalanceReason?: string
): Promise<boolean> {
  try {
    // Buscar config do índice para determinar tipo de peso
    const indexDefinition = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      select: { config: true }
    });

    if (!indexDefinition) {
      throw new Error('Index definition not found');
    }

    const config = indexDefinition.config as IndexConfig;

    // Buscar preços atuais para os novos ativos
    const tickers = newComposition.map(c => c.ticker);
    const { getLatestPrices } = await import('./quote-service');
    const prices = await getLatestPrices(tickers);

    // Calcular pesos baseado no tipo configurado
    const weights = calculateWeights(newComposition, config);

    // Remover composição antiga
    await prisma.indexComposition.deleteMany({
      where: { indexId }
    });

    // Criar nova composição
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const candidate of newComposition) {
      const priceData = prices.get(candidate.ticker);
      const entryPrice = priceData?.price || candidate.currentPrice;
      const targetWeight = weights.get(candidate.ticker) || (1.0 / newComposition.length);

      await prisma.indexComposition.create({
        data: {
          indexId,
          assetTicker: candidate.ticker,
          targetWeight,
          entryPrice,
          entryDate: today
        }
      });
    }

    // Criar logs de rebalanceamento
    // Primeiro, criar log geral explicando o motivo do rebalanceamento
    if (changes.length > 0 && rebalanceReason) {
      await prisma.indexRebalanceLog.create({
        data: {
          indexId,
          date: today,
          action: 'REBALANCE',
          ticker: 'SYSTEM',
          reason: rebalanceReason
        }
      });
    }
    
    // Depois, criar logs individuais para cada mudança
    for (const change of changes) {
      await prisma.indexRebalanceLog.create({
        data: {
          indexId,
          date: today,
          action: change.action,
          ticker: change.ticker,
          reason: change.reason
        }
      });
    }

    console.log(`✅ [SCREENING ENGINE] Updated composition for index ${indexId}: ${newComposition.length} assets, ${changes.length} changes`);

    return true;
  } catch (error) {
    console.error(`❌ [SCREENING ENGINE] Error updating composition:`, error);
    return false;
  }
}
