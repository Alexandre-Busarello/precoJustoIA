/**
 * Agenda de proventos: funções puras que montam os eventos (confirmados e estimados), a posição da carteira na data ex,
 * a renda mensal projetada e o arquivo .ics. Sem acesso a banco; usadas pela página, pelas APIs e pelos testes.
 *
 * Datas são strings `YYYY-MM-DD` (as colunas `@db.Date` do Prisma são meia-noite UTC), para não mudar de dia no fuso.
 */

import {
  isJcp,
  jcpIrrfRate,
  jcpNet,
  projectSeasonal,
  toDividendEvents,
  type DividendEvent,
  type DividendHistoryRow,
  type SeasonalProjection,
} from '@/lib/finance/dividends'
import { median, normalizeText, roundTo } from '@/lib/finance/utils'

const DAY_MS = 86_400_000

export type AgendaKind = 'confirmed' | 'projected'
export type AgendaSource = 'portfolio' | 'radar'
export type DividendTypeLabel = 'Dividendo' | 'JCP' | 'Rendimento'

export interface AgendaEvent {
  /** Estável entre gerações (usado como UID no .ics). */
  id: string
  ticker: string
  companyName: string | null
  /** Logo da empresa (a UI cai no monograma sem ele). */
  logoUrl?: string | null
  /** `STOCK`, `FII`, `ETF`, `BDR`… para o link da página do ativo. */
  assetType?: string | null
  kind: AgendaKind
  type: DividendTypeLabel
  /** Data ex (`YYYY-MM-DD`): primeiro pregão sem direito ao provento. */
  exDate: string
  paymentDate: string | null
  /** A data de pagamento é estimada pelo intervalo histórico entre data ex e pagamento do ativo. */
  paymentDateEstimated: boolean
  /** Valor bruto por ação. */
  amount: number
  /** Valor líquido por ação (JCP com IRRF descontado). */
  netAmount: number
  sources: AgendaSource[]
  /** Ações em carteira na data ex (`null` quando o ativo não está na carteira). */
  quantity: number | null
  /** Valor bruto estimado para a posição. */
  positionGross: number | null
  /** Valor líquido estimado para a posição. */
  positionNet: number | null
}

export interface MonthlyIncome {
  /** `YYYY-MM`. */
  month: string
  /** Renda líquida de proventos já anunciados, pela data de pagamento. */
  confirmed: number
  /** Renda líquida estimada (estimativa estatística). */
  projected: number
}

export interface AgendaData {
  today: string
  events: AgendaEvent[]
  monthlyIncome: MonthlyIncome[]
  portfolioTickers: string[]
  radarTickers: string[]
}

export type AgendaScope = 'todos' | 'carteira' | 'radar'
export type AgendaPeriod = 'proximos-30' | 'proximos-90' | 'ultimos-90'

export const AGENDA_SCOPES: Array<{ value: AgendaScope; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'carteira', label: 'Carteira' },
  { value: 'radar', label: 'Radar' },
]

export const AGENDA_PERIODS: Array<{ value: AgendaPeriod; label: string }> = [
  { value: 'proximos-30', label: 'Próximos 30 dias' },
  { value: 'proximos-90', label: 'Próximos 90 dias' },
  { value: 'ultimos-90', label: 'Últimos 90 dias' },
]

/** Quanto do passado e do futuro a agenda carrega (a tabela filtra depois). */
export const AGENDA_PAST_DAYS = 90
export const AGENDA_FUTURE_DAYS = 366
/** Meses de histórico necessários para a projeção sazonal (3 janelas de 12 meses + folga). */
export const PROJECTION_HISTORY_MONTHS = 40

export function parseScope(value: string | null | undefined): AgendaScope {
  return value === 'carteira' || value === 'radar' ? value : 'todos'
}

export function parsePeriod(value: string | null | undefined): AgendaPeriod {
  return value === 'proximos-30' || value === 'ultimos-90' ? value : 'proximos-90'
}

// ─── Datas ──────────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` da data em UTC. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Meia-noite UTC do dia civil de `now` no fuso de Brasília (o "hoje" do usuário). */
export function todayInBrazil(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return new Date(`${parts}T00:00:00.000Z`)
}

function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

// ─── Tipo e valor líquido ───────────────────────────────────────────────────

