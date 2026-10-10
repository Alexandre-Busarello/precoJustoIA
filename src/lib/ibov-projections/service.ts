/**
 * Serviço das faixas estatísticas do Ibovespa (servidor).
 *
 * - Fonte única de fechamentos: Yahoo Finance `^BVSP`, barras diárias desde 16 anos atrás (10 anos para as faixas
 *   e mais 5 para a calibração).
 * - Calcula sob demanda e guarda em cache por dia e fase do pregão: o primeiro acesso de cada pregão recalcula,
 *   mesmo que o cron nunca rode. Se o Yahoo falhar, devolve o último cálculo bom (marcado como desatualizado).
 * - O cron só aquece o cache, grava um registro diário em `IbovProjection` (os campos novos ficam em
 *   `keyIndicators`) e, se configurado, gera o comentário de IA. Nenhum número passa pela IA.
 */

import 'server-only'

import { GoogleGenAI } from '@google/genai'
import type { Prisma } from '@prisma/client'
import { cacheService } from '@/lib/cache-service'
import { getMacroAssumptions } from '@/lib/finance/macro'
import { prisma } from '@/lib/prisma'
import { YahooFinance2Service } from '@/lib/yahooFinance2-service'
import { buildCommentaryPrompt, validateCommentary } from './commentary'
import { brazilClock, buildPlBolsaContext, quotesToCloses, reportCacheKey, snapshotValidUntil, type BrazilClock } from './context'
import { buildIbovProjection, METHOD_ID, staleInfo, type DailyClose } from './engine'
import type { IbovCommentary, IbovProjectionReport, MacroRate, MarketContext } from './types'

const SYMBOL = '^BVSP'
const HISTORY_YEARS = 16
const REPORT_TTL_SECONDS = 24 * 60 * 60
/** Versão do formato do relatório em cache: mude quando os campos mudarem, para não servir cache antigo. */
const CACHE_NAMESPACE = `${METHOD_ID}:r3`
const LAST_GOOD_KEY = `ibov-projections:${CACHE_NAMESPACE}:last-good`
const LAST_GOOD_TTL_SECONDS = 30 * 24 * 60 * 60
/** Comentário de IA só aparece enquanto tiver até 3 dias. */
const COMMENTARY_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const COMMENTARY_TIMEOUT_MS = 20_000
const COMMENTARY_MODEL = 'gemini-flash-lite-latest'

let inflight: { key: string; promise: Promise<IbovProjectionReport> } | null = null

async function fetchIbovCloses(clock: BrazilClock): Promise<DailyClose[]> {
  const startYear = Number(clock.today.slice(0, 4)) - HISTORY_YEARS
  const chart = await YahooFinance2Service.getChartWithoutCache(SYMBOL, { period1: `${startYear}-01-01`, interval: '1d' })
  const quotes = Array.isArray(chart?.quotes) ? chart.quotes : []
  return quotesToCloses(quotes, clock)
}

function toRate(value: number, info: { asOf: string; source: 'db' | 'fallback' } | undefined): MacroRate | null {
  if (!Number.isFinite(value)) return null
  return { value, asOf: info?.asOf ?? '', source: info?.source ?? 'fallback' }
}

async function getMarketContext(): Promise<MarketContext> {
  const [plRows, macro] = await Promise.all([
    prisma.plBolsaHistory
      .findMany({
        where: { sector: null, minScore: null, excludeUnprofitable: false },
        orderBy: { date: 'asc' },
        select: { date: true, pl: true },
      })
      .catch((error: unknown) => {
        console.error('[ibov-projections] falha ao ler P/L da bolsa:', error)
        return []
      }),
    getMacroAssumptions(),
  ])
  return {
    // `date` é @db.Date (meia-noite UTC): a data certa é a parte UTC, não a de Brasília.
    plBolsa: buildPlBolsaContext(plRows.map((r) => ({ date: r.date.toISOString().slice(0, 10), pl: Number(r.pl) }))),
    selic: toRate(macro.selic, macro.sources.selic),
    cdi: toRate(macro.cdi, macro.sources.cdi),
  }
}

