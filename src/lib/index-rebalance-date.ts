/**
 * Index Rebalance Date Service
 * 
 * Funcionalidade para re-gerar rebalanceamento de um dia específico
 * e recalcular o índice a partir dessa data
 */

import { prisma } from '@/lib/prisma';
import { runScreening, compareComposition, generateRebalanceReason, filterByQuality, getLastScreeningDetails, ensureScreeningLogOncePerDay } from './index-screening-engine';
import { updateIndexPoints, fixIndexStartingPoint, checkMarketWasOpen } from './index-engine';
import { getYahooHistoricalPrice } from './quote-service';
import { getTodayInBrazil } from './market-status';

/**
 * Verifica se o mercado B3 está aberto no momento atual (horário de Brasília)
 */
function isBrazilMarketOpen(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  // Mercado B3: Segunda a Sexta, 10h às 18h (horário de Brasília)
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 18;
}

// Importar calculateWeights do index-screening-engine (função privada, precisamos recriar a lógica)

/**
 * Busca preços históricos para uma data específica
 * Tenta buscar o último preço disponível até aquela data
 */
export async function getHistoricalPricesForDate(
  tickers: string[],
  targetDate: Date
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Normalizar data usando timezone de Brasília
  // A data recebida já deve estar normalizada, mas vamos garantir
  const date = targetDate;
  
  for (const ticker of tickers) {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true }
    });

    if (!company) {
      console.warn(`⚠️ [REBALANCE DATE] Company not found for ${ticker}`);
      continue;
    }

    // SEMPRE tentar Yahoo Finance primeiro para todos os ativos
    console.log(`📊 [REBALANCE DATE] Fetching from Yahoo Finance first for ${ticker}...`);
    const yahooPrice = await getYahooHistoricalPrice(ticker, date);
    if (yahooPrice && yahooPrice > 0) {
      prices.set(ticker, yahooPrice);
      console.log(`✅ [REBALANCE DATE] Using Yahoo Finance price for ${ticker}: ${yahooPrice.toFixed(2)}`);
      continue; // Próximo ticker
    } else {
      console.warn(`⚠️ [REBALANCE DATE] Yahoo Finance failed for ${ticker}, falling back to database...`);
    }

    // Fallback: buscar do banco de dados
    // 1. Tentar buscar historicalPrice mais recente até a data alvo
    const historicalPrice = await prisma.historicalPrice.findFirst({
      where: {
        companyId: company.id,
        date: {
          lte: date
        }
      },
      orderBy: { date: 'desc' },
      take: 1
    });

    if (historicalPrice) {
      prices.set(ticker, Number(historicalPrice.close));
      continue;
    }

    // 2. Fallback: buscar dailyQuote mais recente até a data alvo
    const dailyQuote = await prisma.dailyQuote.findFirst({
      where: {
        companyId: company.id,
        date: {
          lte: date
        }
      },
      orderBy: { date: 'desc' },
      take: 1
    });

    if (dailyQuote) {
      prices.set(ticker, Number(dailyQuote.price));
      continue;
    }

    // Se não encontrou preço histórico, buscar o mais antigo disponível (como último recurso)
    const earliestPrice = await prisma.dailyQuote.findFirst({
      where: { companyId: company.id },
      orderBy: { date: 'asc' },
      take: 1
    });

    if (earliestPrice) {
      console.warn(`⚠️ [REBALANCE DATE] No price found for ${ticker} on ${date.toISOString().split('T')[0]}, using earliest available: ${earliestPrice.date.toISOString().split('T')[0]}`);
      prices.set(ticker, Number(earliestPrice.price));
    } else {
      console.error(`❌ [REBALANCE DATE] No price data found for ${ticker}`);
    }
  }

  return prices;
}

/**
 * Busca preços de abertura do dia seguinte para os tickers fornecidos
 * Retorna Map com preços de abertura, ou null se não encontrar para algum ticker
 */
export async function getOpeningPriceForNextDay(
  tickers: string[],
  currentDate: Date
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Calcular data do dia seguinte usando UTC para evitar problemas de timezone
  const nextDate = new Date(currentDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  nextDate.setUTCHours(0, 0, 0, 0);
  
  for (const ticker of tickers) {
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true }
    });

    if (!company) {
      console.warn(`⚠️ [REBALANCE DATE] Company not found for ${ticker}`);
      continue;
    }

    // Buscar preço de abertura do dia seguinte em HistoricalPrice
    // Tentar primeiro com interval '1d' (diário)
    const historicalPrice = await prisma.historicalPrice.findFirst({
      where: {
        companyId: company.id,
        date: nextDate,
        interval: '1d'
      }
    });

    if (historicalPrice && historicalPrice.open) {
      prices.set(ticker, Number(historicalPrice.open));
      continue;
    }

    // Se não encontrou com interval '1d', tentar qualquer intervalo para aquele dia
    const anyHistoricalPrice = await prisma.historicalPrice.findFirst({
      where: {
        companyId: company.id,
        date: nextDate
      },
      orderBy: { date: 'desc' }
    });

    if (anyHistoricalPrice && anyHistoricalPrice.open) {
      prices.set(ticker, Number(anyHistoricalPrice.open));
      continue;
    }

    // Se não encontrou preço de abertura, não adicionar ao Map
    // O código chamador deve usar fallback de preço de fechamento
  }

  return prices;
}

