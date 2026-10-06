import 'server-only'

import { prisma } from '@/lib/prisma'
import { DividendService } from '@/lib/dividend-service'
import { subtractMonthsUTC } from '@/lib/finance/utils'
import {
  PROJECTION_HISTORY_MONTHS,
  buildAgendaEvents,
  monthlyPortfolioIncome,
  toDateKey,
  todayInBrazil,
  type AgendaData,
  type PositionTrade,
} from './agenda-model'

const POSITION_TYPES = ['BUY', 'BUY_REBALANCE', 'SELL_REBALANCE', 'SELL_WITHDRAWAL'] as const

/** Tickers do radar do usuário (`RadarConfig.tickers` é um JSON de strings). */
async function loadRadarTickers(userId: string): Promise<string[]> {
  const config = await prisma.radarConfig.findUnique({ where: { userId }, select: { tickers: true } })
  const tickers = Array.isArray(config?.tickers) ? config.tickers : []
  return tickers.filter((t): t is string => typeof t === 'string' && t.length > 0).map((t) => t.toUpperCase())
}

/** Compras e vendas confirmadas de todas as carteiras ativas do usuário, por ticker. */
async function loadTrades(userId: string): Promise<Map<string, PositionTrade[]>> {
  const transactions = await prisma.portfolioTransaction.findMany({
    where: {
      portfolio: { userId, isActive: true },
      status: { in: ['CONFIRMED', 'EXECUTED'] },
      type: { in: [...POSITION_TYPES] },
      ticker: { not: null },
    },
    select: { ticker: true, date: true, type: true, quantity: true },
    orderBy: { date: 'asc' },
  })
  const byTicker = new Map<string, PositionTrade[]>()
  for (const tx of transactions) {
    if (!tx.ticker) continue
    const ticker = tx.ticker.toUpperCase()
    const list = byTicker.get(ticker) ?? []
    list.push({ date: tx.date, type: tx.type, quantity: Number(tx.quantity ?? 0) })
    byTicker.set(ticker, list)
  }
  return byTicker
}

/**
 * Agenda de proventos do usuário: ativos do radar e das carteiras ativas, proventos do `DividendHistory` e estimativa
 * estatística dos próximos meses. Nada de IA; só leitura do banco.
 */
export async function loadAgendaData(userId: string, now: Date = new Date()): Promise<AgendaData> {
  const today = todayInBrazil(now)
  const [radarTickers, tradesByTicker] = await Promise.all([loadRadarTickers(userId), loadTrades(userId)])
  const portfolioTickers = [...tradesByTicker.keys()]
  const companies = await DividendService.getDividendHistoryByTickers(
    [...portfolioTickers, ...radarTickers],
    subtractMonthsUTC(today, PROJECTION_HISTORY_MONTHS)
  )

  const events = buildAgendaEvents({ companies, portfolioTickers, radarTickers, tradesByTicker, today })
  return {
    today: toDateKey(today),
    events,
    monthlyIncome: monthlyPortfolioIncome(events, today),
    portfolioTickers,
    radarTickers,
  }
}
