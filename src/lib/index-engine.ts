/**
 * Index Engine
 * 
 * Engine de cálculo de índices Preço Justo (IPJ)
 * Calcula variação diária, atualiza pontos e preenche lacunas históricas
 */

import { prisma } from '@/lib/prisma';
import { getLatestPrices, StockPrice, getYahooHistoricalPrice } from '@/lib/quote-service';
import { getHistoricalPricesForDate } from './index-rebalance-date';
import { hasIBOVQuoteForDate } from './market-status-server';

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
 * Verifica se houve pregão na B3 para uma data específica
 * Usa IBOVESPA (^BVSP) como referência para determinar se houve pregão
 * 
 * IMPORTANTE: Sempre usa timezone de Brasília para evitar problemas de conversão
 * 
 * @param date Data a verificar
 * @returns true se houve pregão, false caso contrário (sábado, domingo ou feriado)
 */
export async function checkMarketWasOpen(date: Date): Promise<boolean> {
  try {
    // Normalizar data usando timezone de Brasília para evitar problemas de conversão
    // A data recebida já deve estar no formato correto (de getTodayInBrazil)
    // Mas vamos garantir que estamos usando o dia correto no timezone de Brasília
    
    // Obter componentes da data no timezone de Brasília
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
    
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1; // month é 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    
    // Verificar se é sábado (6) ou domingo (0) usando o dia da semana em Brasília
    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
    };
    const dayOfWeek = dayMap[weekday] ?? 0;
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`⏸️ [MARKET CHECK] ${dateStr} é ${dayOfWeek === 0 ? 'domingo' : 'sábado'}, mercado fechado`);
      return false;
    }
    
    // Se for dia útil (segunda a sexta), verificar se houve pregão consultando IBOVESPA
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const hasQuote = await hasIBOVQuoteForDate(date);
    
    if (hasQuote) {
      console.log(`✅ [MARKET CHECK] ${dateStr}: Pregão confirmado (IBOVESPA)`);
      return true;
    } else {
      console.log(`⏸️ [MARKET CHECK] ${dateStr}: Nenhuma cotação do IBOVESPA encontrada para esta data exata, assumindo que não houve pregão`);
      return false;
    }
  } catch (error) {
    // Formatar data de erro também usando timezone de Brasília
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    console.error(`❌ [MARKET CHECK] Erro ao verificar pregão para ${dateStr}:`, error);
    // Em caso de erro, assumir que não houve pregão para evitar cálculos incorretos
    return false;
  }
}