/** Comentário de IA mais recente do método atual (até 3 dias), salvo pelo cron. */
async function getLatestCommentary(): Promise<IbovCommentary | null> {
  try {
    // Os três horizontes do dia levam o mesmo comentário; olha os registros mais recentes até achar um.
    const rows = await prisma.ibovProjection.findMany({
      where: {
        createdAt: { gt: new Date(Date.now() - COMMENTARY_MAX_AGE_MS) },
        keyIndicators: { path: ['method'], equals: METHOD_ID },
      },
      orderBy: { createdAt: 'desc' },
      take: 9,
      select: { keyIndicators: true },
    })
    const stored = rows
      .map((row) => (row.keyIndicators as { commentary?: IbovCommentary | null } | null)?.commentary)
      .find((commentary) => commentary?.text)
    const text = validateCommentary(stored?.text)
    return text && stored?.generatedAt ? { text, generatedAt: stored.generatedAt } : null
  } catch (error) {
    console.error('[ibov-projections] falha ao ler comentário:', error)
    return null
  }
}

async function computeReport(clock: BrazilClock): Promise<IbovProjectionReport> {
  const [closes, context, commentary] = await Promise.all([fetchIbovCloses(clock), getMarketContext(), getLatestCommentary()])
  const core = buildIbovProjection(closes, { today: clock.today, sessionClosed: clock.sessionClosed })
  if (core.status !== 'ok') throw new Error('Sem fechamentos do Ibovespa na fonte de dados')
  return { ...core, context, commentary, generatedAt: new Date().toISOString(), referenceDate: clock.today }
}

/**
 * Faixas do Ibovespa para hoje. Usa o cache do dia/fase do pregão; `force` recalcula.
 * Se o cálculo falhar, devolve o último resultado bom com o atraso recalculado; sem nenhum, propaga o erro.
 */
export async function getIbovProjectionReport({ force = false, now = new Date() }: { force?: boolean; now?: Date } = {}): Promise<IbovProjectionReport> {
  const clock = brazilClock(now)
  const key = reportCacheKey(clock, CACHE_NAMESPACE)

  if (!force) {
    const cached = await cacheService.get<IbovProjectionReport>(key)
    if (cached) return cached
    if (inflight?.key === key) return inflight.promise
  }

  const promise = computeReport(clock)
    .then(async (report) => {
      await Promise.all([
        cacheService.set(key, report, { ttl: REPORT_TTL_SECONDS }),
        cacheService.set(LAST_GOOD_KEY, report, { ttl: LAST_GOOD_TTL_SECONDS }),
      ])
      return report
    })
    .catch(async (error: unknown) => {
      console.error('[ibov-projections] falha ao calcular as faixas:', error)
      const lastGood = await cacheService.get<IbovProjectionReport>(LAST_GOOD_KEY)
      if (!lastGood) throw error
      return { ...lastGood, stale: staleInfo(lastGood.lastCloseDate, clock.today, clock.sessionClosed) }
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { key, promise }
  return promise
}

/** Atualiza só o comentário no cache do dia, sem recalcular os números. */
async function refreshCachedCommentary(commentary: IbovCommentary, now: Date): Promise<void> {
  const key = reportCacheKey(brazilClock(now), CACHE_NAMESPACE)
  const cached = await cacheService.get<IbovProjectionReport>(key)
  if (cached) await cacheService.set(key, { ...cached, commentary }, { ttl: REPORT_TTL_SECONDS })
}

/**
 * Grava um registro por horizonte no `IbovProjection` (um por dia de referência; reexecuções sobrescrevem).
 * `projectedValue` guarda a mediana (p50) e `confidence` a cobertura nominal da faixa provável (68).
 */
export async function saveProjectionSnapshots(report: IbovProjectionReport, commentary: IbovCommentary | null): Promise<number> {
  const validUntil = snapshotValidUntil(report.referenceDate)
  let saved = 0
  for (const h of report.horizons) {
    if (h.status !== 'ok' || !h.levels) continue
    // Ida e volta em JSON: tipa como valor JSON do Prisma e descarta campos `undefined`.
    const keyIndicators = JSON.parse(
      JSON.stringify({
        method: METHOD_ID,
        horizonDays: h.tradingDays,
        lastClose: report.lastClose,
        lastCloseDate: report.lastCloseDate,
        levels: h.levels,
        returns: h.returns,
        positiveShare: h.positiveShare,
        sampleSize: h.sampleSize,
        independentPeriods: h.independentPeriods,
        volatility: h.volatility,
        volatilityAdjusted: report.volatilityAdjusted,
        calibration: h.calibration,
        commentary,
      })
    ) as Prisma.InputJsonObject
    const reasoning = commentary?.text ?? `Faixa estatística de ${h.label} com base no comportamento histórico do Ibovespa.`
    await prisma.ibovProjection.upsert({
      where: { period_validUntil: { period: h.id, validUntil } },
      create: { period: h.id, projectedValue: h.levels.p50, confidence: 68, reasoning, keyIndicators, validUntil },
      update: { projectedValue: h.levels.p50, confidence: 68, reasoning, keyIndicators },
    })
    saved++
  }
  return saved
}

/** Comentário já gerado hoje (para o cron não chamar a IA de novo). */
async function getTodaysCommentary(referenceDate: string): Promise<IbovCommentary | null> {
  const row = await prisma.ibovProjection.findFirst({
    where: { validUntil: snapshotValidUntil(referenceDate), keyIndicators: { path: ['method'], equals: METHOD_ID } },
    select: { keyIndicators: true },
  })
  const stored = (row?.keyIndicators as { commentary?: IbovCommentary | null } | null)?.commentary
  return stored?.text && stored.generatedAt ? stored : null
}

/** Pede ao modelo 2–3 frases de contexto a partir dos números calculados. Qualquer falha devolve `null`. */
async function generateCommentary(report: IbovProjectionReport): Promise<IbovCommentary | null> {
  if (!process.env.GEMINI_API_KEY) return null
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const request = ai.models.generateContent({
      model: COMMENTARY_MODEL,
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.3, maxOutputTokens: 400 },
      contents: [{ role: 'user', parts: [{ text: buildCommentaryPrompt(report) }] }],
    })
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), COMMENTARY_TIMEOUT_MS))
    const response = await Promise.race([request, timeout])
    const text = validateCommentary(response?.text)
    return text ? { text, generatedAt: new Date().toISOString() } : null
  } catch (error) {
    console.error('[ibov-projections] falha ao gerar comentário:', error)
    return null
  }
}

