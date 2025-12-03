/**
 * Index Engine
 * 
 * Engine de cálculo de índices Preço Justo (IPJ)
 * Calcula variação diária, atualiza pontos e preenche lacunas históricas
 */

import { prisma } from '@/lib/prisma';
import { getLatestPrices } from '@/lib/quote-service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CompositionSnapshot {
  weight: number; // Peso no índice neste dia
  price: number; // Preço atual do ativo
  entryPrice: number; // Preço de entrada no índice
  entryDate: Date; // Data de entrada no índice
}

export interface IndexDailyReturn {
  date: Date;
  dailyReturn: number; // R_t = Σ(w_{i,t-1} × r_{i,t})
  points: number; // Pontos_hoje = Pontos_ontem × (1 + R_t)
  currentYield: number | null; // DY médio ponderado da carteira
  dividendsReceived: number; // Total de dividendos recebidos (em pontos)
  dividendsByTicker: Map<string, number>; // Detalhamento por ticker
  compositionSnapshot?: Record<string, CompositionSnapshot>; // Snapshot da composição neste dia
}

/**
 * Busca dividendos com ex-date igual à data especificada para todos os ativos da composição
 */
async function getDividendsForDate(
  indexId: string,
  date: Date
): Promise<Map<string, number>> {
  try {
    // Buscar composição atual do índice
    const composition = await prisma.indexComposition.findMany({
      where: { indexId },
      select: { assetTicker: true }
    });

    if (composition.length === 0) {
      return new Map();
    }

    const dividends = new Map<string, number>();
    const tickers = composition.map(c => c.assetTicker);

    // Buscar empresas pelos tickers
    const companies = await prisma.company.findMany({
      where: {
        ticker: { in: tickers }
      },
      select: {
        id: true,
        ticker: true
      }
    });

    const companyIdMap = new Map(companies.map(c => [c.ticker, c.id]));

    // Buscar dividendos com exDate igual à data especificada
    const companyIds = Array.from(companyIdMap.values());
    
    if (companyIds.length === 0) {
      return new Map();
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const dividendRecords = await prisma.dividendHistory.findMany({
      where: {
        companyId: { in: companyIds },
        exDate: {
          gte: dateStart,
          lte: dateEnd
        }
      },
      select: {
        companyId: true,
        amount: true
      }
    });

    // Agrupar dividendos por ticker (somar se houver múltiplos no mesmo dia)
    for (const div of dividendRecords) {
      const ticker = Array.from(companyIdMap.entries()).find(([_, id]) => id === div.companyId)?.[0];
      if (ticker) {
        const currentAmount = dividends.get(ticker) || 0;
        dividends.set(ticker, currentAmount + Number(div.amount));
      }
    }

    return dividends;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error fetching dividends for date ${date.toISOString()}:`, error);
    return new Map();
  }
}

/**
 * Calcula variação diária do índice usando fórmula: R_t = Σ(w_{i,t-1} × r_{i,t})
 * onde:
 * - w_{i,t-1}: Peso do ativo no fechamento do dia anterior
 * - r_{i,t}: Variação percentual do preço do ativo hoje (incluindo ajuste por dividendos)
 */
export async function calculateDailyReturn(
  indexId: string,
  date: Date,
  dividends?: Map<string, number>
): Promise<IndexDailyReturn | null> {
  try {
    // 1. Buscar composição atual do índice
    const composition = await prisma.indexComposition.findMany({
      where: { indexId },
      include: {
        definition: true
      }
    });

    if (composition.length === 0) {
      console.warn(`⚠️ [INDEX ENGINE] No composition found for index ${indexId}`);
      return null;
    }

    // 2. Buscar último ponto histórico (para pegar pontos do dia anterior)
    const lastHistoryPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' }
    });

    // Se não há histórico, este é o primeiro dia (base 100)
    const isFirstDay = !lastHistoryPoint;
    const previousPoints = lastHistoryPoint?.points || 100.0;

    // 3. Buscar preços de fechamento do dia atual (necessário para snapshot e cálculo)
    const tickers = composition.map(c => c.assetTicker);
    const pricesToday = await getLatestPrices(tickers);

    // Se é o primeiro dia, retornar pontos = 100 sem calcular variação
    if (isFirstDay) {
      // Calcular apenas DY médio ponderado para exibição
      let totalWeightedYield = 0;
      let totalWeight = 0;

      for (const comp of composition) {
        const company = await prisma.company.findUnique({
          where: { ticker: comp.assetTicker },
          include: {
            financialData: {
              orderBy: { year: 'desc' },
              take: 1
            }
          }
        });

        if (company?.financialData?.[0]?.dy) {
          const dy = Number(company.financialData[0].dy) * 100; // Converter para porcentagem
          totalWeightedYield += comp.targetWeight * dy;
          totalWeight += comp.targetWeight;
        }
      }

      const currentYield = totalWeight > 0 ? totalWeightedYield / totalWeight : null;

      // Criar snapshot inicial da composição
      const initialSnapshot: Record<string, CompositionSnapshot> = {};
      for (const comp of composition) {
        const priceData = pricesToday.get(comp.assetTicker);
        const currentPrice = priceData?.price || comp.entryPrice;
        initialSnapshot[comp.assetTicker] = {
          weight: comp.targetWeight,
          price: currentPrice,
          entryPrice: comp.entryPrice,
          entryDate: comp.entryDate
        };
      }

      return {
        date,
        dailyReturn: 0, // Primeiro dia sempre tem retorno zero
        points: 100.0, // Sempre começa em 100 pontos
        currentYield,
        dividendsReceived: 0,
        dividendsByTicker: new Map<string, number>(),
        compositionSnapshot: Object.keys(initialSnapshot).length > 0 ? initialSnapshot : undefined
      };
    }

    // 3.5. Buscar preços do dia anterior do banco
    const pricesYesterday = new Map<string, number>();
    
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    
    for (const comp of composition) {
      const company = await prisma.company.findUnique({
        where: { ticker: comp.assetTicker },
        select: { id: true }
      });

      if (!company) continue;

      // Tentar buscar preço do dia anterior
      const yesterdayQuote = await prisma.dailyQuote.findFirst({
        where: {
          companyId: company.id,
          date: {
            lte: yesterday
          }
        },
        orderBy: { date: 'desc' },
        take: 1
      });

      if (yesterdayQuote) {
        pricesYesterday.set(comp.assetTicker, Number(yesterdayQuote.price));
      } else {
        // Se não encontrou quote do dia anterior, verificar se o ativo entrou hoje
        const entryDate = new Date(comp.entryDate);
        entryDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(date);
        todayDate.setHours(0, 0, 0, 0);
        
        // Se o ativo entrou hoje (rebalanceamento), usar preço atual como base (sem variação no primeiro dia)
        // Isso preserva a rentabilidade do índice ao não criar variação artificial
        if (entryDate.getTime() === todayDate.getTime()) {
          // Ativo novo: usar preço atual como base (retorno zero no primeiro dia)
          const priceToday = pricesToday.get(comp.assetTicker)?.price;
          if (priceToday) {
            pricesYesterday.set(comp.assetTicker, priceToday);
          } else {
            pricesYesterday.set(comp.assetTicker, comp.entryPrice);
          }
        } else {
          // Ativo antigo sem quote: usar preço de entrada como fallback
          pricesYesterday.set(comp.assetTicker, comp.entryPrice);
        }
      }
    }

    // 3.5. Buscar dividendos se não foram fornecidos
    let dividendsMap = dividends;
    if (!dividendsMap) {
      dividendsMap = await getDividendsForDate(indexId, date);
    }

    // 4. Calcular variação ponderada R_t = Σ(w_{i,t-1} × r_{i,t})
    let totalReturn = 0;
    let totalWeightedYield = 0;
    let totalWeight = 0;
    let totalDividendsReceived = 0; // Em pontos do índice
    const dividendsByTicker = new Map<string, number>();

    for (const comp of composition) {
      const priceToday = pricesToday.get(comp.assetTicker)?.price;
      const priceYesterday = pricesYesterday.get(comp.assetTicker);

      if (!priceToday || !priceYesterday || priceYesterday === 0) {
        console.warn(`⚠️ [INDEX ENGINE] Missing price data for ${comp.assetTicker}, skipping`);
        continue;
      }

      // Verificar se há dividendo no ex-date
      const dividend = dividendsMap.get(comp.assetTicker) || 0;

      // Ajustar preço teórico: preço_ajustado = preço_atual + dividendo
      // Isso evita penalizar quando o preço cai no ex-date
      const adjustedPriceToday = priceToday + dividend;

      // Calcular variação percentual incluindo dividendo: r_{i,t} = (PreçoAjustadoHoje / PreçoOntem) - 1
      const dailyReturn = (adjustedPriceToday / priceYesterday) - 1;

      // Peso do ativo (targetWeight)
      const weight = comp.targetWeight;

      // Contribuição ponderada: w_{i,t-1} × r_{i,t}
      totalReturn += weight * dailyReturn;

      // Acumular dividendos recebidos (em pontos do índice)
      if (dividend > 0) {
        // Dividendo em pontos = dividendo por ação × peso no índice × pontos anteriores
        const dividendInPoints = (dividend / priceYesterday) * weight * previousPoints;
        totalDividendsReceived += dividendInPoints;
        dividendsByTicker.set(comp.assetTicker, dividend);
      }

      // Calcular DY médio ponderado (usar DY do último financialData)
      const company = await prisma.company.findUnique({
        where: { ticker: comp.assetTicker },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 1
          }
        }
      });

      if (company?.financialData?.[0]?.dy) {
        const dy = Number(company.financialData[0].dy) * 100; // Converter para porcentagem
        totalWeightedYield += weight * dy;
        totalWeight += weight;
      }
    }

    // 5. Calcular pontos do dia: Pontos_hoje = Pontos_ontem × (1 + R_t)
    const points = previousPoints * (1 + totalReturn);

    // 6. Calcular DY médio ponderado
    const currentYield = totalWeight > 0 ? totalWeightedYield / totalWeight : null;

    // 7. Criar snapshot da composição atual
    const compositionSnapshot: Record<string, CompositionSnapshot> = {};
    for (const comp of composition) {
      const priceToday = pricesToday.get(comp.assetTicker)?.price;
      if (priceToday) {
        compositionSnapshot[comp.assetTicker] = {
          weight: comp.targetWeight,
          price: priceToday,
          entryPrice: comp.entryPrice,
          entryDate: comp.entryDate
        };
      }
    }

    return {
      date,
      dailyReturn: totalReturn,
      points,
      currentYield,
      dividendsReceived: totalDividendsReceived,
      dividendsByTicker,
      compositionSnapshot: Object.keys(compositionSnapshot).length > 0 ? compositionSnapshot : undefined
    };
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error calculating daily return for index ${indexId}:`, error);
    return null;
  }
}

