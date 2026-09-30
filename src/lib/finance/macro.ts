/**
 * Premissas macro (Selic, CDI, IPCA, NTN-B real longa, ERP, UST 10y) para Ke/WACC e DY-alvo de FIIs.
 *
 * Fonte: `EconomicIndicatorHistory`, alimentada pelo cron `/api/cron/macro-indicators` com as séries do BCB SGS,
 * gravadas como o BCB publica (em %). Cada campo sem dado recente ou fora de uma faixa plausível cai para
 * `MACRO_FALLBACK`. Todos os valores devolvidos são frações ao ano (0,1375 = 13,75% a.a.).
 *
 * Este módulo não importa o Prisma no topo (a leitura do banco usa import dinâmico), para que estratégias síncronas
 * possam usar `getMacroAssumptionsSync()` sem arrastar dependências de servidor.
 */

import { roundTo } from './utils'

export const MACRO_FALLBACK = {
  selic: 0.1375,
  cdi: 0.1365,
  ipcaExpected: 0.04,
  ntnbRealLong: 0.0768,
  erp: 0.055,
  ust10y: 0.042,
  asOf: '2026-09-16',
} as const

export type MacroField = 'selic' | 'cdi' | 'ipcaExpected' | 'ntnbRealLong' | 'erp' | 'ust10y'

export const MACRO_FIELDS: readonly MacroField[] = ['selic', 'cdi', 'ipcaExpected', 'ntnbRealLong', 'erp', 'ust10y']

/** Símbolos gravados em `EconomicIndicatorHistory.symbol` (e usados também como `indicatorName`). */
export const MACRO_SYMBOLS = {
  /** Meta Selic, % a.a. (SGS 432, diária). */
  selic: 'BCB_SGS_432',
  /** CDI, % ao dia (SGS 12). */
  cdi: 'BCB_SGS_12',
  /** IPCA, variação % mensal (SGS 433). */
  ipca: 'BCB_SGS_433',
  /** NTN-B longa, taxa real % a.a. (carga manual ou futura integração com o Tesouro). */
  ntnbRealLong: 'NTNB_REAL_LONG',
} as const

/** Códigos SGS buscados pelo cron. */
export const SGS_CODES = { selic: 432, cdi: 12, ipca: 433 } as const

export type MacroSource = 'db' | 'fallback'

export interface MacroFieldInfo {
  /** Data do dado (YYYY-MM-DD). */
  asOf: string
  source: MacroSource
  /** Símbolo lido do banco, quando `source` é 'db'. */
  symbol?: string
}

export type MacroAssumptions = Record<MacroField, number> & {
  /** Data mais recente entre os campos. */
  asOf: string
  sources: Record<MacroField, MacroFieldInfo>
}

function fallbackAssumptions(): MacroAssumptions {
  const sources = {} as Record<MacroField, MacroFieldInfo>
  for (const field of MACRO_FIELDS) sources[field] = { asOf: MACRO_FALLBACK.asOf, source: 'fallback' }
  return {
    selic: MACRO_FALLBACK.selic,
    cdi: MACRO_FALLBACK.cdi,
    ipcaExpected: MACRO_FALLBACK.ipcaExpected,
    ntnbRealLong: MACRO_FALLBACK.ntnbRealLong,
    erp: MACRO_FALLBACK.erp,
    ust10y: MACRO_FALLBACK.ust10y,
    asOf: MACRO_FALLBACK.asOf,
    sources,
  }
}

/** Faixas plausíveis (fração a.a.); fora delas o dado do banco é descartado. */
const PLAUSIBLE: Partial<Record<MacroField, [number, number]>> = {
  selic: [0.01, 0.5],
  cdi: [0.01, 0.5],
  ipcaExpected: [-0.05, 0.3],
  ntnbRealLong: [0, 0.2],
}

/** Dados mais velhos que isso não são usados (o fallback é mais honesto que um número antigo). */
const MAX_AGE_DAYS: Partial<Record<MacroField, number>> = {
  selic: 30,
  cdi: 30,
  ipcaExpected: 80,
  ntnbRealLong: 30,
}