/**
 * Atualiza composição do índice usando preços históricos de uma data específica
 * Para novos ativos, prioriza preço de abertura do dia seguinte se disponível
 */
export async function updateCompositionWithHistoricalPrices(
  indexId: string,
  newComposition: any[],
  changes: any[],
  targetDate: Date,
  rebalanceReason?: string,
  isInitialCreation: boolean = false,
  nextDayOpeningPrices?: Map<string, number>
): Promise<boolean> {
  try {
    // Buscar config do índice
    const indexDefinition = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      select: { config: true }
    });

    if (!indexDefinition) {
      throw new Error('Index definition not found');
    }

    const config = indexDefinition.config as any;

    // Buscar preços históricos para a data alvo (preços de fechamento)
    const tickers = newComposition.map((c: any) => c.ticker);
    const historicalPrices = await getHistoricalPricesForDate(tickers, targetDate);

    // Calcular pesos baseado no tipo configurado
    const weights = new Map<string, number>();
    const weightType = config.weights?.type || 'equal';

    if (weightType === 'equal') {
      const equalWeight = 1.0 / newComposition.length;
      newComposition.forEach((c: any) => weights.set(c.ticker, equalWeight));
    } else if (weightType === 'marketCap') {
      const totalMarketCap = newComposition.reduce((sum: number, c: any) => sum + (c.marketCap || 0), 0);
      if (totalMarketCap > 0) {
        newComposition.forEach((c: any) => {
          const marketCap = c.marketCap || 0;
          weights.set(c.ticker, marketCap / totalMarketCap);
        });
      } else {
        // Fallback para equal weight
        const equalWeight = 1.0 / newComposition.length;
        newComposition.forEach((c: any) => weights.set(c.ticker, equalWeight));
      }
    } else if (weightType === 'custom') {
      const customWeights = config.weights?.customWeights || {};
      let totalCustomWeight = 0;
      const customWeightsMap = new Map<string, number>();

      for (const candidate of newComposition) {
        const ticker = candidate.ticker.toUpperCase();
        const customWeight = customWeights[ticker] || customWeights[candidate.ticker];
        if (customWeight !== undefined && customWeight !== null) {
          customWeightsMap.set(candidate.ticker, customWeight);
          totalCustomWeight += customWeight;
        }
      }

      if (totalCustomWeight > 0) {
        const normalizationFactor = 1.0 / totalCustomWeight;
        customWeightsMap.forEach((weight, ticker) => {
          weights.set(ticker, weight * normalizationFactor);
        });
      } else {
        const equalWeight = 1.0 / newComposition.length;
        newComposition.forEach((c: any) => weights.set(c.ticker, equalWeight));
      }
    } else {
      // Fallback: equal weight
      const equalWeight = 1.0 / newComposition.length;
      newComposition.forEach((c: any) => weights.set(c.ticker, equalWeight));
    }

    // Usar a data recebida diretamente (já deve estar normalizada)
    const date = targetDate;

    // Identificar quais ativos são novos (entradas)
    const entryTickers = new Set(
      changes
        .filter(c => c.action === 'ENTRY')
        .map(c => c.ticker)
    );

    // Remover composição antiga
    await prisma.indexComposition.deleteMany({
      where: { indexId }
    });

    // Criar nova composição usando preços históricos
    // Para novos ativos, priorizar preço de abertura do dia seguinte
    for (const candidate of newComposition) {
      let entryPrice: number | null = null;
      const isNewAsset = entryTickers.has(candidate.ticker);

      if (isNewAsset && nextDayOpeningPrices && nextDayOpeningPrices.has(candidate.ticker)) {
        // Novo ativo: usar preço de abertura do dia seguinte se disponível
        entryPrice = nextDayOpeningPrices.get(candidate.ticker)!;
        console.log(`📈 [REBALANCE DATE] Using opening price for new asset ${candidate.ticker}: ${entryPrice.toFixed(2)}`);
      } else {
        // Ativo existente ou novo sem preço de abertura: usar preço de fechamento do dia atual
        entryPrice = historicalPrices.get(candidate.ticker) || candidate.currentPrice || null;
        
        if (isNewAsset && !entryPrice) {
          console.warn(`⚠️ [REBALANCE DATE] No opening price found for new asset ${candidate.ticker}, using closing price`);
          entryPrice = historicalPrices.get(candidate.ticker) || candidate.currentPrice || null;
        }
      }

      if (!entryPrice || entryPrice <= 0) {
        console.warn(`⚠️ [REBALANCE DATE] Invalid entry price for ${candidate.ticker}, skipping`);
        continue;
      }

      const targetWeight = weights.get(candidate.ticker) || (1.0 / newComposition.length);

      // Para novos ativos, usar data do dia seguinte como entryDate (quando usar preço de abertura)
      // Caso contrário, usar a data atual
      const entryDate = (isNewAsset && nextDayOpeningPrices && nextDayOpeningPrices.has(candidate.ticker))
        ? (() => {
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            return nextDate;
          })()
        : date;

      await prisma.indexComposition.create({
        data: {
          indexId,
          assetTicker: candidate.ticker,
          targetWeight,
          entryPrice,
          entryDate
        }
      });
    }

    // Criar logs de rebalanceamento
    // Se é criação inicial, criar apenas um log de REBALANCE e logs de ENTRY para cada ativo
    if (isInitialCreation) {
      // Para criação inicial, criar log de REBALANCE apenas uma vez
      if (rebalanceReason) {
        await prisma.indexRebalanceLog.create({
          data: {
            indexId,
            date,
            action: 'REBALANCE',
            ticker: 'SYSTEM',
            reason: rebalanceReason
          }
        });
      }
      
      // Criar logs de ENTRY para cada ativo (já estão em changes)
      for (const change of changes) {
        await prisma.indexRebalanceLog.create({
          data: {
            indexId,
            date,
            action: change.action,
            ticker: change.ticker,
            reason: change.reason
          }
        });
      }
    } else {
      // Rebalanceamento normal: criar log de REBALANCE e logs individuais
      if (changes.length > 0 && rebalanceReason) {
        await prisma.indexRebalanceLog.create({
          data: {
            indexId,
            date,
            action: 'REBALANCE',
            ticker: 'SYSTEM',
            reason: rebalanceReason
          }
        });
      }

      // Criar logs individuais para cada mudança
      for (const change of changes) {
        await prisma.indexRebalanceLog.create({
          data: {
            indexId,
            date,
            action: change.action,
            ticker: change.ticker,
            reason: change.reason
          }
        });
      }
    }

    console.log(`✅ [REBALANCE DATE] Updated composition for index ${indexId} using prices from ${date.toISOString().split('T')[0]}`);

    return true;
  } catch (error) {
    console.error(`❌ [REBALANCE DATE] Error updating composition:`, error);
    return false;
  }
}