/**
 * Atualiza pontos do índice para uma data específica
 */
export async function updateIndexPoints(
  indexId: string,
  date: Date
): Promise<boolean> {
  try {
    const dailyReturn = await calculateDailyReturn(indexId, date);
    
    if (!dailyReturn) {
      return false;
    }

    // Verificar se já existe registro para esta data
    const existing = await prisma.indexHistoryPoints.findUnique({
      where: {
        indexId_date: {
          indexId,
          date
        }
      }
    });

    // Converter Map para objeto JSON
    const dividendsByTickerJson = dailyReturn.dividendsByTicker.size > 0
      ? Object.fromEntries(dailyReturn.dividendsByTicker)
      : undefined;

    // Converter snapshot para JSON (convertendo Date para ISO string)
    const compositionSnapshotJson = dailyReturn.compositionSnapshot 
      ? Object.fromEntries(
          Object.entries(dailyReturn.compositionSnapshot).map(([ticker, snapshot]) => [
            ticker,
            {
              weight: snapshot.weight,
              price: snapshot.price,
              entryPrice: snapshot.entryPrice,
              entryDate: snapshot.entryDate.toISOString()
            }
          ])
        )
      : undefined;

    const updateData: any = {
      points: dailyReturn.points,
      dailyChange: dailyReturn.dailyReturn * 100, // Converter para porcentagem
      currentYield: dailyReturn.currentYield
    };

    if (compositionSnapshotJson) {
      updateData.compositionSnapshot = compositionSnapshotJson;
    }

    if (existing) {
      // Atualizar registro existente
      await prisma.indexHistoryPoints.update({
        where: { id: existing.id },
        data: updateData
      });
    } else {
      // Criar novo registro
      await prisma.indexHistoryPoints.create({
        data: {
          indexId,
          date,
          ...updateData
        }
      });
    }

    return true;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error updating index points for ${indexId}:`, error);
    return false;
  }
}

/**
 * Preenche lacunas no histórico do índice
 * Detecta dias faltantes entre o último ponto e hoje e calcula retroativamente
 */
export async function fillMissingHistory(indexId: string): Promise<number> {
  try {
    // 1. Buscar último ponto histórico
    const lastPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' }
    });

    if (!lastPoint) {
      console.warn(`⚠️ [INDEX ENGINE] No history found for index ${indexId}, cannot fill gaps`);
      return 0;
    }

    // 2. Buscar data de criação do índice
    const indexDefinition = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      select: { createdAt: true }
    });

    if (!indexDefinition) {
      return 0;
    }

    // 3. Identificar dias faltantes entre último ponto e hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastDate = new Date(lastPoint.date);
    lastDate.setHours(0, 0, 0, 0);

    // Se último ponto é hoje ou futuro, não há lacunas
    if (lastDate >= today) {
      return 0;
    }

    // 4. Gerar lista de dias úteis faltantes
    const missingDates: Date[] = [];
    const currentDate = new Date(lastDate);
    currentDate.setDate(currentDate.getDate() + 1); // Começar do dia seguinte

    while (currentDate <= today) {
      // Verificar se é dia útil (segunda a sexta)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        missingDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (missingDates.length === 0) {
      return 0;
    }

    console.log(`📊 [INDEX ENGINE] Found ${missingDates.length} missing days for index ${indexId}`);

    // 5. Calcular pontos para cada dia faltante
    // Nota: updateIndexPoints já busca dividendos automaticamente para cada data
    let filledCount = 0;
    for (const date of missingDates) {
      const success = await updateIndexPoints(indexId, date);
      if (success) {
        filledCount++;
      }
    }

    console.log(`✅ [INDEX ENGINE] Filled ${filledCount}/${missingDates.length} missing days for index ${indexId}`);

    return filledCount;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error filling missing history for index ${indexId}:`, error);
    return 0;
  }
}