const DAY_MS = 86_400_000

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** CDI diário em % → taxa anual (252 dias úteis). */
export function annualizeDailyRate(dailyPercent: number): number {
  return (1 + dailyPercent / 100) ** 252 - 1
}

/** IPCA acumulado a partir de variações mensais em %. */
export function compoundMonthlyRates(monthlyPercents: readonly number[]): number {
  return monthlyPercents.reduce((acc, v) => acc * (1 + v / 100), 1) - 1
}

/** Taxa livre de risco nominal a partir da NTN-B real longa e do IPCA esperado: `(1 + real) × (1 + IPCA) − 1`. */
export function nominalRiskFree(ntnbReal: number, ipcaExpected: number): number {
  return (1 + ntnbReal) * (1 + ipcaExpected) - 1
}

export interface KeInput {
  /** Taxa livre de risco nominal (ver `nominalRiskFree`). */
  rfNominal: number
  beta?: number
  /** Prêmio de risco de mercado (equity risk premium). */
  erp: number
  /** Piso: o Ke nunca fica abaixo da Selic. Padrão: `MACRO_FALLBACK.selic`. */
  selic?: number
}

/** Custo de capital próprio (CAPM): `max(selic, rf + β × ERP)`. */
export function computeKe({ rfNominal, beta = 1, erp, selic = MACRO_FALLBACK.selic }: KeInput): number {
  return roundTo(Math.max(selic, rfNominal + beta * erp), 10)
}

/** Ke a partir de um conjunto de premissas macro. */
export function keFromMacro(macro: Pick<MacroAssumptions, 'ntnbRealLong' | 'ipcaExpected' | 'erp' | 'selic'>, beta = 1): number {
  return computeKe({
    rfNominal: nominalRiskFree(macro.ntnbRealLong, macro.ipcaExpected),
    beta,
    erp: macro.erp,
    selic: macro.selic,
  })
}

export interface SgsPoint {
  /** Data da observação (meia-noite UTC). */
  date: Date
  /** Valor como o BCB publica (em %). */
  value: number
}

function formatSgsDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getUTCFullYear()}`
}

/** Converte 'dd/MM/yyyy' em Date UTC; `null` se inválida. */
export function parseSgsDate(text: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Série do BCB SGS (API pública) a partir de `fromDate`, em ordem cronológica.
 * Lança erro em falha HTTP ou resposta inesperada, para o chamador decidir o que registrar.
 */
export async function fetchSgsSeries(code: number, fromDate: Date): Promise<SgsPoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${formatSgsDate(fromDate)}`
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`BCB SGS ${code}: HTTP ${response.status}`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) throw new Error(`BCB SGS ${code}: resposta inesperada`)

  const points: SgsPoint[] = []
  for (const item of body) {
    if (typeof item !== 'object' || item === null) continue
    const { data, valor } = item as { data?: unknown; valor?: unknown }
    const date = typeof data === 'string' ? parseSgsDate(data) : null
    const value = typeof valor === 'string' || typeof valor === 'number' ? Number(valor) : Number.NaN
    if (date && Number.isFinite(value)) points.push({ date, value })
  }
  return points.sort((a, b) => a.date.getTime() - b.date.getTime())
}

interface IndicatorRow {
  date: Date
  value: number
}