/** Rótulo do tipo do provento: 'JCP', 'Rendimento' (FII) ou 'Dividendo' (padrão). */
export function dividendTypeLabel(type: string | null | undefined): DividendTypeLabel {
  if (isJcp(type)) return 'JCP'
  if (normalizeText(type).includes('rend')) return 'Rendimento'
  return 'Dividendo'
}

/** Valor líquido por ação: JCP com IRRF pela data ex; dividendos e rendimentos são isentos. */
export function netPerShare(amount: number, type: DividendTypeLabel, exDate: Date): number {
  return type === 'JCP' ? jcpNet(amount, exDate) : amount
}

/** Alíquota de IRRF aplicada ao evento (0 para dividendos e rendimentos). */
export function irrfRate(type: DividendTypeLabel, exDate: Date): number {
  return type === 'JCP' ? jcpIrrfRate(exDate) : 0
}

// ─── Posição na data ex ─────────────────────────────────────────────────────

export interface PositionTrade {
  date: Date
  /** `TransactionType` do Prisma. */
  type: string
  quantity: number
}

const BUY_TYPES = new Set(['BUY', 'BUY_REBALANCE'])
const SELL_TYPES = new Set(['SELL_REBALANCE', 'SELL_WITHDRAWAL'])

/**
 * Ações em carteira com direito ao provento: compras menos vendas com data **anterior** à data ex (quem compra na data ex
 * já não recebe; quem vende na data ex ainda recebe). Nunca negativa.
 */
export function positionAtExDate(trades: readonly PositionTrade[], exDate: Date): number {
  const limit = exDate.getTime()
  let quantity = 0
  for (const trade of trades) {
    if (trade.date.getTime() >= limit || !Number.isFinite(trade.quantity)) continue
    if (BUY_TYPES.has(trade.type)) quantity += trade.quantity
    else if (SELL_TYPES.has(trade.type)) quantity -= trade.quantity
  }
  return Math.max(0, roundTo(quantity))
}

// ─── Deduplicação de lançamentos de proventos ───────────────────────────────

/** Lançamento DIVIDEND existente na carteira (qualquer status). */
export interface ExistingDividendTransaction {
  ticker: string
  date: Date
  /** Total lançado (R$). */
  amount: number
  /** Valor por ação gravado em `price`; `null`/0 em lançamentos manuais. */
  perShare: number | null
}

export interface DividendCandidate {
  ticker: string
  /** Data do lançamento sugerido (pagamento, ou data ex sem pagamento). */
  date: Date
  quantity: number
  grossPerShare: number
  netPerShare: number
  /** Total líquido sugerido (R$). */
  total: number
}