/**
 * Recalcula pontos históricos de um índice considerando dividendos atualizados
 * Útil quando dividendos são adicionados ao banco após a execução do CRON
 */
export async function recalculateIndexWithDividends(
  indexId: string,
  startDate?: Date
): Promise<{
  success: boolean;
  recalculated: number;
  dividendsFound: number;
  newPoints: Array<{ date: string; oldPoints: number; newPoints: number }>;
  errors: string[];
}> {
  try {
    // Buscar todos os pontos históricos do índice (ordenados por data crescente)
    const allPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId },
      orderBy: { date: 'asc' }
    });

    if (allPoints.length === 0) {
      return {
        success: false,
        recalculated: 0,
        dividendsFound: 0,
        newPoints: [],
        errors: ['No historical points found for index']
      };
    }

    // Filtrar pontos a partir de startDate se fornecido
    const pointsToRecalculate = startDate
      ? allPoints.filter(p => new Date(p.date) >= startDate)
      : allPoints;

    if (pointsToRecalculate.length === 0) {
      return {
        success: true,
        recalculated: 0,
        dividendsFound: 0,
        newPoints: [],
        errors: []
      };
    }

    // Encontrar o ponto anterior ao primeiro a recalcular (para usar como base)
    const firstPointIndex = allPoints.findIndex(p => p.id === pointsToRecalculate[0].id);
    const previousPoint = firstPointIndex > 0 ? allPoints[firstPointIndex - 1] : null;
    const basePoints = previousPoint ? previousPoint.points : 100.0;

    let recalculated = 0;
    let totalDividendsFound = 0;
    const newPoints: Array<{ date: string; oldPoints: number; newPoints: number }> = [];
    const errors: string[] = [];
    let currentPoints = basePoints;

    // Recalcular cada ponto em ordem cronológica
    for (const point of pointsToRecalculate) {
      try {
        const pointDate = new Date(point.date);
        pointDate.setHours(0, 0, 0, 0);

        // Buscar dividendos para esta data
        const dividends = await getDividendsForDate(indexId, pointDate);
        const hasDividends = dividends.size > 0;

        if (hasDividends) {
          totalDividendsFound += dividends.size;
        }

        // Recalcular retorno diário incluindo dividendos
        const dailyReturn = await calculateDailyReturn(indexId, pointDate, dividends);

        if (!dailyReturn) {
          errors.push(`Failed to calculate return for ${pointDate.toISOString()}`);
          continue;
        }

        // Calcular novos pontos acumulando desde o ponto anterior
        const newPointsValue = currentPoints * (1 + dailyReturn.dailyReturn);

        // Preparar dados para atualização
        const updateData: any = {
          points: newPointsValue,
          dailyChange: dailyReturn.dailyReturn * 100,
          currentYield: dailyReturn.currentYield
        };

        if (dailyReturn.dividendsReceived > 0) {
          updateData.dividendsReceived = dailyReturn.dividendsReceived;
        }

        if (dailyReturn.dividendsByTicker.size > 0) {
          updateData.dividendsByTicker = Object.fromEntries(dailyReturn.dividendsByTicker);
        }

        // Atualizar registro no banco
        await prisma.indexHistoryPoints.update({
          where: { id: point.id },
          data: updateData
        });

        newPoints.push({
          date: pointDate.toISOString().split('T')[0],
          oldPoints: point.points,
          newPoints: newPointsValue
        });

        currentPoints = newPointsValue;
        recalculated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Error recalculating point ${point.date}: ${errorMsg}`);
        console.error(`❌ [INDEX ENGINE] Error recalculating point ${point.date}:`, error);
      }
    }

    return {
      success: errors.length === 0,
      recalculated,
      dividendsFound: totalDividendsFound,
      newPoints,
      errors
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [INDEX ENGINE] Error recalculating index with dividends:`, error);
    return {
      success: false,
      recalculated: 0,
      dividendsFound: 0,
      newPoints: [],
      errors: [errorMsg]
    };
  }
}