/** Converte as séries brutas do banco em premissas por campo, validando idade e faixa plausível. */
export function buildMacroAssumptions(
  rows: Partial<Record<keyof typeof MACRO_SYMBOLS, readonly IndicatorRow[]>>,
  now: Date = new Date()
): MacroAssumptions {
  const result = fallbackAssumptions()

  const accept = (field: MacroField, value: number, date: Date, symbol: string) => {
    const range = PLAUSIBLE[field]
    const maxAge = MAX_AGE_DAYS[field]
    if (!Number.isFinite(value)) return
    if (range && (value < range[0] || value > range[1])) return
    if (maxAge !== undefined && now.getTime() - date.getTime() > maxAge * DAY_MS) return
    result[field] = roundTo(value)
    result.sources[field] = { asOf: toIsoDate(date), source: 'db', symbol }
  }

  // Ignora datas futuras (a série da meta Selic é publicada até a próxima reunião do Copom).
  const upToNow = (list?: readonly IndicatorRow[]) => (list ?? []).filter((r) => r.date.getTime() <= now.getTime())
  const latest = (list?: readonly IndicatorRow[]) => {
    const past = upToNow(list)
    return past.length > 0 ? past.reduce((a, b) => (b.date > a.date ? b : a)) : null
  }

  const selic = latest(rows.selic)
  if (selic) accept('selic', selic.value / 100, selic.date, MACRO_SYMBOLS.selic)

  const cdi = latest(rows.cdi)
  if (cdi) accept('cdi', annualizeDailyRate(cdi.value), cdi.date, MACRO_SYMBOLS.cdi)

  const ntnb = latest(rows.ntnbRealLong)
  if (ntnb) accept('ntnbRealLong', ntnb.value / 100, ntnb.date, MACRO_SYMBOLS.ntnbRealLong)

  // IPCA esperado ≈ IPCA acumulado dos últimos 12 meses (até haver série Focus), exigindo 12 meses consecutivos.
  const ipca = upToNow(rows.ipca).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12)
  if (ipca.length === 12) {
    const newest = ipca[0].date
    const oldest = ipca[11].date
    const monthsSpan =
      (newest.getUTCFullYear() - oldest.getUTCFullYear()) * 12 + (newest.getUTCMonth() - oldest.getUTCMonth())
    if (monthsSpan === 11) {
      accept('ipcaExpected', compoundMonthlyRates(ipca.map((r) => r.value)), newest, MACRO_SYMBOLS.ipca)
    }
  }

  result.asOf = MACRO_FIELDS.map((f) => result.sources[f].asOf).reduce((a, b) => (b > a ? b : a))
  return result
}

const CACHE_TTL_MS = 60 * 60 * 1000
let snapshot: MacroAssumptions = fallbackAssumptions()
let snapshotExpiresAt = 0
let inflight: Promise<MacroAssumptions> | null = null

async function loadFromDatabase(): Promise<MacroAssumptions> {
  const { prisma } = await import('@/lib/prisma')
  const since = new Date(Date.now() - 400 * DAY_MS)
  const records = await prisma.economicIndicatorHistory.findMany({
    where: {
      symbol: { in: Object.values(MACRO_SYMBOLS) },
      interval: '1d',
      date: { gte: since },
    },
    orderBy: { date: 'desc' },
    select: { symbol: true, date: true, value: true },
  })

  const rows: Partial<Record<keyof typeof MACRO_SYMBOLS, IndicatorRow[]>> = {}
  const keyBySymbol = new Map<string, keyof typeof MACRO_SYMBOLS>(
    Object.entries(MACRO_SYMBOLS).map(([k, v]) => [v, k as keyof typeof MACRO_SYMBOLS])
  )
  for (const record of records) {
    const key = keyBySymbol.get(record.symbol)
    if (!key) continue
    ;(rows[key] ??= []).push({ date: record.date, value: Number(record.value) })
  }
  return buildMacroAssumptions(rows)
}

/**
 * Premissas macro mais recentes do banco, com fallback por campo e cache de 1 hora. Nunca lança erro:
 * se o banco falhar, devolve o último snapshot válido (ou `MACRO_FALLBACK`). Também atualiza o snapshot síncrono.
 */
export async function getMacroAssumptions({ force = false }: { force?: boolean } = {}): Promise<MacroAssumptions> {
  if (!force && Date.now() < snapshotExpiresAt) return snapshot
  if (!inflight) {
    inflight = loadFromDatabase()
      .then((value) => {
        snapshot = value
        snapshotExpiresAt = Date.now() + CACHE_TTL_MS
        return value
      })
      .catch((error: unknown) => {
        console.error('[macro] falha ao ler premissas do banco; usando snapshot/fallback:', error)
        return snapshot
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Pré-carrega o snapshot síncrono. Chame antes de rodar estratégias (que são síncronas). */
export async function warmMacroAssumptions(options: { force?: boolean } = {}): Promise<MacroAssumptions> {
  return getMacroAssumptions(options)
}

/** Snapshot síncrono: o último valor carregado por `getMacroAssumptions`/`warm…`, ou `MACRO_FALLBACK` se nunca carregado. */
export function getMacroAssumptionsSync(): MacroAssumptions {
  return snapshot
}