function sameMonthUTC(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

/**
 * O provento sugerido já foi lançado: mesmo ativo, mesmo mês e mesmo valor. Lançamentos automáticos comparam o valor por
 * ação (bruto ou líquido, tolerância de 1%); manuais comparam o total (líquido ou bruto, tolerância de 2% ou R$ 0,01).
 */
export function isSameDividend(existing: ExistingDividendTransaction, candidate: DividendCandidate): boolean {
  if (existing.ticker !== candidate.ticker || !sameMonthUTC(existing.date, candidate.date)) return false
  if (existing.perShare && existing.perShare > 0) {
    return [candidate.netPerShare, candidate.grossPerShare].some((value) =>
      near(existing.perShare as number, value, Math.max(0.0001, value * 0.01)),
    )
  }
  const grossTotal = roundTo(candidate.quantity * candidate.grossPerShare, 2)
  return [candidate.total, grossTotal].some((value) => near(existing.amount, value, Math.max(0.01, value * 0.02)))
}

// ─── Projeção ───────────────────────────────────────────────────────────────

/**
 * Estimativa estatística dos próximos 12 meses, a começar pelo mês corrente: `projectSeasonal` com referência no último
 * dia do mês anterior (as três janelas de 12 meses terminam ali). Determinística: mesmo histórico e mesmo dia, mesmo
 * resultado.
 */
export function seasonalProjectionsFrom(events: readonly DividendEvent[], today: Date, monthsAhead = 12): SeasonalProjection[] {
  const asOf = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
  return projectSeasonal(events, asOf, monthsAhead)
}

/** Confiança exibida no radar (0–100) a partir de quantos dos últimos 3 anos tiveram data ex no mês. */
export function projectionConfidence(occurrences: number): number {
  return occurrences >= 3 ? 80 : 65
}

/** Mediana de dias entre data ex e pagamento no histórico do ativo; `null` sem datas de pagamento. */
export function medianPaymentLagDays(events: readonly DividendEvent[]): number | null {
  const lags: number[] = []
  for (const e of events) {
    if (!e.paymentDate) continue
    const days = Math.round((e.paymentDate.getTime() - e.exDate.getTime()) / DAY_MS)
    if (days >= 0 && days <= 365) lags.push(days)
  }
  const value = median(lags)
  return value === null ? null : Math.round(value)
}

// ─── Eventos ────────────────────────────────────────────────────────────────

export interface AgendaCompanyInput {
  ticker: string
  name: string | null
  logoUrl?: string | null
  assetType?: string | null
  dividends: readonly DividendHistoryRow[]
}

export interface BuildAgendaInput {
  companies: readonly AgendaCompanyInput[]
  portfolioTickers: Iterable<string>
  radarTickers: Iterable<string>
  /** Transações confirmadas da carteira (todas as carteiras ativas do usuário) por ticker. */
  tradesByTicker: ReadonlyMap<string, readonly PositionTrade[]>
  today: Date
}

function eventId(ticker: string, kind: AgendaKind, type: DividendTypeLabel, exDate: string, amount: number): string {
  if (kind === 'projected') return `${ticker}-${type}-${exDate.slice(0, 7)}-estimativa`
  return `${ticker}-${type}-${exDate}-${amount.toFixed(6)}`
}

function inWindow(date: Date | null | undefined, start: Date, end: Date): boolean {
  if (!date) return false
  const t = date.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/**
 * Eventos da agenda: proventos do histórico com data ex ou pagamento entre hoje − 90 dias e hoje + 366 dias, mais a
 * estimativa estatística dos meses sem provento anunciado. Para os ativos da carteira, calcula a quantidade na data ex e o
 * valor estimado (bruto e líquido). Ordenados por data ex.
 */
export function buildAgendaEvents(input: BuildAgendaInput): AgendaEvent[] {
  const portfolio = new Set(input.portfolioTickers)
  const radar = new Set(input.radarTickers)
  const start = addDays(input.today, -AGENDA_PAST_DAYS)
  const end = addDays(input.today, AGENDA_FUTURE_DAYS)
  const result: AgendaEvent[] = []

  for (const company of input.companies) {
    const ticker = company.ticker
    const sources: AgendaSource[] = []
    if (portfolio.has(ticker)) sources.push('portfolio')
    if (radar.has(ticker)) sources.push('radar')
    if (sources.length === 0) continue

    const trades = input.tradesByTicker.get(ticker) ?? []
    const inPortfolio = portfolio.has(ticker)
    const history = toDividendEvents([...company.dividends])

    const withPosition = (base: Omit<AgendaEvent, 'quantity' | 'positionGross' | 'positionNet' | 'sources' | 'id'>): AgendaEvent => {
      const quantity = inPortfolio ? positionAtExDate(trades, fromDateKey(base.exDate)) : null
      return {
        ...base,
        id: eventId(ticker, base.kind, base.type, base.exDate, base.amount),
        sources,
        quantity,
        positionGross: quantity === null ? null : roundTo(quantity * base.amount, 2),
        positionNet: quantity === null ? null : roundTo(quantity * base.netAmount, 2),
      }
    }

    const confirmedMonths = new Set<string>()
    for (const e of history) {
      confirmedMonths.add(toDateKey(e.exDate).slice(0, 7))
      if (!inWindow(e.exDate, start, end) && !inWindow(e.paymentDate, start, end)) continue
      const type = dividendTypeLabel(e.type)
      result.push(
        withPosition({
          ticker,
          companyName: company.name,
          logoUrl: company.logoUrl ?? null,
          assetType: company.assetType ?? null,
          kind: 'confirmed',
          type,
          exDate: toDateKey(e.exDate),
          paymentDate: e.paymentDate ? toDateKey(e.paymentDate) : null,
          paymentDateEstimated: false,
          amount: e.amount,
          netAmount: netPerShare(e.amount, type, e.exDate),
        }),
      )
    }

    const lag = medianPaymentLagDays(history)
    for (const p of seasonalProjectionsFrom(history, input.today)) {
      if (confirmedMonths.has(p.month) || p.exDate.getTime() < input.today.getTime() || p.exDate.getTime() > end.getTime()) continue
      const type = dividendTypeLabel(p.type)
      result.push(
        withPosition({
          ticker,
          companyName: company.name,
          logoUrl: company.logoUrl ?? null,
          assetType: company.assetType ?? null,
          kind: 'projected',
          type,
          exDate: toDateKey(p.exDate),
          paymentDate: lag === null ? null : toDateKey(addDays(p.exDate, lag)),
          paymentDateEstimated: lag !== null,
          amount: p.amount,
          netAmount: netPerShare(p.amount, type, p.exDate),
        }),
      )
    }
  }

  return result.sort((a, b) => a.exDate.localeCompare(b.exDate) || a.ticker.localeCompare(b.ticker))
}

// ─── Filtros ────────────────────────────────────────────────────────────────

function matchesScope(event: AgendaEvent, scope: AgendaScope): boolean {
  if (scope === 'carteira') return event.sources.includes('portfolio')
  if (scope === 'radar') return event.sources.includes('radar')
  return true
}

/**
 * Data que coloca o evento no período: nos "próximos N dias", a primeira entre data ex e pagamento dentro de [hoje, hoje + N];
 * nos "últimos 90 dias", a mais recente dentro de [hoje − 90, hoje). `null` fora do período.
 */
export function periodDate(event: AgendaEvent, period: AgendaPeriod, today: string): string | null {
  const dates = [event.exDate, event.paymentDate].filter((d): d is string => !!d)
  const base = fromDateKey(today)
  if (period === 'ultimos-90') {
    const start = toDateKey(addDays(base, -90))
    const inside = dates.filter((d) => d >= start && d < today).sort()
    return inside[inside.length - 1] ?? null
  }
  const end = toDateKey(addDays(base, period === 'proximos-30' ? 30 : 90))
  const inside = dates.filter((d) => d >= today && d <= end).sort()
  return inside[0] ?? null
}

/**
 * Eventos do escopo e período. A ordem segue a coluna visível "Data ex" (depois pagamento e ticker):
 * crescente nos "próximos N dias", do mais recente para trás em "últimos 90 dias".
 */
export function filterAgendaEvents(events: readonly AgendaEvent[], scope: AgendaScope, period: AgendaPeriod, today: string): AgendaEvent[] {
  const rows = events.filter((e) => matchesScope(e, scope) && periodDate(e, period, today) !== null)
  rows.sort(
    (a, b) =>
      a.exDate.localeCompare(b.exDate) ||
      (a.paymentDate ?? '9999-12-31').localeCompare(b.paymentDate ?? '9999-12-31') ||
      a.ticker.localeCompare(b.ticker)
  )
  if (period === 'ultimos-90') rows.reverse()
  return rows
}

/** Próximo pagamento da carteira: menor data de pagamento >= hoje entre eventos com valor estimado positivo. */
export function nextPortfolioPayment(events: readonly AgendaEvent[], today: string): AgendaEvent | null {
  let next: AgendaEvent | null = null
  let nextDate = ''
  for (const e of events) {
    const date = e.paymentDate
    const net = e.positionNet ?? 0
    if (!e.sources.includes('portfolio') || !date || date < today || net <= 0) continue
    if (!next || date < nextDate || (date === nextDate && net > (next.positionNet ?? 0))) {
      next = e
      nextDate = date
    }
  }
  return next
}

/** `YYYY-MM-DD` deslocado em `days` dias. */
export function addDaysKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days))
}