/**
 * Busca dividendos com ex-date igual à data especificada para todos os ativos da composição
 * 
 * IMPORTANTE: No mercado brasileiro, o ex-date é o próprio dia em que o preço já está ajustado
 * (já foi descontado no pregão). Portanto, ao calcular pontos para 01/12, buscamos dividendos
 * com exDate = 01/12, pois é neste dia que o preço já caiu pelo valor do dividendo.
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

    // Normalizar data para evitar problemas de timezone
    // Como exDate é @db.Date (sem hora), precisamos garantir que estamos comparando apenas a parte da data
    // CRÍTICO: Usar apenas a parte da data, sem considerar hora/timezone
    // Extrair componentes da data de entrada (usar métodos locais para preservar a data correta)
    const inputYear = date.getFullYear();
    const inputMonth = date.getMonth();
    const inputDay = date.getDate();
    
    // Criar datas usando UTC para garantir que não haja problemas de timezone
    // O campo exDate no banco é DATE (sem hora), então precisamos comparar apenas a parte da data
    // Usar Date.UTC para criar datas que representam exatamente um dia completo
    const dateStart = new Date(Date.UTC(inputYear, inputMonth, inputDay, 0, 0, 0, 0));
    // Para dateEnd, usar o início do dia seguinte e subtrair 1ms para garantir que pegamos todo o dia
    const dateEnd = new Date(Date.UTC(inputYear, inputMonth, inputDay + 1, 0, 0, 0, 0));
    dateEnd.setUTCMilliseconds(dateEnd.getUTCMilliseconds() - 1);

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
        amount: true,
        exDate: true // Incluir exDate para debug se necessário
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

    // Log para debug: mostrar dividendos encontrados para esta data
    if (dividends.size > 0) {
      console.log(`💰 [INDEX ENGINE] Dividends found for ${date.toISOString().split('T')[0]}:`, 
        Object.fromEntries(dividends));
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

    // 2. Buscar último ponto histórico ANTES da data sendo calculada (para pegar pontos do dia anterior)
    // CRÍTICO: Buscar ponto onde date < date sendo calculada, não apenas o mais recente
    // Isso evita usar pontos do próprio dia ou dias futuros
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    console.log(`📊 [INDEX ENGINE] Looking for previous point before date: ${normalizedDate.toISOString().split('T')[0]}`);
    
    const lastHistoryPoint = await prisma.indexHistoryPoints.findFirst({
      where: {
        indexId,
        date: {
          lt: normalizedDate // Apenas pontos ANTES da data sendo calculada
        }
      },
      orderBy: { date: 'desc' }
    });

    // Se não há histórico anterior, este é o primeiro dia (base 100)
    const isFirstDay = !lastHistoryPoint;
    const previousPoints = lastHistoryPoint?.points || 100.0;
    
    // Log detalhado para debug
    if (lastHistoryPoint) {
      console.log(`📊 [INDEX ENGINE] ✅ Previous point found: ${lastHistoryPoint.date.toISOString().split('T')[0]} = ${previousPoints.toFixed(6)} pts`);
    } else {
      console.log(`📊 [INDEX ENGINE] ⚠️ No previous point found before ${normalizedDate.toISOString().split('T')[0]}, using base 100.0`);
      
      // Debug: verificar se há pontos no índice (pode ser que esteja buscando errado)
      const allPoints = await prisma.indexHistoryPoints.findMany({
        where: { indexId },
        orderBy: { date: 'desc' },
        take: 5,
        select: { date: true, points: true }
      });
      if (allPoints.length > 0) {
        console.log(`📊 [INDEX ENGINE] 🔍 Debug: Found ${allPoints.length} recent points:`);
        allPoints.forEach(p => {
          const pDate = new Date(p.date).toISOString().split('T')[0];
          const isBefore = new Date(p.date) < normalizedDate;
          console.log(`   - ${pDate}: ${p.points.toFixed(6)} pts ${isBefore ? '✅ (before)' : '❌ (not before)'}`);
        });
      }
    }

    // 3. Buscar preços de fechamento do dia atual (necessário para snapshot e cálculo)
    const tickers = composition.map(c => c.assetTicker);
    
    // Se a data não for hoje, buscar preços históricos para aquela data específica
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const isRetroactiveProcessing = targetDate.getTime() < today.getTime();
    const isToday = targetDate.getTime() === today.getTime();
    
    let pricesToday: Map<string, StockPrice>;
    if (isRetroactiveProcessing || isToday) {
      // Data no passado ou hoje: SEMPRE buscar do Yahoo Finance para garantir preço de fechamento oficial
      // Isso garante consistência mesmo quando CRON roda após fechamento do mercado
      const processingType = isRetroactiveProcessing ? 'Retroactive' : 'Real-time';
      console.log(`📊 [INDEX ENGINE] ${processingType} processing: Fetching prices from Yahoo Finance for ${targetDate.toISOString().split('T')[0]}`);
      pricesToday = new Map();
      
      // Buscar preços do Yahoo Finance para cada ticker na data exata
      for (const ticker of tickers) {
        const yahooPrice = await getYahooHistoricalPrice(ticker, targetDate);
        if (yahooPrice && yahooPrice > 0) {
          pricesToday.set(ticker, {
            ticker,
            price: yahooPrice,
            source: 'yahoo',
            timestamp: targetDate
          });
          console.log(`✅ [INDEX ENGINE] Yahoo Finance price for ${ticker} on ${targetDate.toISOString().split('T')[0]}: ${yahooPrice.toFixed(2)}`);
        } else {
          // Fallback: usar getLatestPrices se histórico não disponível (pode acontecer para data futura ou se Yahoo Finance falhar)
          console.warn(`⚠️ [INDEX ENGINE] Yahoo Finance failed for ${ticker} on ${targetDate.toISOString().split('T')[0]}, trying fallback...`);
          if (isRetroactiveProcessing) {
            // Para processamento retroativo, tentar getHistoricalPricesForDate
            const historicalPrices = await getHistoricalPricesForDate([ticker], targetDate);
            const fallbackPrice = historicalPrices.get(ticker);
            if (fallbackPrice && fallbackPrice > 0) {
              pricesToday.set(ticker, {
                ticker,
                price: fallbackPrice,
                source: 'database',
                timestamp: targetDate
              });
              console.log(`📊 [INDEX ENGINE] Using fallback price for ${ticker}: ${fallbackPrice.toFixed(2)}`);
            } else {
              console.error(`❌ [INDEX ENGINE] No price found for ${ticker} on ${targetDate.toISOString().split('T')[0]}`);
            }
          } else {
            // Para data atual, usar getLatestPrices como último recurso
            const latestPrices = await getLatestPrices([ticker]);
            const latestPrice = latestPrices.get(ticker);
            if (latestPrice) {
              pricesToday.set(ticker, latestPrice);
              console.log(`📊 [INDEX ENGINE] Using latest price as fallback for ${ticker}: ${latestPrice.price.toFixed(2)}`);
            } else {
              console.error(`❌ [INDEX ENGINE] No price found for ${ticker} on ${targetDate.toISOString().split('T')[0]}`);
            }
          }
        }
      }
    } else {
      // Data futura: usar preços mais recentes
      pricesToday = await getLatestPrices(tickers);
    }

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

    // 3.5. Buscar preços do dia anterior
    const pricesYesterday = new Map<string, number>();
    
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); // Normalizar para meia-noite
    
    for (const comp of composition) {
      // Se processamento retroativo, SEMPRE buscar do Yahoo Finance para o dia anterior exato
      if (isRetroactiveProcessing) {
        console.log(`📊 [INDEX ENGINE] Retroactive processing: Fetching yesterday price from Yahoo Finance for ${comp.assetTicker} on ${yesterday.toISOString().split('T')[0]}`);
        const yahooPrice = await getYahooHistoricalPrice(comp.assetTicker, yesterday);
        if (yahooPrice && yahooPrice > 0) {
          // Validação: Se o ativo entrou no dia anterior (entryDate = yesterday), 
          // o preço de ontem deve ser igual ao entryPrice
          const entryDate = new Date(comp.entryDate);
          entryDate.setHours(0, 0, 0, 0);
          const yesterdayDate = new Date(yesterday);
          yesterdayDate.setHours(0, 0, 0, 0);
          
          if (entryDate.getTime() === yesterdayDate.getTime()) {
            const priceDiff = Math.abs(yahooPrice - comp.entryPrice) / comp.entryPrice;
            if (priceDiff > 0.01) { // Diferença maior que 1%
              console.warn(`⚠️ [INDEX ENGINE] Price mismatch for ${comp.assetTicker}: entryPrice=${comp.entryPrice.toFixed(2)}, yesterdayPrice=${yahooPrice.toFixed(2)}, diff=${(priceDiff * 100).toFixed(2)}%`);
              // Usar entryPrice como correção se a diferença for muito grande
              if (priceDiff > 0.05) { // Diferença maior que 5%
                console.warn(`🔧 [INDEX ENGINE] CORRECTING: Using entryPrice (${comp.entryPrice.toFixed(2)}) instead of yesterday price (${yahooPrice.toFixed(2)}) for ${comp.assetTicker}`);
                pricesYesterday.set(comp.assetTicker, comp.entryPrice);
                continue;
              }
            }
          }
          
          pricesYesterday.set(comp.assetTicker, yahooPrice);
          console.log(`✅ [INDEX ENGINE] Using Yahoo Finance price for ${comp.assetTicker} on ${yesterday.toISOString().split('T')[0]}: ${yahooPrice.toFixed(2)}`);
          continue; // Próximo ativo
        } else {
          console.warn(`⚠️ [INDEX ENGINE] Yahoo Finance failed for ${comp.assetTicker} on ${yesterday.toISOString().split('T')[0]}, trying fallback...`);
        }
      } else {
        // Processamento em tempo real: tentar Yahoo Finance primeiro
        const yahooPrice = await getYahooHistoricalPrice(comp.assetTicker, yesterday);
        if (yahooPrice && yahooPrice > 0) {
          pricesYesterday.set(comp.assetTicker, yahooPrice);
          console.log(`✅ [INDEX ENGINE] Using Yahoo Finance price for ${comp.assetTicker}: ${yahooPrice.toFixed(2)}`);
          continue; // Próximo ativo
        }
      }

      // Fallback: buscar do banco de dados apenas se Yahoo Finance falhou
      const company = await prisma.company.findUnique({
        where: { ticker: comp.assetTicker },
        select: { id: true }
      });

      if (!company) continue;

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
        console.log(`📊 [INDEX ENGINE] Using database price for ${comp.assetTicker} on ${yesterday.toISOString().split('T')[0]}: ${Number(yesterdayQuote.price).toFixed(2)}`);
      } else {
        // Se não encontrou quote, tentar buscar último preço histórico disponível
        const historicalPrice = await prisma.historicalPrice.findFirst({
          where: {
            companyId: company.id,
            date: {
              lte: yesterday
            }
          },
          orderBy: { date: 'desc' },
          take: 1
        });

        if (historicalPrice) {
          const historicalPriceValue = Number(historicalPrice.close);
          pricesYesterday.set(comp.assetTicker, historicalPriceValue);
          console.log(`📊 [INDEX ENGINE] Using historical price from DB for ${comp.assetTicker} on ${yesterday.toISOString().split('T')[0]}: ${historicalPriceValue.toFixed(2)}`);
        } else {
          // Se não encontrou histórico, verificar se o ativo entrou hoje
          const entryDate = new Date(comp.entryDate);
          entryDate.setHours(0, 0, 0, 0);
          const todayDate = new Date(date);
          todayDate.setHours(0, 0, 0, 0);
          
          // Se o ativo entrou hoje (rebalanceamento), usar preço atual como base (sem variação no primeiro dia)
          if (entryDate.getTime() === todayDate.getTime()) {
            // Ativo novo: usar preço atual como base (retorno zero no primeiro dia)
            const priceToday = pricesToday.get(comp.assetTicker)?.price;
            if (priceToday) {
              pricesYesterday.set(comp.assetTicker, priceToday);
              console.log(`📊 [INDEX ENGINE] New asset ${comp.assetTicker} entered today, using today's price as yesterday: ${priceToday.toFixed(2)}`);
            } else {
              // Último recurso: usar entryPrice apenas se for ativo novo e não tiver preço atual
              pricesYesterday.set(comp.assetTicker, comp.entryPrice);
              console.warn(`⚠️ [INDEX ENGINE] New asset ${comp.assetTicker} has no current price, using entryPrice: ${comp.entryPrice.toFixed(2)}`);
            }
          } else {
            // Ativo antigo sem quote e sem histórico: usar preço atual como último recurso
            const priceToday = pricesToday.get(comp.assetTicker)?.price;
            if (priceToday) {
              pricesYesterday.set(comp.assetTicker, priceToday);
              console.warn(`⚠️ [INDEX ENGINE] No historical price found for ${comp.assetTicker}, using today's price as yesterday (retorno zero): ${priceToday.toFixed(2)}`);
            } else {
              console.error(`❌ [INDEX ENGINE] No price data available for ${comp.assetTicker} (entryDate: ${entryDate.toISOString().split('T')[0]}, today: ${todayDate.toISOString().split('T')[0]})`);
            }
          }
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

    console.log(`📊 [INDEX ENGINE] Calculating daily return for ${date.toISOString().split('T')[0]} (${isRetroactiveProcessing ? 'RETROACTIVE' : 'REAL-TIME'})`);
    console.log(`📊 [INDEX ENGINE] Previous points: ${previousPoints.toFixed(4)}`);

    for (const comp of composition) {
      let priceToday = pricesToday.get(comp.assetTicker)?.price;
      let priceYesterday = pricesYesterday.get(comp.assetTicker);
      const priceTodaySource = pricesToday.get(comp.assetTicker)?.source || 'unknown';

      if (!priceToday || !priceYesterday || priceYesterday === 0) {
        console.warn(`⚠️ [INDEX ENGINE] Missing price data for ${comp.assetTicker}, skipping`);
        continue;
      }

      // Log detalhado dos preços usados
      console.log(`📊 [INDEX ENGINE] ${comp.assetTicker}: PriceToday=${priceToday.toFixed(2)} (${priceTodaySource}), PriceYesterday=${priceYesterday.toFixed(2)}, EntryPrice=${comp.entryPrice.toFixed(2)}, EntryDate=${comp.entryDate.toISOString().split('T')[0]}`);

      // Validação crítica: detectar retornos absurdos que indicam problema de dados
      const rawReturn = (priceToday / priceYesterday) - 1;
      if (Math.abs(rawReturn) > 0.5) { // Retorno maior que 50% em um dia
        const entryDate = new Date(comp.entryDate);
        entryDate.setHours(0, 0, 0, 0);
        const daysSinceEntry = Math.floor((date.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        console.error(`🚨 [INDEX ENGINE] SUSPICIOUS RETURN DETECTED for ${comp.assetTicker} on ${date.toISOString().split('T')[0]}:`);
        console.error(`   Price Today: ${priceToday.toFixed(2)}, Price Yesterday: ${priceYesterday.toFixed(2)}`);
        console.error(`   Raw Return: ${(rawReturn * 100).toFixed(2)}%`);
        console.error(`   Entry Price: ${comp.entryPrice.toFixed(2)}, Entry Date: ${comp.entryDate.toISOString().split('T')[0]} (${daysSinceEntry} days ago)`);
        
        // Se o ativo entrou recentemente (menos de 7 dias) e o preço de ontem está muito diferente do entryPrice,
        // corrigir usando entryPrice como priceYesterday
        const priceYesterdayDiff = Math.abs(priceYesterday - comp.entryPrice) / comp.entryPrice;
        if (daysSinceEntry <= 7 && priceYesterdayDiff > 0.3) {
          console.warn(`🔧 [INDEX ENGINE] CORRECTING: Using entryPrice (${comp.entryPrice.toFixed(2)}) instead of suspicious priceYesterday (${priceYesterday.toFixed(2)})`);
          priceYesterday = comp.entryPrice; // Usar variável local corrigida
          pricesYesterday.set(comp.assetTicker, comp.entryPrice); // Atualizar Map também
          const correctedReturn = (priceToday / comp.entryPrice) - 1;
          console.log(`   Corrected Return: ${(correctedReturn * 100).toFixed(2)}%`);
        }
      }

      // Verificar se há dividendo no ex-date
      const dividend = dividendsMap.get(comp.assetTicker) || 0;

      // Log detalhado quando há dividendo
      if (dividend > 0) {
        console.log(`💰 [INDEX ENGINE] ${comp.assetTicker}: Dividendo detectado!`);
        console.log(`   Dividendo por ação: R$ ${dividend.toFixed(4)}`);
        console.log(`   PriceToday (ex-dividendo): R$ ${priceToday.toFixed(4)}`);
        console.log(`   PriceYesterday: R$ ${priceYesterday.toFixed(4)}`);
      }

      // Ajustar preço teórico: preço_ajustado = preço_atual + dividendo
      // Isso evita penalizar quando o preço cai no ex-date
      const adjustedPriceToday = priceToday + dividend;

      // Calcular variação percentual incluindo dividendo: r_{i,t} = (PreçoAjustadoHoje / PreçoOntem) - 1
      const dailyReturn = (adjustedPriceToday / priceYesterday) - 1;

      // Peso do ativo (targetWeight)
      const weight = comp.targetWeight;

      // Contribuição ponderada: w_{i,t-1} × r_{i,t}
      const weightedContribution = weight * dailyReturn;
      totalReturn += weightedContribution;
      
      // Log detalhado do retorno calculado
      if (dividend > 0) {
        console.log(`📊 [INDEX ENGINE] ${comp.assetTicker}: AdjustedPrice=${adjustedPriceToday.toFixed(4)}, Return=${(dailyReturn * 100).toFixed(4)}%, Weight=${(weight * 100).toFixed(2)}%, Contribution=${(weightedContribution * 100).toFixed(4)}%`);
      } else {
        console.log(`📊 [INDEX ENGINE] ${comp.assetTicker}: Return=${(dailyReturn * 100).toFixed(4)}%, Weight=${(weight * 100).toFixed(2)}%, Contribution=${(weightedContribution * 100).toFixed(4)}%`);
      }

      // Acumular dividendos recebidos (em pontos do índice)
      // IMPORTANTE: Calcular o impacto REAL do dividendo no retorno, não o teórico
      // O impacto real é a diferença entre o retorno COM dividendo e o retorno SEM dividendo
      if (dividend > 0) {
        // Calcular retorno SEM dividendo (apenas variação de preço)
        const returnWithoutDividend = (priceToday / priceYesterday) - 1;
        
        // Calcular retorno COM dividendo (já calculado acima como dailyReturn)
        const returnWithDividend = dailyReturn;
        
        // Impacto do dividendo no retorno = diferença entre os dois retornos
        const dividendImpactOnReturn = returnWithDividend - returnWithoutDividend;
        
        // Contribuição ponderada do dividendo no retorno total
        const dividendContribution = weight * dividendImpactOnReturn;
        
        // Impacto do dividendo nos pontos = pontos anteriores × contribuição do dividendo
        const dividendInPoints = previousPoints * dividendContribution;
        
        totalDividendsReceived += dividendInPoints;
        dividendsByTicker.set(comp.assetTicker, dividend);
        console.log(`💰 [INDEX ENGINE] ${comp.assetTicker}: Dividendo impacto:`);
        console.log(`   Retorno sem dividendo: ${(returnWithoutDividend * 100).toFixed(4)}%`);
        console.log(`   Retorno com dividendo: ${(returnWithDividend * 100).toFixed(4)}%`);
        console.log(`   Impacto do dividendo: ${(dividendImpactOnReturn * 100).toFixed(4)}%`);
        console.log(`   Contribuição ponderada: ${(dividendContribution * 100).toFixed(4)}%`);
        console.log(`   Dividendo em pontos: ${dividendInPoints.toFixed(6)} pts`);
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
    
    // Log detalhado do cálculo final
    console.log(`📊 [INDEX ENGINE] Total return: ${(totalReturn * 100).toFixed(4)}%`);
    console.log(`📊 [INDEX ENGINE] Points calculation: ${previousPoints.toFixed(4)} × (1 + ${(totalReturn * 100).toFixed(4)}%) = ${points.toFixed(4)}`);
    console.log(`📊 [INDEX ENGINE] Points change: ${(points - previousPoints).toFixed(4)} (${((points - previousPoints) / previousPoints * 100).toFixed(4)}%)`);
    if (totalDividendsReceived > 0) {
      console.log(`💰 [INDEX ENGINE] Total dividends received: ${totalDividendsReceived.toFixed(6)} pts`);
      console.log(`💰 [INDEX ENGINE] Dividends impact on return: ${((totalDividendsReceived / previousPoints) * 100).toFixed(4)}%`);
      // NOTA: O dividendo JÁ está incluído nos pontos através do cálculo do retorno (adjustedPriceToday)
      // Os pontos calculados (${points.toFixed(6)}) já incluem o impacto do dividendo
      // O campo dividendsReceived é apenas informativo/contábil, não deve ser somado novamente
      console.log(`💰 [INDEX ENGINE] ✅ Points already include dividends through totalReturn calculation`);
      console.log(`💰 [INDEX ENGINE] ✅ Dividends are included in the ${(totalReturn * 100).toFixed(4)}% return`);
    }
    
    // Validação adicional: Calcular retorno esperado baseado nos retornos individuais desde entrada
    let expectedReturnFromEntries = 0;
    let totalWeightForValidation = 0;
    for (const comp of composition) {
      const priceToday = pricesToday.get(comp.assetTicker)?.price;
      if (priceToday && comp.entryPrice > 0) {
        const entryReturn = ((priceToday - comp.entryPrice) / comp.entryPrice);
        expectedReturnFromEntries += comp.targetWeight * entryReturn;
        totalWeightForValidation += comp.targetWeight;
      }
    }
    const normalizedExpectedReturn = totalWeightForValidation > 0 ? expectedReturnFromEntries / totalWeightForValidation : 0;
    const expectedPointsFromEntries = 100.0 * (1 + normalizedExpectedReturn);
    const actualReturnFromStart = ((points - 100.0) / 100.0) * 100;
    const expectedReturnFromStart = ((expectedPointsFromEntries - 100.0) / 100.0) * 100;
    const discrepancy = Math.abs(actualReturnFromStart - expectedReturnFromStart);
    
    if (discrepancy > 0.5) { // Discrepância maior que 0.5%
      console.warn(`⚠️ [INDEX ENGINE] VALIDATION WARNING: Discrepancy detected!`);
      console.warn(`   Actual return from start: ${actualReturnFromStart.toFixed(4)}%`);
      console.warn(`   Expected return from entries: ${expectedReturnFromStart.toFixed(4)}%`);
      console.warn(`   Discrepancy: ${discrepancy.toFixed(4)}%`);
      console.warn(`   Actual points: ${points.toFixed(4)}, Expected from entries: ${expectedPointsFromEntries.toFixed(4)}`);
    } else {
      console.log(`✅ [INDEX ENGINE] Validation OK: Actual=${actualReturnFromStart.toFixed(4)}%, Expected=${expectedReturnFromStart.toFixed(4)}%, Diff=${discrepancy.toFixed(4)}%`);
    }

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
  date: Date,
  forceUpdate: boolean = false
): Promise<boolean> {
  try {
    // Verificar se houve pregão antes de calcular pontos
    const marketWasOpen = await checkMarketWasOpen(date);
    if (!marketWasOpen) {
      // Formatar data usando timezone de Brasília para consistência
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      });
      const parts = formatter.formatToParts(date);
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
      const weekday = parts.find(p => p.type === 'weekday')?.value || '';
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayMap: Record<string, string> = {
        Mon: 'segunda-feira',
        Tue: 'terça-feira',
        Wed: 'quarta-feira',
        Thu: 'quinta-feira',
        Fri: 'sexta-feira',
        Sat: 'sábado',
        Sun: 'domingo',
      };
      const dayName = dayMap[weekday] || 'dia útil sem pregão';
      console.log(`⏸️ [INDEX ENGINE] Pulando cálculo de pontos para ${dateStr} (${dayName}) - mercado não funcionou neste dia`);
      return false;
    }
    
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
    
    // Se o ponto já existe e não estamos forçando atualização, verificar se precisa atualizar
    // (por exemplo, se o dailyChange não bate com os pontos)
    if (existing && !forceUpdate) {
      // Verificar se há inconsistência entre pontos e dailyChange
      const expectedPoints = existing.points * (1 + (existing.dailyChange / 100));
      const calculatedPoints = dailyReturn.points;
      const pointsDiff = Math.abs(expectedPoints - calculatedPoints);
      
      // Se a diferença for muito pequena (< 0.01 pontos), assumir que está correto e não atualizar
      // Isso evita recalcular pontos que já foram calculados corretamente
      if (pointsDiff < 0.01) {
        console.log(`ℹ️ [INDEX ENGINE] Point for ${date.toISOString().split('T')[0]} already exists and is consistent, skipping update`);
        return true;
      }
      
      // Se há inconsistência significativa, atualizar
      console.log(`⚠️ [INDEX ENGINE] Point for ${date.toISOString().split('T')[0]} exists but has inconsistency (diff: ${pointsDiff.toFixed(4)}), updating`);
    }

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

    // Validar consistência: points deve ser igual a previousPoints * (1 + dailyReturn)
    // Se não bater, recalcular points usando previousPoints
    let finalPoints = dailyReturn.points;
    
    // Buscar ponto anterior para validar consistência
    const previousPoint = await prisma.indexHistoryPoints.findFirst({
      where: {
        indexId,
        date: {
          lt: date
        }
      },
      orderBy: { date: 'desc' }
    });
    
    if (previousPoint) {
      const expectedPoints = previousPoint.points * (1 + dailyReturn.dailyReturn);
      const pointsDiff = Math.abs(finalPoints - expectedPoints);
      
      // Se a diferença for significativa (> 0.01), usar o valor esperado baseado no dailyReturn
      if (pointsDiff > 0.01) {
        console.warn(`⚠️ [INDEX ENGINE] Points inconsistency detected for ${date.toISOString().split('T')[0]}: calculated=${finalPoints.toFixed(4)}, expected=${expectedPoints.toFixed(4)} (from ${previousPoint.points.toFixed(4)} * (1 + ${(dailyReturn.dailyReturn * 100).toFixed(4)}%)), diff=${pointsDiff.toFixed(4)}. Using expected value.`);
        finalPoints = expectedPoints;
      }
    }

    const updateData: any = {
      points: finalPoints,
      dailyChange: dailyReturn.dailyReturn * 100, // Converter para porcentagem
      currentYield: dailyReturn.currentYield
    };

    // Incluir dividendos recebidos (Total Return com reinvestimento automático)
    if (dailyReturn.dividendsReceived > 0) {
      updateData.dividendsReceived = dailyReturn.dividendsReceived;
    }

    if (dividendsByTickerJson) {
      updateData.dividendsByTicker = dividendsByTickerJson;
    }

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

      // Verificar se este é o primeiro ponto histórico e se não começa em 100
      // Se não começar em 100, criar um ponto virtual no dia anterior com 100 pontos
      const allPoints = await prisma.indexHistoryPoints.findMany({
        where: { indexId },
        orderBy: { date: 'asc' }
      });

      // Se há apenas um ponto (o que acabamos de criar) e não é 100, criar ponto virtual
      if (allPoints.length === 1 && Math.abs(dailyReturn.points - 100.0) > 0.01) {
        const previousDate = new Date(date);
        previousDate.setDate(previousDate.getDate() - 1);
        previousDate.setHours(0, 0, 0, 0);

        // Verificar se já existe ponto no dia anterior (não deveria, mas verificar por segurança)
        const previousPointExists = await prisma.indexHistoryPoints.findUnique({
          where: {
            indexId_date: {
              indexId,
              date: previousDate
            }
          }
        });

        if (!previousPointExists) {
          // Criar ponto virtual no dia anterior com 100 pontos
          await prisma.indexHistoryPoints.create({
            data: {
              indexId,
              date: previousDate,
              points: 100.0,
              dailyChange: 0.0,
              currentYield: dailyReturn.currentYield // Usar o mesmo yield do primeiro dia real
            }
          });

          console.log(`📊 [INDEX ENGINE] Created virtual starting point at ${previousDate.toISOString().split('T')[0]} with 100 points for index ${indexId}`);
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error updating index points for ${indexId}:`, error);
    return false;
  }
}

/**
 * Corrige índices que começaram com valor diferente de 100
 * Cria um ponto virtual no dia anterior ao primeiro ponto com 100 pontos
 */