/**
 * Verifica se há dividendos pendentes (dividendos no banco que não foram processados)
 */
export async function checkPendingDividends(indexId: string): Promise<{
  hasPending: boolean;
  pendingDividends: Array<{ ticker: string; exDate: Date; amount: number }>;
}> {
  try {
    // Buscar último ponto histórico do índice
    const lastPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' }
    });

    if (!lastPoint) {
      return { hasPending: false, pendingDividends: [] };
    }

    // Buscar composição atual
    const composition = await prisma.indexComposition.findMany({
      where: { indexId },
      select: { assetTicker: true }
    });

    const tickers = composition.map(c => c.assetTicker);
    const companies = await prisma.company.findMany({
      where: { ticker: { in: tickers } },
      select: { id: true, ticker: true }
    });

    const companyIdMap = new Map(companies.map(c => [c.ticker, c.id]));
    const companyIds = Array.from(companyIdMap.values());

    if (companyIds.length === 0) {
      return { hasPending: false, pendingDividends: [] };
    }

    const lastDate = new Date(lastPoint.date);
    lastDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar dividendos com exDate entre último ponto e hoje
    const dividends = await prisma.dividendHistory.findMany({
      where: {
        companyId: { in: companyIds },
        exDate: {
          gte: lastDate,
          lte: today
        }
      },
      select: {
        companyId: true,
        exDate: true,
        amount: true
      }
    });

    // Verificar quais dividendos já foram processados
    // Buscar todos os pontos históricos com dividendos processados
    const processedDates = new Set<string>();
    const allRecentPoints = await prisma.indexHistoryPoints.findMany({
      where: {
        indexId,
        date: { gte: lastDate }
      },
      select: { date: true, dividendsByTicker: true }
    });

    // Filtrar apenas os que têm dividendos processados
    const pointsWithDividends = allRecentPoints.filter(p => p.dividendsByTicker !== null);

    for (const point of pointsWithDividends) {
      const pointDate = new Date(point.date).toISOString().split('T')[0];
      processedDates.add(pointDate);
    }

    // Filtrar dividendos não processados
    const pendingDividends: Array<{ ticker: string; exDate: Date; amount: number }> = [];
    for (const div of dividends) {
      const divDate = new Date(div.exDate).toISOString().split('T')[0];
      if (!processedDates.has(divDate)) {
        const ticker = Array.from(companyIdMap.entries()).find(([_, id]) => id === div.companyId)?.[0];
        if (ticker) {
          pendingDividends.push({
            ticker,
            exDate: div.exDate,
            amount: Number(div.amount)
          });
        }
      }
    }

    return {
      hasPending: pendingDividends.length > 0,
      pendingDividends
    };
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error checking pending dividends:`, error);
    return { hasPending: false, pendingDividends: [] };
  }
}

/**
 * Interface para performance individual de um ativo no índice
 */
export interface AssetPerformance {
  ticker: string;
  entryDate: Date;
  exitDate: Date | null; // null se ainda está no índice
  entryPrice: number;
  exitPrice: number | null; // null se ainda está no índice
  daysInIndex: number;
  totalReturn: number | null; // Rentabilidade enquanto esteve no índice (null se ainda está)
  contributionToIndex: number; // Contribuição total para o índice (em pontos)
  averageWeight: number; // Peso médio durante período no índice
  status: 'ACTIVE' | 'EXITED';
  firstSnapshotDate: Date;
  lastSnapshotDate: Date;
}

/**
 * Calcula performance individual de um ativo usando snapshots históricos
 */
export async function calculateAssetPerformance(
  indexId: string,
  ticker: string
): Promise<AssetPerformance | null> {
  try {
    // Buscar todos os pontos históricos que têm snapshot
    const historyPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        compositionSnapshot: true,
        points: true,
        dailyChange: true
      }
    });

    // Filtrar pontos onde o ticker estava presente
    const relevantPoints = historyPoints.filter(point => {
      if (!point.compositionSnapshot) return false;
      const snapshot = point.compositionSnapshot as any;
      return snapshot[ticker] !== undefined;
    });

    if (relevantPoints.length === 0) {
      return null; // Ativo nunca esteve no índice
    }

    const firstPoint = relevantPoints[0];
    const lastPoint = relevantPoints[relevantPoints.length - 1];
    const firstSnapshot = firstPoint.compositionSnapshot as any;
    const lastSnapshot = lastPoint.compositionSnapshot as any;

    const entryData = firstSnapshot[ticker];
    const exitData = lastSnapshot[ticker];

    if (!entryData) {
      return null;
    }

    // Verificar se ainda está no índice (comparar com composição atual)
    const currentComposition = await prisma.indexComposition.findFirst({
      where: {
        indexId,
        assetTicker: ticker
      }
    });

    const isActive = !!currentComposition;
    const exitDate = isActive ? null : new Date(lastPoint.date);
    const exitPrice = isActive ? null : exitData.price;

    // Calcular dias no índice
    const daysInIndex = Math.ceil(
      (new Date(lastPoint.date).getTime() - new Date(firstPoint.date).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Calcular rentabilidade total
    const totalReturn = exitPrice && entryData.entryPrice
      ? ((exitPrice - entryData.entryPrice) / entryData.entryPrice) * 100
      : null;

    // Calcular contribuição para o índice (soma das contribuições diárias ponderadas)
    let totalContribution = 0;
    let totalWeight = 0;
    let pointCount = 0;

    for (let i = 0; i < relevantPoints.length; i++) {
      const point = relevantPoints[i];
      const snapshot = point.compositionSnapshot as any;
      const assetData = snapshot[ticker];
      
      if (assetData) {
        totalWeight += assetData.weight;
        pointCount++;
        
        // Contribuição diária = peso × variação diária do índice
        if (point.dailyChange !== null && point.dailyChange !== undefined) {
          totalContribution += assetData.weight * point.dailyChange;
        }
      }
    }

    const averageWeight = pointCount > 0 ? totalWeight / pointCount : 0;

    return {
      ticker,
      entryDate: new Date(entryData.entryDate),
      exitDate,
      entryPrice: entryData.entryPrice,
      exitPrice,
      daysInIndex,
      totalReturn,
      contributionToIndex: totalContribution,
      averageWeight,
      status: isActive ? 'ACTIVE' : 'EXITED',
      firstSnapshotDate: new Date(firstPoint.date),
      lastSnapshotDate: new Date(lastPoint.date)
    };
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error calculating asset performance for ${ticker}:`, error);
    return null;
  }
}

