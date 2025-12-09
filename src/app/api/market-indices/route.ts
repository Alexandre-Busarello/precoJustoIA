import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getIndicesList } from '@/lib/index-data';
import { calculateRealTimeReturn } from '@/lib/index-realtime-return';
import { cache } from '@/lib/cache-service';
import { hasIBOVMovementToday } from '@/lib/market-status-server';

/**
 * Verifica se o mercado B3 está fechado (horário de Brasília)
 */
function isBrazilMarketClosed(): boolean {
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
  // Fechado: fim de semana OU antes das 10h OU após 18h
  return dayOfWeek < 1 || dayOfWeek > 5 || hour < 10 || hour >= 18;
}

/**
 * Verifica se o preço de fechamento do dia atual já está disponível
 */
async function hasTodayClosingPrice(indexId: string): Promise<boolean> {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  
  const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  const todayPoint = await prisma.indexHistoryPoints.findFirst({
    where: {
      indexId,
      date: today,
    },
    select: { id: true },
  });
  
  return !!todayPoint;
}


interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePercent: number;
  isCustom?: boolean;
  color?: string;
  url?: string; // URL para linkar o índice
}

/**
 * Busca dados de índices internacionais via Yahoo Finance (principal) e BRAPI (fallback)
 */
async function fetchInternationalIndices(): Promise<MarketIndex[]> {
  const brapiToken = process.env.BRAPI_TOKEN;
  const indices: MarketIndex[] = [];

  // Índices internacionais principais
  const internationalTickers = [
    { symbol: '^BVSP', name: 'IBOVESPA', ticker: 'IBOV' },
    { symbol: '^GSPC', name: 'S&P 500', ticker: 'SPX' },
    { symbol: '^DJI', name: 'Dow Jones', ticker: 'DJI' },
    { symbol: '^IXIC', name: 'NASDAQ', ticker: 'IXIC' },
    { symbol: '^FTSE', name: 'FTSE 100', ticker: 'FTSE' },
  ];

  try {
    // Buscar índices um por um para melhor compatibilidade
    for (const tickerInfo of internationalTickers) {
      try {
        let indexData: MarketIndex | null = null;

        // 1. Tentar Yahoo Finance primeiro (fonte principal) - usando biblioteca yahoo-finance2
        try {
          const { loadYahooFinance } = await import('@/lib/yahoo-finance-loader');
          const yahooFinance = await loadYahooFinance();
          if (!yahooFinance) {
            throw new Error('This code can only run on the server');
          }
          
          // Usar quoteSummary que retorna dados completos incluindo variação
          const quoteSummary = await yahooFinance.quoteSummary(tickerInfo.symbol, {
            modules: ['price']
          });
          
          const price = quoteSummary?.price;
          
          if (price) {
            // Yahoo Finance pode retornar valores como objeto {raw: number, fmt: string} ou número direto
            const getValue = (val: any): number => {
              if (typeof val === 'number') return val;
              if (val?.raw !== undefined) return val.raw;
              if (val?.fmt) {
                // Tentar parsear formato string (ex: "158,939.34")
                const parsed = parseFloat(val.fmt.replace(/,/g, ''));
                return isNaN(parsed) ? 0 : parsed;
              }
              return 0;
            };
            
            const regularMarketPrice = getValue(price.regularMarketPrice);
            const regularMarketChange = getValue(price.regularMarketChange);
            const regularMarketChangePercent = getValue(price.regularMarketChangePercent);
            
            if (regularMarketPrice && regularMarketPrice > 0) {
              const externalUrl = `https://finance.yahoo.com/quote/${tickerInfo.symbol}`;
              
              indexData = {
                name: tickerInfo.name,
                ticker: tickerInfo.ticker,
                value: regularMarketPrice,
                change: regularMarketChange,
                changePercent: regularMarketChangePercent,
                isCustom: false,
                url: externalUrl,
              };
              
              console.log(`📊 [YAHOO] ${tickerInfo.name}: ${regularMarketPrice.toFixed(2)} (${regularMarketChangePercent > 0 ? '+' : ''}${regularMarketChangePercent.toFixed(2)}%)`);
            }
          }
        } catch (yahooError) {
          console.warn(`⚠️ [YAHOO] Erro ao buscar ${tickerInfo.name}, tentando BRAPI...`, yahooError instanceof Error ? yahooError.message : String(yahooError));
        }

        // 2. Fallback para BRAPI se Yahoo Finance falhou
        if (!indexData) {
          const brapiUrl = `https://brapi.dev/api/quote/${tickerInfo.symbol}${brapiToken ? `?token=${brapiToken}` : ''}`;

          const brapiResponse = await fetch(brapiUrl, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
            },
          });

          if (brapiResponse.ok) {
            const brapiData = await brapiResponse.json();
            const result = brapiData.results?.[0];

            if (result) {
              const regularMarketPrice = result.regularMarketPrice || 0;
              const regularMarketChange = result.regularMarketChange || 0;
              const regularMarketChangePercent = result.regularMarketChangePercent || 0;

              const externalUrl = `https://finance.yahoo.com/quote/${tickerInfo.symbol}`;
              
              indexData = {
                name: tickerInfo.name,
                ticker: tickerInfo.ticker,
                value: regularMarketPrice,
                change: regularMarketChange,
                changePercent: regularMarketChangePercent,
                isCustom: false,
                url: externalUrl,
              };
              
              console.log(`📊 [BRAPI] ${tickerInfo.name}: ${regularMarketPrice.toFixed(2)} (${regularMarketChangePercent > 0 ? '+' : ''}${regularMarketChangePercent.toFixed(2)}%)`);
            }
          }
        }

        if (indexData) {
          indices.push(indexData);
        } else {
          console.error(`❌ Não foi possível buscar dados para ${tickerInfo.name} (Yahoo Finance + BRAPI falharam)`);
        }
      } catch (err) {
        console.error(`Erro ao buscar ${tickerInfo.name}:`, err);
        // Continuar para o próximo índice mesmo se um falhar
      }
    }
  } catch (error) {
    console.error('Erro ao buscar índices internacionais:', error);
  }

  return indices;
}

