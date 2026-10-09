/**
 * Backtest rápido: um clique em qualquer tela (ativo, ranking, comparador, carteira) simula com padrões fixos e leva
 * direto ao resultado. Helpers puros (sem Prisma nem React): padrões, período, nome automático, normalização de
 * tickers e pesos, avisos de período ajustado e a URL de pouso. Usados pela rota `/api/backtest/quick`, pelo botão e
 * pela página do backtest.
 */

export type QuickBacktestSource = 'asset' | 'ranking' | 'comparador' | 'carteira'
export type QuickRebalanceFrequency = 'monthly' | 'quarterly' | 'yearly'

export const QUICK_SOURCES: readonly QuickBacktestSource[] = ['asset', 'ranking', 'comparador', 'carteira']
export const QUICK_YEARS_OPTIONS = [3, 5, 10] as const
export type QuickYears = (typeof QUICK_YEARS_OPTIONS)[number]

export const QUICK_DEFAULTS = {
  years: 5 as QuickYears,
  initialCapital: 10_000,
  monthlyContribution: 1_000,
  rebalanceFrequency: 'monthly' as QuickRebalanceFrequency,
}

export const QUICK_MAX_ASSETS = 20
/** Opções do "Backtest do ranking". */
export const QUICK_TOP_OPTIONS = [3, 5, 10] as const
export const QUICK_TOP_DEFAULT = 5

const MAX_MONEY = 999_999_999
const MAX_LABEL_LENGTH = 60
const TICKER_PATTERN = /^[A-Z0-9]{4,12}$/
/** targetAllocation é Decimal(5, 4): pesos com 4 casas. */
const WEIGHT_SCALE = 10_000

export interface QuickOverrides {
  years?: QuickYears
  initialCapital?: number
  monthlyContribution?: number
  rebalanceFrequency?: QuickRebalanceFrequency
}

export interface QuickSettings {
  years: QuickYears
  initialCapital: number
  monthlyContribution: number
  rebalanceFrequency: QuickRebalanceFrequency
}

export function isQuickSource(value: unknown): value is QuickBacktestSource {
  return typeof value === 'string' && (QUICK_SOURCES as readonly string[]).includes(value)
}

/** Mês corrente no fuso de Brasília ({ year, month 0–11 }). */
export function currentMonthInSaoPaulo(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1
  return { year, month }
}

/**
 * Período padrão: os últimos `years` anos completos, terminando no 1º dia do mês corrente em Brasília (mesma regra da
 * carteira de exemplo). Datas à meia-noite UTC, como a coluna DATE do banco.
 */
export function quickPeriod(now: Date = new Date(), years: number = QUICK_DEFAULTS.years): { startDate: Date; endDate: Date } {
  const { year, month } = currentMonthInSaoPaulo(now)
  return {
    startDate: new Date(Date.UTC(year - years, month, 1)),
    endDate: new Date(Date.UTC(year, month, 1)),
  }
}

function moneyOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(Math.round(parsed * 100) / 100, MAX_MONEY)
}

/** Padrões com os ajustes aceitos (anos 3/5/10, valores ≥ 0, frequência válida). Valores inválidos voltam ao padrão. */
export function resolveQuickSettings(overrides?: unknown): QuickSettings {
  const input = (overrides && typeof overrides === 'object' ? overrides : {}) as Record<string, unknown>
  const years = (QUICK_YEARS_OPTIONS as readonly unknown[]).includes(input.years) ? (input.years as QuickYears) : QUICK_DEFAULTS.years
  const frequency = input.rebalanceFrequency
  return {
    years,
    initialCapital: moneyOr(input.initialCapital, QUICK_DEFAULTS.initialCapital),
    monthlyContribution: moneyOr(input.monthlyContribution, QUICK_DEFAULTS.monthlyContribution),
    rebalanceFrequency:
      frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly' ? frequency : QUICK_DEFAULTS.rebalanceFrequency,
  }
}

/** true quando a requisição pede algo diferente dos padrões (o backtest grátis só roda com os padrões). */
export function hasCustomSettings(overrides?: unknown): boolean {
  if (!overrides || typeof overrides !== 'object') return false
  const resolved = resolveQuickSettings(overrides)
  return (
    resolved.years !== QUICK_DEFAULTS.years ||
    resolved.initialCapital !== QUICK_DEFAULTS.initialCapital ||
    resolved.monthlyContribution !== QUICK_DEFAULTS.monthlyContribution ||
    resolved.rebalanceFrequency !== QUICK_DEFAULTS.rebalanceFrequency
  )
}

export type TickerNormalization = { ok: true; tickers: string[] } | { ok: false; error: string }

