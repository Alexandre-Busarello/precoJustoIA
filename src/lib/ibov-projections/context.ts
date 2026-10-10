/**
 * Funções puras de apoio ao serviço de faixas do Ibovespa: relógio de Brasília, conversão das cotações do Yahoo,
 * contexto de P/L da bolsa e chaves de cache. Sem rede nem banco.
 */

import type { DailyClose } from './engine'
import type { PlBolsaContext } from './types'

const TIME_ZONE = 'America/Sao_Paulo'
/** O pregão da B3 termina às 18h (com o call de fechamento); 18h30 dá margem para o fechamento oficial chegar. */
export const SESSION_CLOSE_MINUTES = 18 * 60 + 30

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
})

/** Data YYYY-MM-DD no fuso de Brasília. */
export function brazilDate(value: Date): string {
  return dateFormat.format(value)
}

export interface BrazilClock {
  /** Data de hoje em Brasília (YYYY-MM-DD). */
  today: string
  /** Se o pregão de hoje já terminou (fim de semana conta como encerrado). */
  sessionClosed: boolean
}

export function brazilClock(now: Date): BrazilClock {
  const parts = clockFormat.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = Number(get('hour')) % 24
  const minutes = hour * 60 + Number(get('minute'))
  const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun'
  return { today: brazilDate(now), sessionClosed: weekend || minutes >= SESSION_CLOSE_MINUTES }
}

export interface YahooQuote {
  date: Date | string | number
  close?: number | null
}

/**
 * Converte as barras diárias do Yahoo em fechamentos. Antes do fim do pregão, a barra de hoje é parcial
 * (preço intradiário) e fica de fora: a faixa sempre parte do último fechamento completo.
 */
export function quotesToCloses(quotes: readonly YahooQuote[], clock: BrazilClock): DailyClose[] {
  const out: DailyClose[] = []
  for (const quote of quotes) {
    const close = Number(quote?.close)
    if (!Number.isFinite(close) || close <= 0) continue
    const date = new Date(quote.date)
    if (Number.isNaN(date.getTime())) continue
    const day = brazilDate(date)
    if (day > clock.today) continue
    if (day === clock.today && !clock.sessionClosed) continue
    out.push({ date: day, close })
  }
  return out
}

/** Fração dos valores menores ou iguais a `current` (0 a 1). */
export function percentileRank(values: readonly number[], current: number): number {
  if (values.length === 0) return Number.NaN
  return values.filter((v) => v <= current).length / values.length
}

/** P/L atual da bolsa contra a própria série mensal. `null` sem ao menos 12 meses válidos. */
export function buildPlBolsaContext(rows: ReadonlyArray<{ date: string; pl: number }>): PlBolsaContext | null {
  const valid = rows
    .filter((r) => Number.isFinite(r.pl) && r.pl > 0)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (valid.length < 12) return null
  const values = valid.map((r) => r.pl)
  const latest = valid[valid.length - 1]
  return {
    current: latest.pl,
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    percentileRank: percentileRank(values, latest.pl),
    asOf: latest.date,
    since: valid[0].date,
    samples: valid.length,
  }
}

/** Uma chave por dia e por fase do pregão: recalcula no primeiro acesso do dia e de novo depois do fechamento. */
export function reportCacheKey(clock: BrazilClock, method: string): string {
  return `ibov-projections:${method}:${clock.today}:${clock.sessionClosed ? 'closed' : 'open'}`
}

/** `validUntil` do registro diário salvo no banco: fim do dia de referência em Brasília. */
export function snapshotValidUntil(today: string): Date {
  return new Date(`${today}T23:59:59-03:00`)
}