/**
 * Busca dados dos índices próprios do site em tempo real
 */
async function fetchCustomIndices(): Promise<MarketIndex[]> {
  try {
    const indicesList = await getIndicesList();
    const customIndices: MarketIndex[] = [];

    for (const index of indicesList) {
      try {
        // Buscar dados em tempo real do índice
        const realTimeData = await calculateRealTimeReturn(index.id);
        
        if (realTimeData) {
          // Verificar se preço de fechamento do dia atual já está disponível
          const hasClosingPrice = await hasTodayClosingPrice(index.id);
          
          // Se mercado fechado E preço de fechamento disponível, usar preço de fechamento do dia
          // Caso contrário, usar lógica padrão (tempo real se aberto, último fechamento se fechado)
          let currentValue: number;
          let changePercent: number;
          let change: number;
          
          // Se não há pregão hoje (dailyChange = 0 e lastAvailableDailyChange existe), usar última variação disponível
          // Verificar se não há preço de fechamento hoje E se há última variação disponível
          if (!hasClosingPrice && realTimeData.dailyChange === 0 && realTimeData.lastAvailableDailyChange !== undefined && realTimeData.lastAvailableDailyChange !== null) {
            // Não houve pregão hoje - usar última variação disponível do último pregão
            currentValue = realTimeData.lastOfficialPoints;
            changePercent = realTimeData.lastAvailableDailyChange;
            
            // Buscar pontos do dia anterior ao último pregão para calcular change absoluto
            const lastOfficialDate = new Date(realTimeData.lastOfficialDate);
            const dayBefore = new Date(lastOfficialDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            
            const dayBeforePoint = await prisma.indexHistoryPoints.findFirst({
              where: {
                indexId: index.id,
                date: {
                  lte: dayBefore,
                },
              },
              orderBy: { date: 'desc' },
              select: {
                points: true,
              },
            });
            
            const previousPoints = dayBeforePoint?.points || 100.0;
            change = currentValue - previousPoints;
          } else if (!realTimeData.isMarketOpen && hasClosingPrice) {
            // Mercado fechado e preço de fechamento disponível - buscar pontos de fechamento do dia
            const today = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/Sao_Paulo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            
            const parts = formatter.formatToParts(today);
            const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
            const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
            const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
            const todayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
            
            const todayPoint = await prisma.indexHistoryPoints.findFirst({
              where: {
                indexId: index.id,
                date: todayDate,
              },
              select: {
                points: true,
                dailyChange: true,
              },
            });
            
            if (todayPoint) {
              // Mercado fechado e preço de fechamento disponível
              // IMPORTANTE: Usar sempre o dailyChange do histórico, não calcular baseado nos pontos totais
              currentValue = todayPoint.points;
              
              // Usar o dailyChange do histórico (variação do dia)
              // Este valor já está calculado corretamente no banco como variação desde o dia anterior
              changePercent = todayPoint.dailyChange ?? 0;
              
              // Buscar pontos do dia anterior para calcular change absoluto corretamente
              const yesterday = new Date(todayDate);
              yesterday.setDate(yesterday.getDate() - 1);
              
              const yesterdayPoint = await prisma.indexHistoryPoints.findFirst({
                where: {
                  indexId: index.id,
                  date: {
                    lte: yesterday,
                  },
                },
                orderBy: { date: 'desc' },
                select: {
                  points: true,
                },
              });
              
              // Calcular change absoluto baseado no dia anterior
              const previousPoints = yesterdayPoint?.points || 100.0;
              change = currentValue - previousPoints;
              
              // Se dailyChange não está disponível no histórico, calcular manualmente
              if (changePercent === 0 && previousPoints !== 0) {
                changePercent = ((currentValue - previousPoints) / previousPoints) * 100;
              }
            } else {
              // Fallback: usar último fechamento oficial
              currentValue = realTimeData.lastOfficialPoints;
              changePercent = 0;
              change = 0;
            }
          } else {
            // Mercado aberto ou fechado sem preço de fechamento - usar preços em tempo real
            // IMPORTANTE: Mesmo quando mercado fechado, se não tem preço de fechamento ainda,
            // devemos mostrar os preços em aberto do dia (como durante o pregão)
            currentValue = realTimeData.realTimePoints;
            
            // Buscar último ponto do dia anterior para calcular variação correta
            // Isso garante que a variação seja calculada desde o fechamento do dia anterior,
            // não desde um ponto mais antigo que pode estar desatualizado
            const today = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/Sao_Paulo',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            });
            
            const parts = formatter.formatToParts(today);
            const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
            const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
            const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
            const todayDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
            
            // Buscar último ponto antes de hoje (dia anterior)
            const yesterdayPoint = await prisma.indexHistoryPoints.findFirst({
              where: {
                indexId: index.id,
                date: {
                  lt: todayDate,
                },
              },
              orderBy: { date: 'desc' },
              select: {
                points: true,
              },
            });
            
            // Usar o último ponto do dia anterior como referência
            const referencePoints = yesterdayPoint?.points || realTimeData.lastOfficialPoints;
            
            // Calcular variação desde o último fechamento do dia anterior
            change = currentValue - referencePoints;
            changePercent = referencePoints !== 0 
              ? (change / referencePoints) * 100 
              : realTimeData.dailyChange; // Fallback para dailyChange se não conseguir calcular
          }
          
          // URL interna para índices próprios
          const internalUrl = `/indices/${index.ticker.toLowerCase()}`;
          
          customIndices.push({
            name: index.name,
            ticker: index.ticker,
            value: currentValue,
            change,
            changePercent,
            isCustom: true,
            color: index.color,
            url: internalUrl,
          });
        } else {
          // Fallback: usar dados históricos se não conseguir calcular em tempo real
          // IMPORTANTE: Sempre usar o último ponto do dia anterior
          // Usar horário de Brasília para garantir comparação correta
          const now = new Date();
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          
          const parts = formatter.formatToParts(now);
          const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
          const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
          const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
          
          const today = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
          
          const history = await prisma.indexHistoryPoints.findMany({
            where: { 
              indexId: index.id,
              date: {
                lt: today, // Apenas pontos do dia anterior ou anterior
              }
            },
            orderBy: { date: 'desc' },
            take: 2,
            select: {
              points: true,
              date: true,
            },
          });

          if (history.length >= 2) {
            // Usar o mais recente (último do dia anterior) como referência
            const lastDayPoints = history[0].points;
            const previousDayPoints = history[1].points;
            const change = lastDayPoints - previousDayPoints;
            const changePercent = previousDayPoints !== 0 
              ? (change / previousDayPoints) * 100 
              : 0;

            customIndices.push({
              name: index.name,
              ticker: index.ticker,
              value: lastDayPoints, // Último ponto do dia anterior
              change,
              changePercent,
              isCustom: true,
              color: index.color,
              url: `/indices/${index.ticker.toLowerCase()}`,
            });
          } else if (history.length === 1) {
            // Se só tem um ponto histórico, usar ele como referência
            const lastDayPoints = history[0].points;
            const changePercent = index.accumulatedReturn || 0;

            customIndices.push({
              name: index.name,
              ticker: index.ticker,
              value: lastDayPoints,
              change: (lastDayPoints - 100) * (changePercent / 100),
              changePercent,
              isCustom: true,
              color: index.color,
              url: `/indices/${index.ticker.toLowerCase()}`,
            });
          }
        }
      } catch (err) {
        console.error(`Erro ao buscar dados em tempo real do índice ${index.ticker}:`, err);
        // Continuar para o próximo índice mesmo se um falhar
      }
    }

    return customIndices;
  } catch (error) {
    console.error('Erro ao buscar índices próprios:', error);
    return [];
  }
}

/**
 * GET /api/market-indices
 * Retorna lista de índices internacionais e próprios para a tarja
 * Cache de 1 hora no Redis para evitar sobrecarga
 * 
 * IMPORTANTE: Quando mercado fechado, ignora cache até preço de fechamento estar disponível
 */
const CACHE_TTL = 3600; // 1 hora em segundos
const CACHE_KEY = 'market-indices';

export async function GET(request: NextRequest) {
  try {
    const marketClosed = isBrazilMarketClosed();
    let shouldIgnoreCache = false;
    let cacheTTL = CACHE_TTL; // TTL padrão de 1 hora
    
    // Se mercado fechado, verificar se preço de fechamento já está disponível
    if (marketClosed) {
      const indicesList = await getIndicesList();
      
      // Verificar se pelo menos um índice já tem preço de fechamento do dia
      // Se nenhum tiver, ainda estamos esperando processamento do CRON
      const hasAnyClosingPrice = await Promise.all(
        indicesList.slice(0, 3).map(index => hasTodayClosingPrice(index.id))
      );
      
      // Se nenhum índice tem preço de fechamento ainda, ignorar cache
      shouldIgnoreCache = !hasAnyClosingPrice.some(Boolean);
      
      if (shouldIgnoreCache) {
        console.log('📊 [API] Mercado fechado mas preço de fechamento ainda não disponível - ignorando cache');
      } else {
        console.log('📊 [API] Mercado fechado e preço de fechamento disponível - pode usar cache');
        cacheTTL = 86400; // 24h quando fechado e preço disponível
      }
    } else {
      // Mercado aberto: verificar se IBOVESPA já teve primeira movimentação do dia
      const hasIBOVMovement = await hasIBOVMovementToday();
      
      if (hasIBOVMovement) {
        // IBOVESPA já teve movimentação - invalidar cache e usar TTL de 1 hora
        console.log('📊 [API] IBOVESPA já teve movimentação hoje - invalidando cache e usando TTL de 1h');
        shouldIgnoreCache = true; // Forçar recálculo
        cacheTTL = CACHE_TTL; // 1 hora até próximo pregão
      } else {
        // IBOVESPA ainda não teve movimentação - usar cache curto
        console.log('📊 [API] IBOVESPA ainda não teve movimentação hoje - usando cache curto');
        cacheTTL = 600; // Cache curto
      }
    }
    
    // Verificar cache Redis apenas se não devemos ignorar
    if (!shouldIgnoreCache) {
      const cachedData = await cache.get<{
        success: boolean;
        indices: MarketIndex[];
        count: number;
      }>(CACHE_KEY);
      
      if (cachedData) {
        console.log(`📊 Retornando índices do mercado do cache Redis (TTL: ${cacheTTL}s)`);
        return NextResponse.json(
          {
            ...cachedData,
            cached: true,
          }
        );
      }
    }

    console.log('📊 [API] Calculando índices do mercado...');

    // Buscar índices em paralelo
    const [internationalIndices, customIndices] = await Promise.all([
      fetchInternationalIndices(),
      fetchCustomIndices(),
    ]);

    // Combinar índices: internacionais e próprios
    const allIndices: MarketIndex[] = [
      ...internationalIndices,
      ...customIndices,
    ];

    // Ordenar por rentabilidade (changePercent) do maior para o menor
    const sortedIndices = allIndices.sort((a, b) => {
      // Ordenar por changePercent (variação percentual) em ordem decrescente
      return b.changePercent - a.changePercent;
    });

    const responseData = {
      success: true,
      indices: sortedIndices,
      count: sortedIndices.length,
    };

    // Salvar no cache Redis com TTL apropriado
    // TTL já foi calculado acima baseado no estado do mercado e movimentação do IBOVESPA
    await cache.set(CACHE_KEY, responseData, { ttl: cacheTTL });
    console.log(`📊 [API] Cache salvo com TTL de ${cacheTTL}s (${cacheTTL / 60} minutos)`);

    return NextResponse.json(
      {
        ...responseData,
        cached: false,
        timestamp: new Date().toISOString(),
        marketClosed,
        hasClosingPrice: !shouldIgnoreCache,
      },
    );
  } catch (error) {
    console.error('Erro ao buscar índices do mercado:', error);
    
    // Tentar retornar cache mesmo que expirado em caso de erro
    try {
      const cachedData = await cache.get<{
        success: boolean;
        indices: MarketIndex[];
        count: number;
      }>(CACHE_KEY);
      
      if (cachedData) {
        console.log('📊 Retornando cache (mesmo expirado) devido a erro');
        return NextResponse.json({
          ...cachedData,
          cached: true,
          error: 'Erro ao atualizar dados, retornando cache',
        });
      }
    } catch (cacheError) {
      // Ignorar erro ao buscar cache
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao buscar índices',
        indices: [],
      },
      { status: 500 }
    );
  }
}