/** Maiúsculas, sem espaços e sem repetição; de 1 a 20 tickers válidos. */
export function normalizeTickers(raw: unknown): TickerNormalization {
  if (!Array.isArray(raw)) return { ok: false, error: 'Informe ao menos um ativo para simular.' }
  const tickers: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const ticker = value.trim().toUpperCase()
    if (!ticker) continue
    if (!TICKER_PATTERN.test(ticker)) return { ok: false, error: `Ticker inválido: ${value.trim()}.` }
    if (!tickers.includes(ticker)) tickers.push(ticker)
  }
  if (tickers.length === 0) return { ok: false, error: 'Informe ao menos um ativo para simular.' }
  if (tickers.length > QUICK_MAX_ASSETS) {
    return { ok: false, error: `O backtest aceita até ${QUICK_MAX_ASSETS} ativos; foram enviados ${tickers.length}.` }
  }
  return { ok: true, tickers }
}

/**
 * Pesos da simulação (fração, soma 1, 4 casas). Sem pesos válidos para todos os tickers: pesos iguais. Peso zero ou
 * negativo tira o ativo da carteira. O resto do arredondamento vai para os maiores pesos, para a soma fechar em 1.
 */
export function normalizeWeights(tickers: string[], weights?: unknown): Array<{ ticker: string; allocation: number }> {
  if (tickers.length === 0) return []
  const raw =
    Array.isArray(weights) && weights.length === tickers.length && weights.every((w) => typeof w === 'number' && Number.isFinite(w))
      ? (weights as number[]).map((w) => Math.max(0, w))
      : null
  const total = raw ? raw.reduce((sum, w) => sum + w, 0) : 0
  const base = raw && total > 0 ? raw.map((w) => w / total) : tickers.map(() => 1 / tickers.length)

  const entries = tickers
    .map((ticker, index) => ({ ticker, share: base[index] }))
    .filter((entry) => entry.share > 0)
    .map((entry) => ({ ticker: entry.ticker, scaled: Math.floor(entry.share * WEIGHT_SCALE + 1e-9) }))
  // Resto do arredondamento: um ponto-base por ativo, dos maiores pesos para os menores
  const remainder = WEIGHT_SCALE - entries.reduce((sum, entry) => sum + entry.scaled, 0)
  const order = entries.map((_, index) => index).sort((a, b) => entries[b].scaled - entries[a].scaled)
  for (let i = 0; i < remainder; i++) entries[order[i % order.length]].scaled += 1
  return entries.map((entry) => ({ ticker: entry.ticker, allocation: entry.scaled / WEIGHT_SCALE }))
}

function joinTickers(tickers: string[]): string {
  if (tickers.length <= 1) return tickers.join('')
  return `${tickers.slice(0, -1).join(', ')} e ${tickers[tickers.length - 1]}`
}

/** Mensagem para quem tenta simular FIIs. */
export function fiiRejectionMessage(fiis: string[]): string {
  const plural = fiis.length > 1
  return `O backtest ainda não simula FIIs (${joinTickers(fiis)}). Remova ${plural ? 'esses ativos' : 'esse ativo'} e tente de novo.`
}

export function cleanSourceLabel(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined
  const trimmed = label.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  return trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…` : trimmed
}

function dayInSaoPaulo(now: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)
}

function yearsLabel(years: number): string {
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

/**
 * Nome automático (estável entre cliques, para o upsert reaproveitar a mesma configuração):
 * "PETR4 · 5 anos", "Top 5 · Fórmula de Graham · 09/10/2026", "Carteira Dividendos · 5 anos".
 */
export function quickConfigName(input: {
  source: QuickBacktestSource
  tickers: string[]
  years: number
  sourceLabel?: string
  now?: Date
}): string {
  const label = cleanSourceLabel(input.sourceLabel)
  const period = yearsLabel(input.years)
  // Uma linha do ranking (1 ativo) usa o mesmo nome do ativo
  if (input.source === 'ranking' && input.tickers.length > 1) {
    return [`Top ${input.tickers.length}`, label, dayInSaoPaulo(input.now ?? new Date())].filter(Boolean).join(' · ')
  }
  if (input.source === 'carteira') {
    const name = label ? (/^carteira\b/i.test(label) ? label : `Carteira ${label}`) : 'Carteira'
    return `${name} · ${period}`
  }
  const subject = input.tickers.length <= 3 ? input.tickers.join(', ') : `${input.tickers.slice(0, 3).join(', ')} e mais ${input.tickers.length - 3}`
  return `${subject} · ${period}`
}

/** Rótulo da origem na faixa do resultado ("Simulação rápida de …"). */
export function quickSourceLabel(source: QuickBacktestSource, tickers: string[], sourceLabel?: string): string {
  const label = cleanSourceLabel(sourceLabel)
  if (source === 'ranking' && tickers.length > 1) return `Top ${tickers.length}${label ? ` · ${label}` : ''}`
  if (source === 'carteira') return label ? (/^carteira\b/i.test(label) ? label : `Carteira ${label}`) : 'sua carteira'
  return label ?? joinTickers(tickers)
}

const monthShortFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Data (meia-noite UTC) → "mar. 2022". */
export function formatMonthYear(date: Date): string {
  const parts = monthShortFormat.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('month')} ${get('year')}`
}