/**
 * Lista todos os ativos que passaram pelo índice com suas performances
 */
export async function listAllAssetsPerformance(
  indexId: string
): Promise<AssetPerformance[]> {
  try {
    // Buscar todos os pontos históricos com snapshot
    const historyPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        compositionSnapshot: true
      }
    });

    // Coletar todos os tickers únicos que apareceram em algum snapshot
    const allTickers = new Set<string>();
    
    for (const point of historyPoints) {
      if (point.compositionSnapshot) {
        const snapshot = point.compositionSnapshot as any;
        Object.keys(snapshot).forEach(ticker => allTickers.add(ticker));
      }
    }

    // Calcular performance para cada ticker
    const performances: AssetPerformance[] = [];
    
    for (const ticker of allTickers) {
      const performance = await calculateAssetPerformance(indexId, ticker);
      if (performance) {
        performances.push(performance);
      }
    }

    return performances.sort((a, b) => {
      // Ordenar por data de entrada (mais recente primeiro)
      return b.entryDate.getTime() - a.entryDate.getTime();
    });
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error listing assets performance:`, error);
    return [];
  }
}

/**
 * Calcula DY médio ponderado da carteira atual
 */
export async function calculateCurrentYield(indexId: string): Promise<number | null> {
  try {
    const composition = await prisma.indexComposition.findMany({
      where: { indexId }
    });

    if (composition.length === 0) {
      return null;
    }

    let totalWeightedYield = 0;
    let totalWeight = 0;

    for (const comp of composition) {
      const company = await prisma.company.findUnique({
        where: { ticker: comp.assetTicker },
        include: {
          financialData: {
            orderBy: { year: 'desc' },
            take: 1
          }
        }
      });

      if (company?.financialData?.[0]?.dy) {
        const dy = Number(company.financialData[0].dy) * 100; // Converter para porcentagem
        totalWeightedYield += comp.targetWeight * dy;
        totalWeight += comp.targetWeight;
      }
    }

    return totalWeight > 0 ? totalWeightedYield / totalWeight : null;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error calculating current yield for index ${indexId}:`, error);
    return null;
  }
}