/** Renda líquida da carteira com pagamento (anunciado ou estimado) entre `from` e `to`, inclusive. */
export function portfolioIncomeBetween(events: readonly AgendaEvent[], from: string, to: string): number {
  let total = 0
  for (const e of events) {
    if (e.paymentDate && e.paymentDate >= from && e.paymentDate <= to && e.positionNet) total += e.positionNet
  }
  return roundTo(total, 2)
}

// ─── Renda mensal ───────────────────────────────────────────────────────────

/**
 * Renda líquida da carteira nos 12 meses a partir do mês corrente, pela data de pagamento (data ex quando ela não
 * existe). Proventos anunciados e estimados ficam separados; meses sem provento entram com zero.
 */
export function monthlyPortfolioIncome(events: readonly AgendaEvent[], today: Date, months = 12): MonthlyIncome[] {
  const buckets: MonthlyIncome[] = []
  const index = new Map<string, MonthlyIncome>()
  for (let k = 0; k < months; k++) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + k, 1))
    const bucket = { month: toDateKey(date).slice(0, 7), confirmed: 0, projected: 0 }
    buckets.push(bucket)
    index.set(bucket.month, bucket)
  }
  for (const e of events) {
    if (!e.positionNet || e.positionNet <= 0) continue
    const bucket = index.get((e.paymentDate ?? e.exDate).slice(0, 7))
    if (!bucket) continue
    if (e.kind === 'confirmed') bucket.confirmed = roundTo(bucket.confirmed + e.positionNet, 2)
    else bucket.projected = roundTo(bucket.projected + e.positionNet, 2)
  }
  return buckets
}