export interface WarmUpResult {
  lastClose: number | null
  lastCloseDate: string | null
  stale: boolean
  snapshots: number
  commentary: 'existing' | 'generated' | 'skipped' | 'failed'
}

/**
 * Aquecimento usado pelo cron e pelo admin: recalcula, grava os registros do dia e, se pedido, gera o comentário
 * (uma chamada curta por dia, com tempo limite). A falha do comentário nunca impede a atualização dos números.
 */
export async function warmIbovProjections({ withCommentary }: { withCommentary: boolean }): Promise<WarmUpResult> {
  const now = new Date()
  const report = await getIbovProjectionReport({ force: true, now })

  let commentary = await getTodaysCommentary(report.referenceDate).catch(() => null)
  let commentaryStatus: WarmUpResult['commentary'] = commentary ? 'existing' : 'skipped'
  if (!commentary && withCommentary) {
    commentary = await generateCommentary(report)
    commentaryStatus = commentary ? 'generated' : 'failed'
  }

  const snapshots = await saveProjectionSnapshots(report, commentary)
  if (commentary) await refreshCachedCommentary(commentary, now)

  return {
    lastClose: report.lastClose,
    lastCloseDate: report.lastCloseDate,
    stale: report.stale.isStale,
    snapshots,
    commentary: commentaryStatus,
  }
}

export interface ProjectionSnapshotRow {
  id: string
  period: string
  median: number
  createdAt: string
  validUntil: string
  lastCloseDate: string | null
  hasCommentary: boolean
  /** `false` para registros antigos gerados por IA (método anterior, ignorados pela página). */
  isCurrentMethod: boolean
}

/** Últimos registros salvos (para o admin). */
export async function listProjectionSnapshots(limit = 15): Promise<ProjectionSnapshotRow[]> {
  const rows = await prisma.ibovProjection.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
  return rows.map((row) => {
    const indicators = (row.keyIndicators ?? null) as { method?: string; lastCloseDate?: string; commentary?: IbovCommentary | null } | null
    return {
      id: row.id,
      period: row.period,
      median: Number(row.projectedValue),
      createdAt: row.createdAt.toISOString(),
      validUntil: row.validUntil.toISOString(),
      lastCloseDate: indicators?.lastCloseDate ?? null,
      hasCommentary: Boolean(indicators?.commentary?.text),
      isCurrentMethod: indicators?.method === METHOD_ID,
    }
  })
}