/**
 * Re-gera rebalanceamento de um dia específico e recalcula o índice a partir dessa data
 * 
 * FLUXO:
 * - DIA 1 (Marco Zero): Screening inicial + criar composição + ponto inicial 100
 * - DIA 2+: Para cada dia útil: After Market primeiro, depois Rebalanceamento (se necessário)
 */
export async function regenerateRebalanceForDate(
  indexId: string,
  targetDate: Date
): Promise<{
  success: boolean;
  message: string;
  recalculatedDays: number;
  errors: string[];
}> {
  try {
    // Normalizar data usando timezone de Brasília
    let date: Date;
    if (targetDate instanceof Date) {
      // Se já é uma Date, usar diretamente (assumindo que já está normalizada)
      date = targetDate;
    } else {
      const dateStr = String(targetDate);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Criar data a partir de string YYYY-MM-DD usando timezone de Brasília
        const [year, month, day] = dateStr.split('-').map(Number);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const now = new Date();
        const parts = formatter.formatToParts(now);
        // Criar data UTC que representa o início do dia em Brasília
        // Usar mesma lógica de getTodayInBrazil
        const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        const testParts = formatter.formatToParts(testDate);
        const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0', 10);
        const offset = 12 - testHour;
        const utcHour = 0 + offset;
        date = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0));
      } else {
        date = new Date(targetDate);
      }
    }
    
    // Formatar string da data usando timezone de Brasília
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Buscar índice
    const index = await prisma.indexDefinition.findUnique({
      where: { id: indexId },
      include: {
        composition: true
      }
    });

    if (!index) {
      return {
        success: false,
        message: 'Índice não encontrado',
        recalculatedDays: 0,
        errors: ['Índice não encontrado']
      };
    }

    const config = index.config as any;

    // Verificar se é criação inicial (sem histórico anterior à data alvo)
    const lastPointBefore = await prisma.indexHistoryPoints.findFirst({
      where: {
        indexId,
        date: {
          lt: date
        }
      },
      orderBy: { date: 'desc' }
    });

    const isInitialCreation = !lastPointBefore;
    
    if (isInitialCreation) {
      console.log(`🆕 [REBALANCE DATE] DIA 1 (Marco Zero): RECRIAÇÃO COMPLETA do índice em ${targetDateStr}`);
      
      // ========== DIA 1: RECRIAÇÃO COMPLETA - DELETAR TUDO E RECRIAR ==========
      
      // 0. DELETAR TUDO que existe da data alvo em diante (forçar recriação completa)
      console.log(`🗑️ [REBALANCE DATE] Deletando TODOS os dados existentes de ${targetDateStr} em diante para recriação completa`);
      
      // Deletar pontos históricos (usar date diretamente, já normalizado)
      const deletedPoints = await prisma.indexHistoryPoints.deleteMany({
        where: {
          indexId,
          date: {
            gte: date
          }
        }
      });
      console.log(`🗑️ [REBALANCE DATE] Deletados ${deletedPoints.count} ponto(s) histórico(s)`);
      
      // Deletar logs de rebalanceamento (usar date diretamente)
      const deletedLogs = await prisma.indexRebalanceLog.deleteMany({
        where: {
          indexId,
          date: {
            gte: date
          }
        }
      });
      console.log(`🗑️ [REBALANCE DATE] Deletados ${deletedLogs.count} log(s) de rebalanceamento`);
      
      // Deletar composição (será recriada abaixo)
      const deletedComposition = await prisma.indexComposition.deleteMany({
        where: { indexId }
      });
      console.log(`🗑️ [REBALANCE DATE] Deletada composição existente (${deletedComposition.count} ativo(s))`);
      
      // 1. Executar screening inicial
      console.log(`📊 [REBALANCE DATE] Executando screening inicial para ${index.ticker}`);
      const idealComposition = await runScreening(index);

      if (idealComposition.length === 0) {
        return {
          success: false,
          message: 'Nenhuma empresa encontrada no screening',
          recalculatedDays: 0,
          errors: ['Nenhuma empresa encontrada no screening']
        };
      }

      // 2. Aplicar validação de qualidade se checkQuality estiver ativado
      let validatedComposition = idealComposition;
      let qualityRejected: Array<{ candidate: any; reason: string }> = [];

      if (config.rebalance?.checkQuality) {
        const qualityResult = await filterByQuality(idealComposition, config);
        validatedComposition = qualityResult.valid;
        qualityRejected = qualityResult.rejected;

        if (validatedComposition.length === 0) {
          return {
            success: false,
            message: 'Nenhuma empresa passou na validação de qualidade',
            recalculatedDays: 0,
            errors: ['Nenhuma empresa passou na validação de qualidade']
          };
        }
      }

      // 3. Criar logs de entrada para todos os ativos
      const changes = validatedComposition.map((candidate, index) => ({
        action: 'ENTRY' as const,
        ticker: candidate.ticker,
        reason: `Recriação do índice - Ativo selecionado no screening (posição ${index + 1}/${validatedComposition.length}, Modelo: ${candidate.fairValueModel || 'N/A'}, Upside: ${candidate.upside !== null && candidate.upside !== undefined ? `${candidate.upside.toFixed(1)}%` : 'N/A'}, Score: ${candidate.overallScore?.toFixed(0) || 'N/A'})`
      }));
      
      const rebalanceReason = 'Recriação completa do índice do zero';

      // 4. Criar composição inicial com preços de fechamento do DIA 1
      const updateSuccess = await updateCompositionWithHistoricalPrices(
        indexId,
        validatedComposition,
        changes,
        date,
        rebalanceReason,
        true // isInitialCreation
      );

      if (!updateSuccess) {
        return {
          success: false,
          message: 'Erro ao criar composição inicial',
          recalculatedDays: 0,
          errors: ['Erro ao criar composição inicial']
        };
      }
      
      console.log(`✅ [REBALANCE DATE] Composição inicial criada com ${validatedComposition.length} ativos`);

      // 5. Criar ponto histórico inicial com 100 pontos (sem calcular variação)
      await prisma.indexHistoryPoints.create({
        data: {
          indexId,
          date,
          points: 100.0,
          dailyChange: 0.0,
          currentYield: null
        }
      });

      console.log(`✅ [REBALANCE DATE] Ponto inicial criado com 100 pontos para ${targetDateStr}`);

      // Corrigir ponto inicial se necessário (criar ponto virtual no dia anterior)
      const fixedStartingPoint = await fixIndexStartingPoint(indexId);
      if (fixedStartingPoint) {
        console.log(`✅ [REBALANCE DATE] Ponto inicial corrigido (criado ponto virtual com 100 pontos)`);
      }

      // CONTINUAR: Processar dias seguintes (DIA 2 em diante) até hoje
      console.log(`\n📅 [REBALANCE DATE] Continuando processamento dos dias seguintes a partir de ${targetDateStr}`);
      
      // Determinar data limite (hoje ou ontem se mercado aberto)
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      const marketOpenToday = isBrazilMarketOpen();
      const endDate = (date.getTime() === todayDate.getTime() && marketOpenToday)
        ? (() => {
            const yesterday = new Date(todayDate);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            return yesterday;
          })()
        : todayDate;
      
      // Formatar endDate usando timezone de Brasília
      const endDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const endDateParts = endDateFormatter.formatToParts(endDate);
      const endYear = parseInt(endDateParts.find(p => p.type === 'year')?.value || '0', 10);
      const endMonth = parseInt(endDateParts.find(p => p.type === 'month')?.value || '0', 10);
      const endDay = parseInt(endDateParts.find(p => p.type === 'day')?.value || '0', 10);
      const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      if (date.getTime() === todayDate.getTime() && marketOpenToday) {
        console.log(`📊 [REBALANCE DATE] Mercado aberto hoje, calculando apenas até ${endDateStr} (ontem)`);
      } else {
        console.log(`📊 [REBALANCE DATE] Processando de ${targetDateStr} até ${endDateStr}`);
      }

      const errors: string[] = [];
      let recalculatedDays = 0;
      let currentDate = new Date(date);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Começar do dia seguinte ao DIA 1
      currentDate.setUTCHours(0, 0, 0, 0);

      // Loop para cada dia útil a partir do DIA 2
      while (currentDate <= endDate) {
        try {
          // Verificar se é dia útil usando timezone de Brasília
          const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
          });
          const weekday = weekdayFormatter.format(currentDate);
          const dayMap: Record<string, number> = {
            Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
          };
          const dayOfWeek = dayMap[weekday] ?? 0;
          
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            currentDate.setUTCHours(0, 0, 0, 0);
            continue;
          }

          // Verificar se é o dia atual e se o mercado está aberto
          const isCurrentDateToday = currentDate.getTime() === todayDate.getTime();
          if (isCurrentDateToday && isBrazilMarketOpen()) {
            console.log(`⏸️ [REBALANCE DATE] Mercado aberto hoje (${currentDate.toISOString().split('T')[0]}), pulando cálculo para hoje`);
            break; // Não calcular pontos para hoje se o mercado estiver aberto
          }

          const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          
          // Verificar se houve pregão antes de processar
          const marketWasOpen = await checkMarketWasOpen(currentDate);
          if (!marketWasOpen) {
            const dayOfWeek = currentDate.getDay();
            const dayName = dayOfWeek === 0 ? 'domingo' : dayOfWeek === 6 ? 'sábado' : 'feriado';
            console.log(`  ⏸️ [REBALANCE DATE] Pulando ${currentDateStr} (${dayName} - mercado não funcionou)`);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }
          
          console.log(`\n📅 [REBALANCE DATE] Processando ${currentDateStr}`);

          // ========== PASSO 1: AFTER MARKET ==========
          // Calcular e salvar pontos do dia usando composição atual e preços de fechamento
          console.log(`  📊 [AFTER MARKET] Calculando pontos do dia com composição atual`);
          
          const afterMarketSuccess = await updateIndexPoints(indexId, currentDate);
          
          if (!afterMarketSuccess) {
            const errorMsg = `Falha ao calcular after market para ${currentDateStr}`;
            console.error(`  ❌ [AFTER MARKET] ${errorMsg}`);
            errors.push(errorMsg);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }

          const afterMarketPoint = await prisma.indexHistoryPoints.findUnique({
            where: {
              indexId_date: {
                indexId,
                date: currentDate
              }
            }
          });

          if (afterMarketPoint) {
            console.log(`  ✅ [AFTER MARKET] Pontos calculados: ${afterMarketPoint.points.toFixed(2)} (variação: ${afterMarketPoint.dailyChange.toFixed(2)}%)`);
            recalculatedDays++;
          } else {
            console.warn(`  ⚠️ [AFTER MARKET] Ponto não encontrado após cálculo`);
          }

          // ========== PASSO 2: REBALANCEAMENTO (se necessário) ==========
          // Executar screening e verificar se precisa rebalancear
          console.log(`  🔄 [REBALANCE] Executando screening para verificar necessidade de rebalanceamento`);
          
          // Buscar composição atual (pode ter mudado em dias anteriores)
          const currentComposition = await prisma.indexComposition.findMany({
            where: { indexId }
          });

          // Executar screening
          const idealComposition = await runScreening(index);

          if (idealComposition.length === 0) {
            console.warn(`  ⚠️ [REBALANCE] Nenhuma empresa encontrada no screening, mantendo composição atual`);
            
            // Garantir que o log seja criado apenas uma vez por dia
            await ensureScreeningLogOncePerDay(
              indexId,
              currentDate,
              'Rotina de rebalanceamento executada: nenhuma empresa encontrada no screening'
            );
            
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }

          // Aplicar validação de qualidade
          let validatedComposition = idealComposition;
          let qualityRejected: Array<{ candidate: any; reason: string }> = [];

          if (config.rebalance?.checkQuality) {
            const qualityResult = await filterByQuality(idealComposition, config);
            validatedComposition = qualityResult.valid;
            qualityRejected = qualityResult.rejected;

            if (validatedComposition.length === 0) {
              console.warn(`  ⚠️ [REBALANCE] Nenhuma empresa passou na validação de qualidade, mantendo composição atual`);
              
              // Garantir que o log seja criado apenas uma vez por dia
              await ensureScreeningLogOncePerDay(
                indexId,
                currentDate,
                'Rotina de rebalanceamento executada: nenhuma empresa passou na validação de qualidade'
              );
              
              currentDate.setDate(currentDate.getDate() + 1);
              currentDate.setHours(0, 0, 0, 0);
              continue;
            }
          }

          // Comparar com composição atual
          const screeningDetails = getLastScreeningDetails();
          const changes = compareComposition(
            currentComposition,
            validatedComposition,
            config,
            qualityRejected,
            undefined,
            screeningDetails?.candidatesBeforeSelection,
            screeningDetails?.removedByDiversification
          );

          // Se houver mudanças, atualizar composição
          if (changes.length > 0) {
            console.log(`  🔄 [REBALANCE] ${changes.filter(c => c.action === 'ENTRY').length} entrada(s) e ${changes.filter(c => c.action === 'EXIT').length} saída(s) detectadas`);

            // Gerar motivo do rebalanceamento
            const threshold = config.rebalance?.threshold || 0.05;
            const upsideType = config.rebalance?.upsideType || 'best';
            const rebalanceReason = generateRebalanceReason(
              currentComposition,
              validatedComposition,
              threshold,
              config.rebalance?.checkQuality || false,
              upsideType,
              config,
              qualityRejected
            );

            // Buscar preços de abertura do dia seguinte para novos ativos
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const entryTickers = changes
              .filter(c => c.action === 'ENTRY')
              .map(c => c.ticker);
            
            let nextDayOpeningPrices: Map<string, number> | undefined;
            if (entryTickers.length > 0) {
              console.log(`  📈 [REBALANCE] Buscando preços de abertura do dia seguinte para ${entryTickers.length} novo(s) ativo(s)`);
              nextDayOpeningPrices = await getOpeningPriceForNextDay(entryTickers, currentDate);
              
              const foundOpeningPrices = Array.from(nextDayOpeningPrices.keys()).length;
              if (foundOpeningPrices > 0) {
                console.log(`  ✅ [REBALANCE] Encontrados preços de abertura para ${foundOpeningPrices}/${entryTickers.length} ativo(s)`);
              } else {
                console.log(`  ⚠️ [REBALANCE] Nenhum preço de abertura encontrado, usando preços de fechamento como fallback`);
              }
            }

            // Atualizar composição usando preços de abertura do dia seguinte (ou fechamento como fallback)
            const updateSuccess = await updateCompositionWithHistoricalPrices(
              indexId,
              validatedComposition,
              changes,
              currentDate,
              rebalanceReason,
              false, // isInitialCreation
              nextDayOpeningPrices
            );

            if (updateSuccess) {
              console.log(`  ✅ [REBALANCE] Composição atualizada com sucesso`);
            } else {
              console.error(`  ❌ [REBALANCE] Erro ao atualizar composição`);
              errors.push(`Erro ao atualizar composição em ${currentDateStr}`);
            }
          } else {
            console.log(`  ✅ [REBALANCE] Nenhuma mudança necessária, composição mantida`);
            
            // Garantir que o log seja criado apenas uma vez por dia
            const logCreated = await ensureScreeningLogOncePerDay(
              indexId,
              currentDate,
              'Rotina de rebalanceamento executada: nenhuma mudança necessária na composição após screening'
            );
            
            if (logCreated) {
              console.log(`  📝 [REBALANCE] Log criado: rotina executada sem mudanças`);
            } else {
              console.log(`  📝 [REBALANCE] Log já existe para esta data, pulando criação`);
            }
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          console.error(`  ❌ [REBALANCE DATE] Erro ao processar ${currentDateStr}: ${errorMsg}`);
          errors.push(`Erro ao processar ${currentDateStr}: ${errorMsg}`);
        }

        // Avançar para o próximo dia útil usando UTC
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        currentDate.setUTCHours(0, 0, 0, 0);
      }
      
      console.log(`\n📊 [REBALANCE DATE] Processamento concluído: ${recalculatedDays} dias processados após DIA 1, ${errors.length} erros`);

      return {
        success: true,
        message: `Índice RECRIADO completamente em ${targetDateStr}. Composição com ${validatedComposition.length} ativos. Ponto inicial: 100 pontos. ${recalculatedDays} dias processados após DIA 1.${fixedStartingPoint ? ' Ponto virtual criado no dia anterior.' : ''}`,
        recalculatedDays,
        errors
      };

    } else {
      console.log(`🔄 [REBALANCE DATE] DIA 2+: Rebalanceamento a partir de ${targetDateStr} (último ponto antes: ${lastPointBefore.date.toISOString().split('T')[0]})`);
      
      // ========== DIA 2+: AFTER MARKET + REBALANCEAMENTO ==========
      
      // Deletar todos os pontos históricos da data alvo em diante
      console.log(`🗑️ [REBALANCE DATE] Deletando todos os pontos históricos de ${targetDateStr} em diante`);
      
      const deletedCount = await prisma.indexHistoryPoints.deleteMany({
        where: {
          indexId,
          date: {
            gte: date
          }
        }
      });
      
      console.log(`🗑️ [REBALANCE DATE] Deletados ${deletedCount.count} pontos existentes`);

      // Determinar data limite (hoje ou ontem se mercado aberto)
      // Usar getTodayInBrazil para garantir timezone correto
      const todayDate = getTodayInBrazil();
      
      const marketOpenToday = isBrazilMarketOpen();
      const endDate = (date.getTime() === todayDate.getTime() && marketOpenToday)
        ? (() => {
            const yesterday = new Date(todayDate);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            return yesterday;
          })()
        : todayDate;
      
      // Formatar endDate usando timezone de Brasília
      const endDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const endDateParts = endDateFormatter.formatToParts(endDate);
      const endYear = parseInt(endDateParts.find(p => p.type === 'year')?.value || '0', 10);
      const endMonth = parseInt(endDateParts.find(p => p.type === 'month')?.value || '0', 10);
      const endDay = parseInt(endDateParts.find(p => p.type === 'day')?.value || '0', 10);
      const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      if (date.getTime() === todayDate.getTime() && marketOpenToday) {
        console.log(`📊 [REBALANCE DATE] Mercado aberto hoje, calculando apenas até ${endDateStr} (ontem)`);
      } else {
        console.log(`📊 [REBALANCE DATE] Recalculando de ${targetDateStr} até ${endDateStr}`);
      }

      const errors: string[] = [];
      let recalculatedDays = 0;
      let currentDate = new Date(date);
      currentDate.setUTCHours(0, 0, 0, 0);

      // Loop para cada dia útil a partir da data alvo
      while (currentDate <= endDate) {
        try {
          // Verificar se é dia útil usando timezone de Brasília
          const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            weekday: 'short',
          });
          const weekday = weekdayFormatter.format(currentDate);
          const dayMap: Record<string, number> = {
            Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
          };
          const dayOfWeek = dayMap[weekday] ?? 0;
          
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            currentDate.setUTCHours(0, 0, 0, 0);
            continue;
          }

          // Verificar se é o dia atual e se o mercado está aberto
          const todayDateCheck = getTodayInBrazil();
          const isCurrentDateToday = currentDate.getTime() === todayDateCheck.getTime();
          if (isCurrentDateToday && isBrazilMarketOpen()) {
            console.log(`⏸️ [REBALANCE DATE] Mercado aberto hoje (${currentDate.toISOString().split('T')[0]}), pulando cálculo para hoje`);
            break; // Não calcular pontos para hoje se o mercado estiver aberto
          }

          const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          
          // Verificar se houve pregão antes de processar
          const marketWasOpen = await checkMarketWasOpen(currentDate);
          if (!marketWasOpen) {
            const dayOfWeek = currentDate.getDay();
            const dayName = dayOfWeek === 0 ? 'domingo' : dayOfWeek === 6 ? 'sábado' : 'feriado';
            console.log(`  ⏸️ [REBALANCE DATE] Pulando ${currentDateStr} (${dayName} - mercado não funcionou)`);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }
          
          console.log(`\n📅 [REBALANCE DATE] Processando ${currentDateStr}`);

          // ========== PASSO 1: AFTER MARKET ==========
          // Calcular e salvar pontos do dia usando composição atual e preços de fechamento
          console.log(`  📊 [AFTER MARKET] Calculando pontos do dia com composição atual`);
          
          const afterMarketSuccess = await updateIndexPoints(indexId, currentDate);
          
          if (!afterMarketSuccess) {
            const errorMsg = `Falha ao calcular after market para ${currentDateStr}`;
            console.error(`  ❌ [AFTER MARKET] ${errorMsg}`);
            errors.push(errorMsg);
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }

          const afterMarketPoint = await prisma.indexHistoryPoints.findUnique({
            where: {
              indexId_date: {
                indexId,
                date: currentDate
              }
            }
          });

          if (afterMarketPoint) {
            console.log(`  ✅ [AFTER MARKET] Pontos calculados: ${afterMarketPoint.points.toFixed(2)} (variação: ${afterMarketPoint.dailyChange.toFixed(2)}%)`);
            recalculatedDays++;
          } else {
            console.warn(`  ⚠️ [AFTER MARKET] Ponto não encontrado após cálculo`);
          }

          // ========== PASSO 2: REBALANCEAMENTO (se necessário) ==========
          // Executar screening e verificar se precisa rebalancear
          console.log(`  🔄 [REBALANCE] Executando screening para verificar necessidade de rebalanceamento`);
          
          // Buscar composição atual (pode ter mudado em dias anteriores)
          const currentComposition = await prisma.indexComposition.findMany({
            where: { indexId }
          });

          // Executar screening
          const idealComposition = await runScreening(index);

          if (idealComposition.length === 0) {
            console.warn(`  ⚠️ [REBALANCE] Nenhuma empresa encontrada no screening, mantendo composição atual`);
            
            // Garantir que o log seja criado apenas uma vez por dia
            await ensureScreeningLogOncePerDay(
              indexId,
              currentDate,
              'Rotina de rebalanceamento executada: nenhuma empresa encontrada no screening'
            );
            
            currentDate.setDate(currentDate.getDate() + 1);
            currentDate.setHours(0, 0, 0, 0);
            continue;
          }

          // Aplicar validação de qualidade
          let validatedComposition = idealComposition;
          let qualityRejected: Array<{ candidate: any; reason: string }> = [];

          if (config.rebalance?.checkQuality) {
            const qualityResult = await filterByQuality(idealComposition, config);
            validatedComposition = qualityResult.valid;
            qualityRejected = qualityResult.rejected;

            if (validatedComposition.length === 0) {
              console.warn(`  ⚠️ [REBALANCE] Nenhuma empresa passou na validação de qualidade, mantendo composição atual`);
              
              // Garantir que o log seja criado apenas uma vez por dia
              await ensureScreeningLogOncePerDay(
                indexId,
                currentDate,
                'Rotina de rebalanceamento executada: nenhuma empresa passou na validação de qualidade'
              );
              
              currentDate.setDate(currentDate.getDate() + 1);
              currentDate.setHours(0, 0, 0, 0);
              continue;
            }
          }

          // Comparar com composição atual
          const screeningDetails = getLastScreeningDetails();
          const changes = compareComposition(
            currentComposition,
            validatedComposition,
            config,
            qualityRejected,
            undefined,
            screeningDetails?.candidatesBeforeSelection,
            screeningDetails?.removedByDiversification
          );

          // Se houver mudanças, atualizar composição
          if (changes.length > 0) {
            console.log(`  🔄 [REBALANCE] ${changes.filter(c => c.action === 'ENTRY').length} entrada(s) e ${changes.filter(c => c.action === 'EXIT').length} saída(s) detectadas`);

            // Gerar motivo do rebalanceamento
            const threshold = config.rebalance?.threshold || 0.05;
            const upsideType = config.rebalance?.upsideType || 'best';
            const rebalanceReason = generateRebalanceReason(
              currentComposition,
              validatedComposition,
              threshold,
              config.rebalance?.checkQuality || false,
              upsideType,
              config,
              qualityRejected
            );

            // Buscar preços de abertura do dia seguinte para novos ativos
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const entryTickers = changes
              .filter(c => c.action === 'ENTRY')
              .map(c => c.ticker);
            
            let nextDayOpeningPrices: Map<string, number> | undefined;
            if (entryTickers.length > 0) {
              console.log(`  📈 [REBALANCE] Buscando preços de abertura do dia seguinte para ${entryTickers.length} novo(s) ativo(s)`);
              nextDayOpeningPrices = await getOpeningPriceForNextDay(entryTickers, currentDate);
              
              const foundOpeningPrices = Array.from(nextDayOpeningPrices.keys()).length;
              if (foundOpeningPrices > 0) {
                console.log(`  ✅ [REBALANCE] Encontrados preços de abertura para ${foundOpeningPrices}/${entryTickers.length} ativo(s)`);
              } else {
                console.log(`  ⚠️ [REBALANCE] Nenhum preço de abertura encontrado, usando preços de fechamento como fallback`);
              }
            }

            // Atualizar composição usando preços de abertura do dia seguinte (ou fechamento como fallback)
            const updateSuccess = await updateCompositionWithHistoricalPrices(
              indexId,
              validatedComposition,
              changes,
              currentDate,
              rebalanceReason,
              false, // isInitialCreation
              nextDayOpeningPrices
            );

            if (updateSuccess) {
              console.log(`  ✅ [REBALANCE] Composição atualizada com sucesso`);
            } else {
              console.error(`  ❌ [REBALANCE] Erro ao atualizar composição`);
              errors.push(`Erro ao atualizar composição em ${currentDateStr}`);
            }
          } else {
            console.log(`  ✅ [REBALANCE] Nenhuma mudança necessária, composição mantida`);
            
            // Garantir que o log seja criado apenas uma vez por dia
            const logCreated = await ensureScreeningLogOncePerDay(
              indexId,
              currentDate,
              'Rotina de rebalanceamento executada: nenhuma mudança necessária na composição após screening'
            );
            
            if (logCreated) {
              console.log(`  📝 [REBALANCE] Log criado: rotina executada sem mudanças`);
            } else {
              console.log(`  📝 [REBALANCE] Log já existe para esta data, pulando criação`);
            }
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          console.error(`  ❌ [REBALANCE DATE] Erro ao processar ${currentDateStr}: ${errorMsg}`);
          errors.push(`Erro ao processar ${currentDateStr}: ${errorMsg}`);
        }

        // Avançar para o próximo dia útil usando UTC
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        currentDate.setUTCHours(0, 0, 0, 0);
      }
      
      console.log(`\n📊 [REBALANCE DATE] Processamento concluído: ${recalculatedDays} dias processados, ${errors.length} erros`);

      // Corrigir ponto inicial se necessário
      const fixedStartingPoint = await fixIndexStartingPoint(indexId);
      if (fixedStartingPoint) {
        console.log(`✅ [REBALANCE DATE] Ponto inicial corrigido`);
      }

      return {
        success: true,
        message: `Rebalanceamento re-gerado para ${targetDateStr}. ${recalculatedDays} dias processados (after market + rebalanceamento).${fixedStartingPoint ? ' Ponto inicial corrigido.' : ''}`,
        recalculatedDays,
        errors
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [REBALANCE DATE] Erro ao re-gerar rebalanceamento:`, error);
    return {
      success: false,
      message: `Erro ao re-gerar rebalanceamento: ${errorMsg}`,
      recalculatedDays: 0,
      errors: [errorMsg]
    };
  }
}