export async function fixIndexStartingPoint(indexId: string): Promise<boolean> {
  try {
    // Buscar todos os pontos históricos ordenados por data
    const allPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId },
      orderBy: { date: 'asc' }
    });

    if (allPoints.length === 0) {
      console.log(`⚠️ [INDEX ENGINE] No points found for index ${indexId}`);
      return false; // Sem pontos históricos
    }

    const firstPoint = allPoints[0];
    console.log(`🔍 [INDEX ENGINE] Checking starting point for index ${indexId}: First point is ${firstPoint.points} on ${firstPoint.date.toISOString().split('T')[0]}`);

    // Se o primeiro ponto já é 100 (com margem de erro), não precisa corrigir
    if (Math.abs(firstPoint.points - 100.0) <= 0.01) {
      console.log(`✅ [INDEX ENGINE] Starting point already correct (${firstPoint.points})`);
      return false; // Já está correto
    }

    // Verificar se já existe ponto no dia anterior
    const previousDate = new Date(firstPoint.date);
    previousDate.setDate(previousDate.getDate() - 1);
    previousDate.setHours(0, 0, 0, 0);

    const previousPointExists = await prisma.indexHistoryPoints.findUnique({
      where: {
        indexId_date: {
          indexId,
          date: previousDate
        }
      }
    });

    if (previousPointExists) {
      console.log(`⚠️ [INDEX ENGINE] Point already exists for previous date ${previousDate.toISOString().split('T')[0]}`);
      return false; // Já existe ponto anterior
    }

    // Criar ponto virtual no dia anterior com 100 pontos
    await prisma.indexHistoryPoints.create({
      data: {
        indexId,
        date: previousDate,
        points: 100.0,
        dailyChange: 0.0,
        currentYield: firstPoint.currentYield // Usar o mesmo yield do primeiro dia real
      }
    });

    console.log(`✅ [INDEX ENGINE] Fixed starting point for index ${indexId}: Created virtual point at ${previousDate.toISOString().split('T')[0]} with 100 points`);

    return true;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error fixing starting point for index ${indexId}:`, error);
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
          currentYield: dailyReturn.currentYield,
          // Sempre atualizar campos de dividendos (mesmo que sejam null/vazios)
          dividendsReceived: dailyReturn.dividendsReceived > 0 ? dailyReturn.dividendsReceived : null,
          dividendsByTicker: dailyReturn.dividendsByTicker.size > 0 
            ? Object.fromEntries(dailyReturn.dividendsByTicker) 
            : null
        };

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
        dailyChange: true,
        dividendsByTicker: true // Incluir dividendos para cálculo correto
      }
    });

    // Filtrar pontos onde o ticker estava presente
    // IMPORTANTE: Excluir pontos sem snapshot válido (dia 01/12 não tem snapshot)
    const relevantPoints = historyPoints.filter(point => {
      if (!point.compositionSnapshot) return false;
      const snapshot = point.compositionSnapshot as any;
      // Verificar se há snapshot válido (não vazio) e se o ticker está presente
      return Object.keys(snapshot).length > 0 && snapshot[ticker] !== undefined;
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

    // CORREÇÃO: Sempre usar entryPrice do primeiro snapshot onde o ativo aparece
    // Este é o preço de entrada real do ativo no índice
    const finalEntryPrice = entryData.entryPrice;
    const finalEntryDate = new Date(entryData.entryDate);

    // Calcular dias no índice
    const daysInIndex = Math.ceil(
      (new Date(lastPoint.date).getTime() - new Date(firstPoint.date).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Calcular rentabilidade total usando finalEntryPrice
    // CORREÇÃO: Para ativos ativos, buscar preço atual
    let currentPriceForReturn: number | null = null;
    if (isActive && finalEntryPrice) {
      try {
        const { getTickerPrice } = await import('@/lib/quote-service');
        const priceData = await getTickerPrice(ticker);
        currentPriceForReturn = priceData?.price || null;
      } catch (error) {
        console.warn(`⚠️ [INDEX ENGINE] Could not fetch current price for ${ticker}:`, error);
        // Fallback: usar preço do último snapshot
        currentPriceForReturn = exitData?.price || null;
      }
    }

    const totalReturn = isActive && currentPriceForReturn && finalEntryPrice
      ? ((currentPriceForReturn - finalEntryPrice) / finalEntryPrice) * 100
      : exitPrice && finalEntryPrice
      ? ((exitPrice - finalEntryPrice) / finalEntryPrice) * 100
      : null;

    // NOVA ABORDAGEM: Dividir o retorno total do índice proporcionalmente
    // por peso médio do ativo e dias que o ativo esteve na carteira
    // 
    // Buscar o último ponto histórico para obter o retorno total do índice
    const lastHistoryPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' },
      select: {
        points: true,
        date: true
      }
    });

    if (!lastHistoryPoint) {
      return null; // Não há histórico do índice
    }

    // Calcular retorno total do índice desde o início (base 100)
    const initialPoints = 100.0;
    const totalIndexReturn = ((lastHistoryPoint.points - initialPoints) / initialPoints) * 100;

    // Calcular peso médio e dias no índice para este ativo
    let totalWeight = 0;
    let pointCount = 0;

    for (const point of relevantPoints) {
      const snapshot = point.compositionSnapshot as any;
      const assetData = snapshot[ticker];
      
      if (assetData) {
        totalWeight += assetData.weight;
        pointCount++;
      }
    }

    const averageWeight = pointCount > 0 ? totalWeight / pointCount : 0;

    // Buscar TODOS os pontos históricos para calcular fatores de proporção de todos os ativos
    const allHistoryPoints = await prisma.indexHistoryPoints.findMany({
      where: { indexId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        compositionSnapshot: true
      }
    });

    // Coletar todos os tickers únicos e calcular fatores de proporção
    const tickerData = new Map<string, { totalWeight: number; pointCount: number; firstDate: Date; lastDate: Date }>();
    
    for (const point of allHistoryPoints) {
      if (!point.compositionSnapshot) continue;
      const snapshot = point.compositionSnapshot as any;
      if (Object.keys(snapshot).length === 0) continue;
      
      for (const [assetTicker, assetData] of Object.entries(snapshot)) {
        const data = assetData as any;
        if (!tickerData.has(assetTicker)) {
          tickerData.set(assetTicker, {
            totalWeight: 0,
            pointCount: 0,
            firstDate: new Date(point.date),
            lastDate: new Date(point.date)
          });
        }
        
        const tickerInfo = tickerData.get(assetTicker)!;
        tickerInfo.totalWeight += data.weight || 0;
        tickerInfo.pointCount++;
        
        const pointDate = new Date(point.date);
        if (pointDate < tickerInfo.firstDate) {
          tickerInfo.firstDate = pointDate;
        }
        if (pointDate > tickerInfo.lastDate) {
          tickerInfo.lastDate = pointDate;
        }
      }
    }

    // Calcular fator de proporção para cada ativo: peso_médio × dias_no_índice × rentabilidade
    // Quanto maior a rentabilidade, maior a contribuição proporcional
    let totalProportionalFactor = 0;
    const assetFactors = new Map<string, number>();
    const assetReturns = new Map<string, number>();

    // Primeiro, calcular rentabilidade de cada ativo
    for (const [assetTicker, tickerInfo] of tickerData.entries()) {
      // Buscar primeiro e último snapshot do ativo para calcular rentabilidade
      let firstSnapshot: any = null;
      let lastSnapshot: any = null;
      
      for (const point of allHistoryPoints) {
        if (!point.compositionSnapshot) continue;
        const snapshot = point.compositionSnapshot as any;
        if (Object.keys(snapshot).length === 0) continue;
        
        const assetData = snapshot[assetTicker];
        if (assetData) {
          if (!firstSnapshot) {
            firstSnapshot = assetData;
          }
          lastSnapshot = assetData;
        }
      }

      // Calcular rentabilidade do ativo
      let assetReturn = 0;
      if (firstSnapshot && lastSnapshot) {
        const entryPrice = firstSnapshot.entryPrice || firstSnapshot.price;
        const exitPrice = lastSnapshot.price;
        
        if (entryPrice && entryPrice > 0) {
          // Verificar se o ativo ainda está ativo
          const currentComposition = await prisma.indexComposition.findFirst({
            where: {
              indexId,
              assetTicker
            }
          });

          if (currentComposition) {
            // Ativo ainda está ativo: buscar preço atual
            try {
              const { getTickerPrice } = await import('@/lib/quote-service');
              const priceData = await getTickerPrice(assetTicker);
              const currentPrice = priceData?.price || exitPrice;
              assetReturn = ((currentPrice - entryPrice) / entryPrice) * 100;
            } catch (error) {
              assetReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
            }
          } else {
            // Ativo foi removido: usar preço de saída
            assetReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
          }
        }
      }
      
      assetReturns.set(assetTicker, assetReturn);
    }

    // Calcular fatores de proporção incluindo rentabilidade
    // IMPORTANTE: Preservar o sinal da rentabilidade e usar valor absoluto como peso
    // Quanto maior a rentabilidade (em valor absoluto), maior o peso
    // 
    // Estratégia de redistribuição:
    // 1. Calcular contribuições iniciais proporcionalmente
    // 2. Se retorno total > 0: redistribuir contribuições negativas entre positivos
    // 3. Se retorno total < 0: redistribuir contribuições positivas entre negativos
    // 4. A redistribuição favorece ativos com maior rentabilidade (positiva ou menos negativa)
    
    let totalAbsFactor = 0; // Soma dos valores absolutos dos fatores (para normalização)
    const assetFactorMap = new Map<string, number>();
    const assetAvgWeights = new Map<string, number>();
    const assetDaysInIndex = new Map<string, number>();

    // Calcular fatores para todos os ativos
    for (const [assetTicker, tickerInfo] of tickerData.entries()) {
      const avgWeight = tickerInfo.pointCount > 0 ? tickerInfo.totalWeight / tickerInfo.pointCount : 0;
      const daysInIndex = Math.ceil(
        (tickerInfo.lastDate.getTime() - tickerInfo.firstDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      
      const assetReturn = assetReturns.get(assetTicker) || 0;
      
      // Fator base = peso_médio × dias × (1 + |rentabilidade|/100)
      // Quanto maior a rentabilidade (em valor absoluto), maior o fator
      const absReturn = Math.abs(assetReturn);
      const returnMultiplier = 1 + absReturn / 100;
      const factorBase = avgWeight * daysInIndex * returnMultiplier;
      
      assetFactorMap.set(assetTicker, factorBase);
      assetAvgWeights.set(assetTicker, avgWeight);
      assetDaysInIndex.set(assetTicker, daysInIndex);
      totalAbsFactor += factorBase;
    }

    // Separar ativos por sinal de rentabilidade
    const positiveAssets: string[] = [];
    const negativeAssets: string[] = [];

    for (const [assetTicker] of assetFactorMap.entries()) {
      const assetReturn = assetReturns.get(assetTicker) || 0;
      if (assetReturn >= 0) {
        positiveAssets.push(assetTicker);
      } else {
        negativeAssets.push(assetTicker);
      }
    }

    // Calcular fatores totais para cada grupo
    let totalPositiveFactor = 0;
    let totalNegativeFactor = 0;
    
    for (const assetTicker of positiveAssets) {
      const factorBase = assetFactorMap.get(assetTicker) || 0;
      totalPositiveFactor += factorBase;
    }
    
    for (const assetTicker of negativeAssets) {
      const factorBase = assetFactorMap.get(assetTicker) || 0;
      totalNegativeFactor += factorBase;
    }

    // Redistribuir contribuições para garantir que a soma bata com o retorno total
    // REGRA:
    // - Se retorno total > 0: calcular contribuições negativas proporcionais, ajustar positivos para que soma(positivos) + soma(negativos) = retorno total
    // - Se retorno total < 0: calcular contribuições positivas proporcionais, ajustar negativos para que soma(positivos) + soma(negativos) = retorno total
    const finalContributions = new Map<string, number>();
    
    if (totalIndexReturn >= 0) {
      // Retorno total positivo (+4.35%):
      // 1. Calcular contribuições negativas proporcionais (ex: -1%)
      // 2. Calcular quanto os positivos devem somar: soma(positivos) = retorno_total - soma(negativos)
      // 3. Redistribuir essa soma ajustada entre ativos positivos, favorecendo maior rentabilidade
      
      // Calcular contribuições negativas proporcionais
      // Primeiro, calcular quanto os negativos devem somar proporcionalmente
      // Depois distribuir entre os negativos, e ajustar os positivos para garantir que a soma total seja exata
      let totalNegativeContributions = 0;
      if (totalNegativeFactor > 0 && totalAbsFactor > 0) {
        // Proporção dos fatores negativos no total
        const negativeProportion = totalNegativeFactor / totalAbsFactor;
        // Estimativa inicial: proporção × retorno total (será negativo)
        const estimatedNegativeTotal = -(negativeProportion * Math.abs(totalIndexReturn));
        
        // Distribuir proporcionalmente entre negativos
        for (const assetTicker of negativeAssets) {
          const factorBase = assetFactorMap.get(assetTicker) || 0;
          const negativeContribution = totalNegativeFactor > 0
            ? (factorBase / totalNegativeFactor) * estimatedNegativeTotal
            : 0;
          finalContributions.set(assetTicker, negativeContribution);
          totalNegativeContributions += negativeContribution;
        }
      }
      
      // Calcular quanto os positivos devem somar no total para garantir que a soma seja exata
      // soma(positivos) = retorno_total - soma(negativos)
      const totalPositiveTarget = totalIndexReturn - totalNegativeContributions;
      
      // Ordenar ativos positivos por rentabilidade (maior primeiro)
      positiveAssets.sort((a, b) => {
        const returnA = assetReturns.get(a) || 0;
        const returnB = assetReturns.get(b) || 0;
        return returnB - returnA; // Maior primeiro
      });
      
      // Calcular fatores de redistribuição para ativos positivos
      // Favorecer maior rentabilidade: usar fator_base × (1 + rentabilidade/100)
      let totalPositiveRedistFactor = 0;
      const positiveRedistFactors = new Map<string, number>();
      
      for (const assetTicker of positiveAssets) {
        const assetReturn = assetReturns.get(assetTicker) || 0;
        const factorBase = assetFactorMap.get(assetTicker) || 0;
        // Fator de redistribuição: favorecer maior rentabilidade positiva
        const redistFactor = factorBase * (1 + assetReturn / 100);
        positiveRedistFactors.set(assetTicker, redistFactor);
        totalPositiveRedistFactor += redistFactor;
      }
      
      // Distribuir o total ajustado entre ativos positivos
      let distributedPositiveTotal = 0;
      for (let i = 0; i < positiveAssets.length; i++) {
        const assetTicker = positiveAssets[i];
        const redistFactor = positiveRedistFactors.get(assetTicker) || 0;
        
        // Para o último ativo, garantir que a soma seja exata
        if (i === positiveAssets.length - 1) {
          const contribution = totalPositiveTarget - distributedPositiveTotal;
          finalContributions.set(assetTicker, contribution);
        } else {
          const contribution = totalPositiveRedistFactor > 0
            ? (redistFactor / totalPositiveRedistFactor) * totalPositiveTarget
            : 0;
          finalContributions.set(assetTicker, contribution);
          distributedPositiveTotal += contribution;
        }
      }
      
    } else {
      // Retorno total negativo (-2.5%):
      // 1. Calcular contribuições positivas proporcionais (ex: +0.5%)
      // 2. Calcular quanto os negativos devem somar: soma(negativos) = retorno_total - soma(positivos)
      // 3. Redistribuir essa soma ajustada entre ativos negativos, favorecendo menor rentabilidade negativa
      
      // Calcular contribuições positivas proporcionais
      let totalPositiveContributions = 0;
      for (const assetTicker of positiveAssets) {
        const factorBase = assetFactorMap.get(assetTicker) || 0;
        const positiveContribution = totalPositiveFactor > 0
          ? (factorBase / totalPositiveFactor) * Math.abs(totalIndexReturn)
          : 0;
        finalContributions.set(assetTicker, positiveContribution);
        totalPositiveContributions += positiveContribution;
      }
      
      // Calcular quanto os negativos devem somar no total
      // soma(negativos) = retorno_total - soma(positivos)
      const totalNegativeTarget = totalIndexReturn - totalPositiveContributions;
      
      // Ordenar ativos negativos por rentabilidade (menor primeiro, ou seja, menos negativo)
      negativeAssets.sort((a, b) => {
        const returnA = assetReturns.get(a) || 0;
        const returnB = assetReturns.get(b) || 0;
        return returnA - returnB; // Menor primeiro (menos negativo)
      });
      
      // Calcular fatores de redistribuição para ativos negativos
      // Favorecer menor rentabilidade negativa (menos negativo): usar fator_base × (1 + |rentabilidade|/100)
      let totalNegativeRedistFactor = 0;
      const negativeRedistFactors = new Map<string, number>();
      
      for (const assetTicker of negativeAssets) {
        const assetReturn = assetReturns.get(assetTicker) || 0;
        const factorBase = assetFactorMap.get(assetTicker) || 0;
        // Fator de redistribuição: favorecer menor rentabilidade negativa (menos negativo)
        // Quanto menos negativo, maior o fator
        const absReturn = Math.abs(assetReturn);
        const redistFactor = factorBase * (1 + absReturn / 100);
        negativeRedistFactors.set(assetTicker, redistFactor);
        totalNegativeRedistFactor += redistFactor;
      }
      
      // Distribuir o total ajustado entre ativos negativos
      let distributedNegativeTotal = 0;
      for (let i = 0; i < negativeAssets.length; i++) {
        const assetTicker = negativeAssets[i];
        const redistFactor = negativeRedistFactors.get(assetTicker) || 0;
        
        // Para o último ativo, garantir que a soma seja exata
        if (i === negativeAssets.length - 1) {
          const contribution = totalNegativeTarget - distributedNegativeTotal;
          finalContributions.set(assetTicker, contribution);
        } else {
          const contribution = totalNegativeRedistFactor > 0
            ? (redistFactor / totalNegativeRedistFactor) * totalNegativeTarget
            : 0;
          finalContributions.set(assetTicker, contribution);
          distributedNegativeTotal += contribution;
        }
      }
    }

    // Obter contribuição final para este ativo
    const proportionalContribution = finalContributions.get(ticker) || 0;

    return {
      ticker,
      entryDate: finalEntryDate,
      exitDate,
      entryPrice: finalEntryPrice,
      exitPrice,
      daysInIndex,
      totalReturn,
      contributionToIndex: proportionalContribution,
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

/**
 * Busca o último snapshot de composição disponível para um índice
 * @param indexId ID do índice
 * @returns Objeto com data e snapshot, ou null se não encontrar
 */
export async function getLastSnapshot(
  indexId: string
): Promise<{ date: Date; snapshot: Record<string, CompositionSnapshot> } | null> {
  try {
    // Buscar todos os pontos históricos ordenados por data descendente
    // e filtrar no código para encontrar o primeiro com snapshot válido
    const historyPoints = await prisma.indexHistoryPoints.findMany({
      where: {
        indexId
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' } // Ordenar também por createdAt para garantir ordem consistente
      ],
      select: {
        id: true,
        date: true,
        compositionSnapshot: true,
        createdAt: true
      }
    });

    // Log para debug
    console.log(`🔍 [GET LAST SNAPSHOT] Found ${historyPoints.length} history points for index ${indexId}`);
    if (historyPoints.length > 0) {
      const first5 = historyPoints.slice(0, 5).map(p => {
        const dateStr = p.date.toISOString().split('T')[0];
        const hasSnapshot = p.compositionSnapshot !== null && p.compositionSnapshot !== undefined;
        let snapshotInfo = 'null';
        if (hasSnapshot) {
          const snapshot = p.compositionSnapshot as any;
          const isEmpty = typeof snapshot === 'object' && Object.keys(snapshot).length === 0;
          snapshotInfo = isEmpty ? 'empty' : `${Object.keys(snapshot).length} assets`;
        }
        return `${dateStr} (snapshot: ${snapshotInfo})`;
      });
      console.log(`🔍 [GET LAST SNAPSHOT] First 5 dates: ${first5.join(', ')}`);
    }

    // Encontrar o primeiro ponto com snapshot válido (não null, não undefined e não vazio)
    const lastPoint = historyPoints.find(point => {
      const hasSnapshot = point.compositionSnapshot !== null && point.compositionSnapshot !== undefined;
      if (hasSnapshot) {
        // Verificar se o snapshot não está vazio
        const snapshot = point.compositionSnapshot as any;
        const isEmpty = typeof snapshot === 'object' && snapshot !== null && Object.keys(snapshot).length === 0;
        if (!isEmpty) {
          // Verificar se tem pelo menos um ticker válido no snapshot
          const tickers = Object.keys(snapshot);
          return tickers.length > 0 && tickers.every(ticker => {
            const assetData = snapshot[ticker];
            return assetData && typeof assetData === 'object' && assetData.weight !== undefined;
          });
        }
      }
      return false;
    });

    if (!lastPoint || !lastPoint.compositionSnapshot) {
      console.log(`⚠️ [GET LAST SNAPSHOT] No valid snapshot found for index ${indexId}`);
      return null;
    }

    const snapshotKeys = Object.keys(lastPoint.compositionSnapshot as any);
    
    // Extrair data diretamente da string ISO (YYYY-MM-DD) sem conversão de timezone
    // O Prisma retorna datas @db.Date como UTC midnight, mas queremos apenas a parte da data
    const isoString = lastPoint.date.toISOString();
    const dateStr = isoString.split('T')[0]; // Extrair YYYY-MM-DD diretamente
    
    console.log(`✅ [GET LAST SNAPSHOT] Found snapshot for date ${dateStr} (ISO: ${isoString}) with ${snapshotKeys.length} assets`);

    // Parsear snapshot e converter entryDate de ISO string para Date
    const snapshot = lastPoint.compositionSnapshot as Record<string, any>;
    const parsedSnapshot: Record<string, CompositionSnapshot> = {};

    for (const [ticker, data] of Object.entries(snapshot)) {
      parsedSnapshot[ticker] = {
        weight: data.weight,
        price: data.price,
        entryPrice: data.entryPrice,
        entryDate: typeof data.entryDate === 'string' 
          ? new Date(data.entryDate) 
          : new Date(data.entryDate)
      };
    }

    // Criar nova data a partir da string YYYY-MM-DD (sem conversão de timezone)
    // Usar UTC para garantir que representa o dia correto independente do timezone
    const [year, month, day] = dateStr.split('-').map(Number);
    const returnDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    return {
      date: returnDate,
      snapshot: parsedSnapshot
    };
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error getting last snapshot for index ${indexId}:`, error);
    return null;
  }
}

/**
 * Verifica se o after market (mark-to-market) já foi executado hoje
 * @param indexId ID do índice
 * @returns true se after market rodou hoje, false caso contrário
 */
export async function checkAfterMarketRanToday(indexId: string): Promise<boolean> {
  try {
    const { getTodayInBrazil } = await import('./market-status');
    const today = getTodayInBrazil();
    today.setHours(0, 0, 0, 0);

    const todayPoint = await prisma.indexHistoryPoints.findFirst({
      where: {
        indexId,
        date: today
      }
    });

    return todayPoint !== null && todayPoint.compositionSnapshot !== null;
  } catch (error) {
    console.error(`❌ [INDEX ENGINE] Error checking if after market ran today for index ${indexId}:`, error);
    return false;
  }
}