function utcMonthKey(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

/** 1º dia do mês (UTC) da data. */
export function monthStartUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Avisos de período ajustado ao histórico disponível:
 * "Período começou em mar. 2022: VALE3 não tem cotações antes disso".
 */
export function periodAdjustments(input: {
  requestedStart: Date
  requestedEnd: Date
  adjustedStart: Date
  adjustedEnd: Date
  availability: Array<{ ticker: string; availableFrom: Date; availableTo: Date; totalMonths: number }>
}): string[] {
  const notes: string[] = []
  const withData = input.availability.filter((asset) => asset.totalMonths > 0)
  const startKey = utcMonthKey(input.adjustedStart)
  if (startKey > utcMonthKey(input.requestedStart)) {
    const late = withData.filter((asset) => utcMonthKey(asset.availableFrom) === startKey).map((asset) => asset.ticker)
    const verb = late.length > 1 ? 'não têm' : 'não tem'
    notes.push(
      late.length > 0
        ? `Período começou em ${formatMonthYear(input.adjustedStart)}: ${joinTickers(late)} ${verb} cotações antes disso`
        : `Período começou em ${formatMonthYear(input.adjustedStart)}, primeiro mês com cotações de todos os ativos`
    )
  }
  const endKey = utcMonthKey(input.adjustedEnd)
  if (endKey < utcMonthKey(input.requestedEnd) - 1) {
    const early = withData.filter((asset) => utcMonthKey(asset.availableTo) === endKey).map((asset) => asset.ticker)
    const verb = early.length > 1 ? 'não têm' : 'não tem'
    notes.push(
      early.length > 0
        ? `Período terminou em ${formatMonthYear(input.adjustedEnd)}: ${joinTickers(early)} ${verb} cotações depois disso`
        : `Período terminou em ${formatMonthYear(input.adjustedEnd)}, último mês com cotações de todos os ativos`
    )
  }
  return notes
}

/** Aviso para ativos sem nenhuma cotação no período (saem da simulação). */
export function droppedAssetsNote(tickers: string[], reason: 'no-data' | 'fii'): string {
  const plural = tickers.length > 1
  if (reason === 'fii') return `${joinTickers(tickers)} ${plural ? 'ficaram' : 'ficou'} de fora: o backtest ainda não simula FIIs`
  return `${joinTickers(tickers)} ${plural ? 'ficaram' : 'ficou'} de fora: sem cotações no período`
}

/** Só caminhos internos ("/acao/petr4"), nunca outro domínio. */
export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined
  return value.length > 300 ? undefined : value
}

/** URL de pouso depois do clique: resultado (padrão) ou configuração (Personalizar antes). */
export function quickLandingUrl(input: {
  configId: string
  view: 'results' | 'configure'
  source: QuickBacktestSource
  sourceLabel?: string
  returnTo?: string
  adjustments?: string[]
}): string {
  const params = new URLSearchParams({ view: input.view, configId: input.configId })
  if (input.view === 'results') {
    params.set('from', input.source)
    const label = cleanSourceLabel(input.sourceLabel)
    if (label) params.set('label', label)
    const back = safeReturnPath(input.returnTo)
    if (back) params.set('back', back)
    for (const note of input.adjustments ?? []) params.append('ajuste', note)
  }
  return `/backtest?${params.toString()}`
}

/** Texto do botão "Voltar para …" na faixa do resultado. */
export function backLabel(source: QuickBacktestSource, sourceLabel?: string): string {
  if (source === 'asset') return sourceLabel ? `Voltar para ${sourceLabel}` : 'Voltar para o ativo'
  if (source === 'ranking') return 'Voltar para o ranking'
  if (source === 'comparador') return 'Voltar para o comparador'
  return 'Voltar para a carteira'
}

const FREQUENCY_LABEL: Record<QuickRebalanceFrequency, string> = {
  monthly: 'rebalanceamento mensal',
  quarterly: 'rebalanceamento trimestral',
  yearly: 'rebalanceamento anual',
}

export function rebalanceLabel(frequency: string): string {
  return FREQUENCY_LABEL[frequency as QuickRebalanceFrequency] ?? 'rebalanceamento mensal'
}

/** Rótulo de anos para o botão ocupado ("Simulando 5 anos…"). */
export function busyLabel(years: number = QUICK_DEFAULTS.years): string {
  return `Simulando ${yearsLabel(years)}…`
}