// ─── ICS (RFC 5545) ─────────────────────────────────────────────────────────

const CRLF = '\r\n'

/** Escapa texto de propriedade (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Dobra linhas acima de 75 octetos (RFC 5545 §3.1), sem partir caracteres multibyte. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join(`${CRLF} `)
}

function icsDate(key: string): string {
  return key.replace(/-/g, '')
}

function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** "R$ 0,45" com as casas do valor por ação (4 abaixo de R$ 1). */
function perShareText(amount: number): string {
  const digits = Math.abs(amount) < 1 ? 4 : 2
  return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function brlText(amount: number): string {
  return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dateText(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

/** Título do evento: "ITUB4 JCP R$ 0,4500/ação" (+ "(estimativa)"; "Data ex · " quando não há data de pagamento). */
export function icsSummary(event: AgendaEvent): string {
  const base = `${event.ticker} ${event.type} ${perShareText(event.amount)}/ação`
  const prefix = event.paymentDate && !event.paymentDateEstimated ? '' : event.paymentDate ? 'Pagamento estimado · ' : 'Data ex · '
  return `${prefix}${base}${event.kind === 'projected' ? ' (estimativa)' : ''}`
}

function icsDescription(event: AgendaEvent): string {
  const lines = [
    `Data ex: ${dateText(event.exDate)}`,
    event.paymentDate
      ? `Pagamento${event.paymentDateEstimated ? ' (estimado)' : ''}: ${dateText(event.paymentDate)}`
      : 'Pagamento: não informado',
    `Valor bruto por ação: ${perShareText(event.amount)}`,
  ]
  if (event.type === 'JCP') {
    const rate = irrfRate(event.type, fromDateKey(event.exDate))
    lines.push(`Valor líquido por ação: ${perShareText(event.netAmount)} (IRRF ${(rate * 100).toLocaleString('pt-BR')}%)`)
  }
  if (event.quantity && event.positionNet !== null) {
    lines.push(`Sua posição: ${event.quantity.toLocaleString('pt-BR')} ações, ${brlText(event.positionNet)} líquidos (estimado)`)
  }
  if (event.kind === 'projected') {
    lines.push('Estimativa estatística a partir do histórico de proventos. Não é anúncio da empresa nem recomendação de investimento.')
  }
  lines.push('Preço Justo AI · Agenda de proventos')
  return lines.join('\n')
}

/**
 * Calendário iCalendar (RFC 5545): um VEVENT de dia inteiro por provento, em `DTSTART;VALUE=DATE` na data de pagamento
 * (ou na data ex, quando não há pagamento). Linhas terminadas em CRLF e dobradas em 75 octetos.
 */
export function buildIcsCalendar(events: readonly AgendaEvent[], now: Date = new Date()): string {
  const stamp = icsTimestamp(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Preço Justo AI//Agenda de proventos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda de proventos',
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ]
  for (const event of events) {
    const day = event.paymentDate ?? event.exDate
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@precojusto.ai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(day)}`,
      `DTEND;VALUE=DATE:${icsDate(toDateKey(addDays(fromDateKey(day), 1)))}`,
      `SUMMARY:${escapeIcsText(icsSummary(event))}`,
      `DESCRIPTION:${escapeIcsText(icsDescription(event))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
