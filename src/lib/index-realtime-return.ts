/**
 * Calcula rentabilidade em tempo real do índice
 * Usa preços atuais vs último fechamento oficial
 */

import { prisma } from '@/lib/prisma';
import { getLatestPrices } from '@/lib/quote-service';

/**
 * Verifica se o mercado B3 está aberto no momento atual (horário de Brasília)
 */
function isBrazilMarketOpen(): boolean {
  const now = new Date();
  
  // Criar formatter para horário de Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });
  
  // Formatar e parsear partes
  const parts = formatter.formatToParts(now);
  
  const hour = parseInt(
    parts.find((p) => p.type === 'hour')?.value || '0',
    10
  );
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  
  // Mapear dia da semana
  const dayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  
  const dayOfWeek = dayMap[weekday] ?? 0;
  
  // Mercado B3: Segunda a Sexta, 10h às 17h (horário de Brasília)
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 10 && hour < 17;
}

export interface RealTimeReturn {
  realTimePoints: number;
  realTimeReturn: number; // Retorno em tempo real desde o último fechamento
  dailyChange: number; // Variação percentual do dia
  lastOfficialPoints: number;
  lastOfficialDate: Date;
  isMarketOpen: boolean;
}

/**
 * Calcula rentabilidade em tempo real do índice
 * Compara preços atuais com último fechamento oficial
 */
export async function calculateRealTimeReturn(
  indexId: string
): Promise<RealTimeReturn | null> {
  try {
    // 1. Buscar último ponto histórico oficial (último fechamento)
    const lastHistoryPoint = await prisma.indexHistoryPoints.findFirst({
      where: { indexId },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        points: true,
        compositionSnapshot: true,
      },
    });

    if (!lastHistoryPoint) {
      return null; // Sem histórico, não pode calcular
    }

    const lastOfficialPoints = lastHistoryPoint.points;
    const lastOfficialDate = lastHistoryPoint.date;

    // 2. Buscar composição atual do índice
    const composition = await prisma.indexComposition.findMany({
      where: { indexId },
      select: {
        assetTicker: true,
        targetWeight: true,
      },
    });

    if (composition.length === 0) {
      return null;
    }

    // 3. Buscar preços atuais de todos os ativos
    const tickers = composition.map((c) => c.assetTicker);
    const currentPrices = await getLatestPrices(tickers);

    // 4. Buscar preços do último fechamento do snapshot ou do banco
    const lastSnapshot = lastHistoryPoint.compositionSnapshot as
      | Record<
          string,
          {
            weight: number;
            price: number;
            entryPrice: number;
            entryDate: Date;
          }
        >
      | null
      | undefined;

    // 5. Buscar empresas uma vez para otimizar queries
    const companies = await prisma.company.findMany({
      where: {
        ticker: {
          in: tickers,
        },
      },
      select: {
        id: true,
        ticker: true,
      },
    });

    const tickerToCompanyIdMap = new Map(
      companies.map((c) => [c.ticker, c.id])
    );

    // 6. Buscar preços do último fechamento em batch (uma query por empresa)
    const lastQuoteMap = new Map<string, number>();
    await Promise.all(
      tickers.map(async (ticker) => {
        const companyId = tickerToCompanyIdMap.get(ticker);
        if (!companyId) return;

        const lastQuote = await prisma.dailyQuote.findFirst({
          where: {
            companyId,
            date: {
              lte: lastOfficialDate,
            },
          },
          orderBy: { date: 'desc' },
          take: 1,
          select: { price: true },
        });

        if (lastQuote) {
          lastQuoteMap.set(ticker, Number(lastQuote.price));
        }
      })
    );

    // 7. Calcular variação ponderada em tempo real
    let totalReturn = 0;
    let totalWeight = 0;

    for (const comp of composition) {
      const currentPriceData = currentPrices.get(comp.assetTicker);
      if (!currentPriceData) {
        continue; // Sem preço atual, pular
      }

      const currentPrice = currentPriceData.price;

      // Tentar pegar preço do último fechamento do snapshot primeiro
      let lastClosePrice: number | null = null;

      if (lastSnapshot && lastSnapshot[comp.assetTicker]) {
        lastClosePrice = lastSnapshot[comp.assetTicker].price;
      } else {
        // Fallback: usar do mapa de quotes do banco
        lastClosePrice = lastQuoteMap.get(comp.assetTicker) || null;
      }

      if (!lastClosePrice || lastClosePrice === 0) {
        continue; // Sem preço de fechamento, pular
      }

      // Calcular variação percentual: r_i = (preço_atual - preço_fechamento) / preço_fechamento
      const assetReturn = (currentPrice - lastClosePrice) / lastClosePrice;

      // Contribuição ponderada: w_i × r_i
      totalReturn += comp.targetWeight * assetReturn;
      totalWeight += comp.targetWeight;
    }

    // Se não conseguiu calcular para nenhum ativo, retornar null
    if (totalWeight === 0) {
      return null;
    }

    // 8. Calcular pontos em tempo real: pontos_realtime = pontos_último_fechamento × (1 + R_t)
    const realTimePoints = lastOfficialPoints * (1 + totalReturn);

    // 9. Calcular retorno acumulado em tempo real desde o último fechamento
    const dailyChange = totalReturn * 100; // Converter para porcentagem

    // 10. Calcular retorno total desde o início (base 100)
    const initialPoints = 100.0;
    const realTimeReturn = ((realTimePoints - initialPoints) / initialPoints) * 100;

    // 11. Verificar se mercado está aberto (horário de Brasília)
    const isMarketOpen = isBrazilMarketOpen();

    return {
      realTimePoints,
      realTimeReturn,
      dailyChange,
      lastOfficialPoints,
      lastOfficialDate,
      isMarketOpen,
    };
  } catch (error) {
    console.error(
      `❌ [REALTIME RETURN] Error calculating real-time return for index ${indexId}:`,
      error
    );
    return null;
  }
}

