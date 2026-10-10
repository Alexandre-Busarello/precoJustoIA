/**
 * Motor do "Onde aportar": distribui um aporte entre ativos segundo os critérios do usuário.
 * Puro e determinístico (sem banco, rede ou IA): mesmos dados e opções → mesmo resultado.
 *
 * 1. Filtros (o ativo fica de fora com o motivo): tipo sem modelo de preço justo, sem cotação, liquidez abaixo do
 *    mínimo, poucos critérios na nota, nota de qualidade abaixo do mínimo, fundamentos em piora (ou sem histórico),
 *    preço acima do valor estimado em todos os modelos escolhidos e, seguindo pesos-alvo, já no alvo.
 * 2. Prioridade = soma ponderada de componentes 0–1: desconto (mediana da margem de segurança nos modelos, de −50% → 0 a +50% → 1),
 *    qualidade (nota ÷ 100) e distância até o peso-alvo (÷ a maior distância do universo).
 * 3. Distribuição em quantidades inteiras: parte proporcional à prioridade, limitada por ativo (% do aporte e % da
 *    carteira depois do aporte), por setor e pelo alvo; o que sobra vai, um lote por vez, a quem ficou mais longe da
 *    sua parte e, depois, na ordem de prioridade, até os limites. Desempate: maior desconto, maior liquidez, ticker.
 */

import { formatBRL, formatBRLCompact, formatNumber, formatPct } from '@/lib/format'
import { isIlliquid, LIQUIDITY_DEFAULTS, toLiquidityAssetType } from '@/lib/finance/liquidity-rules'
import { median } from '@/lib/finance/utils'
import { marginOfSafety } from '@/lib/valuation-metrics'
import {
  ALLOCATION_MODEL_LABEL,
  ALLOCATION_MODEL_TARGET,
  CONCENTRATION_PENALTY,
  FREE_MODELS,
  FULL_DISCOUNT,
  VALUATION_FLOOR,
  MARKET_CANDIDATES_SHOWN,
  MODELS_BY_ASSET_TYPE,
  STANDARD_LOT,
} from './constants'
import type {
  AllocationAssetType,
  AllocationMeta,
  AllocationOptions,
  AllocationResult,
  AllocationRow,
  AllocationWeights,
  AssetContext,
  CandidateRow,
  ExcludedRow,
  FairValueModelId,
  FunnelStep,
  GateId,
  MarketOptions,
  PriorityComponents,
} from './types'

const EPS = 1e-9

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function pp(fraction: number): string {
  return `${formatNumber(Math.abs(fraction) * 100, { digits: 1 })} p.p.`
}

function liquidityLimit(asset: AssetContext, options: AllocationOptions): number {
  return options.minLiquidity ?? LIQUIDITY_DEFAULTS[toLiquidityAssetType(asset.assetType)]
}

/** Peso atual de cada ativo na carteira (antes do aporte) e o valor total da carteira. */
function portfolioValueOf(assets: readonly AssetContext[]): number {
  return assets.reduce((sum, a) => sum + Math.max(0, a.holding?.value ?? 0), 0)
}

interface Evaluation {
  asset: AssetContext
  gate: GateId | null
  reasons: string[]
  modelMargins: Partial<Record<FairValueModelId, number>>
  discount: number | null
  targetGap: number | null
}

/** Margens dos modelos escolhidos que se aplicam ao ativo. */
function modelMarginsOf(asset: AssetContext, models: readonly FairValueModelId[]): Partial<Record<FairValueModelId, number>> {
  const margins: Partial<Record<FairValueModelId, number>> = {}
  for (const model of MODELS_BY_ASSET_TYPE[asset.assetType]) {
    if (!models.includes(model)) continue
    const explicit = asset.margins?.[model]
    const margin = typeof explicit === 'number' && Number.isFinite(explicit) ? explicit : marginOfSafety(asset.price, asset.fairValues[model])
    if (margin !== null && (asset.fairValues[model] ?? 0) > 0) margins[model] = margin
  }
  return margins
}

function describeMargin(model: FairValueModelId, margin: number): string {
  const side = margin >= 0 ? 'abaixo' : 'acima'
  return `${formatPct(Math.abs(margin))} ${side} ${ALLOCATION_MODEL_TARGET[model]}`
}

/** Aplica os filtros a um ativo. `gate` null = elegível. */
/** Ativo cujo modelo de preço justo não está entre os escolhidos (no gratuito, só Graham está liberado). */
function notChosenReason(assetType: AllocationAssetType): string {
  const available = MODELS_BY_ASSET_TYPE[assetType]
  if (available.length === 0) return 'Nenhum dos modelos escolhidos se aplica a este ativo.'
  const labels = available.map((m) => ALLOCATION_MODEL_LABEL[m]).join(', ')
  return available.every((m) => !FREE_MODELS.includes(m))
    ? `O modelo deste tipo de ativo (${labels}) não está entre os escolhidos; ele faz parte do Premium.`
    : `O modelo deste tipo de ativo (${labels}) não está entre os escolhidos.`
}

function evaluate(asset: AssetContext, options: AllocationOptions, portfolioValue: number): Evaluation {
  const base: Evaluation = { asset, gate: null, reasons: [], modelMargins: {}, discount: null, targetGap: null }
  const fail = (gate: GateId, reason: string): Evaluation => ({ ...base, gate, reasons: [reason] })

  const strict = options.strictData
  if (strict && asset.assetType === 'bdr') {
    return fail('type', 'BDR: os modelos de preço justo não se aplicam sem dados de paridade e câmbio.')
  }
  if (strict && asset.assetType === 'etf') {
    return fail('type', 'ETF: a plataforma não calcula preço justo para ETFs (só o Score PJ-ETF).')
  }
  if (!(typeof asset.price === 'number' && asset.price > 0)) return fail('price', 'Sem cotação recente.')

  const limit = liquidityLimit(asset, options)
  const hasLiquidity = typeof asset.liquidity === 'number' && Number.isFinite(asset.liquidity)
  if ((strict || hasLiquidity) && isIlliquid(asset.liquidity, asset.assetType, limit)) {
    const volume = hasLiquidity ? `${formatBRLCompact(asset.liquidity)}/dia` : 'sem dado de volume'
    return fail('liquidity', `Liquidez média de ${volume}, abaixo do mínimo de ${formatBRLCompact(limit)}/dia.`)
  }

  const hasScore = asset.qualityScore !== null && Number.isFinite(asset.qualityScore)
  if (strict && !hasScore) {
    return fail('coverage', 'Sem nota de qualidade calculada: dados insuficientes.')
  }
  if (strict && asset.coverage && asset.coverage.total > 0 && asset.coverage.used / asset.coverage.total < options.minCoverage - EPS) {
    return fail(
      'coverage',
      `Dados insuficientes: nota baseada em ${asset.coverage.used} de ${asset.coverage.total} critérios (mínimo ${formatPct(options.minCoverage, { digits: 0 })}).`
    )
  }
  if (hasScore && (asset.qualityScore as number) < options.minQualityScore - EPS) {
    return fail(
      'quality',
      options.revealQuality
        ? `Nota de qualidade ${formatNumber(asset.qualityScore, { digits: 0 })}/100, abaixo do mínimo de ${options.minQualityScore}.`
        : `Nota de qualidade abaixo do mínimo de ${options.minQualityScore}.`
    )
  }

  if (asset.fundamentals.intact === false && (strict || !asset.fundamentals.insufficient)) {
    return fail(
      'fundamentals',
      asset.fundamentals.insufficient
        ? `Sem histórico suficiente para checar os fundamentos. ${asset.fundamentals.detail ?? ''}`.trim()
        : `Fundamentos em piora. ${asset.fundamentals.detail ?? ''}`.trim()
    )
  }

  const modelMargins = modelMarginsOf(asset, options.models)
  const entries = Object.entries(modelMargins) as [FairValueModelId, number][]
  if (entries.length === 0 && strict) {
    const names = MODELS_BY_ASSET_TYPE[asset.assetType]
      .filter((m) => options.models.includes(m))
      .map((m) => ALLOCATION_MODEL_LABEL[m])
    return fail(
      'valuation',
      names.length > 0
        ? `Sem preço justo calculável nos modelos escolhidos (${names.join(', ')}).`
        : notChosenReason(asset.assetType)
    )
  }
  if (entries.length > 0 && entries.every(([, margin]) => margin <= 0)) {
    const detail = entries.map(([model, margin]) => `${ALLOCATION_MODEL_LABEL[model]} ${formatPct(margin)}`).join(', ')
    return fail('valuation', `Acima do valor estimado em todos os modelos escolhidos (margem: ${detail}).`)
  }
  const discount = entries.length > 0 ? median(entries.map(([, margin]) => margin)) : null

  let targetGap: number | null = null
  if (options.respectTargets && typeof asset.targetWeight === 'number' && asset.targetWeight > 0 && portfolioValue > 0) {
    const current = Math.max(0, asset.holding?.value ?? 0) / portfolioValue
    targetGap = asset.targetWeight - current
    if (targetGap <= EPS) {
      return {
        ...base,
        gate: 'target',
        reasons: [`Já está no peso-alvo ou acima dele (${formatPct(current)} da carteira; alvo ${formatPct(asset.targetWeight)}).`],
      }
    }
  } else if (options.respectTargets && typeof asset.targetWeight === 'number' && asset.targetWeight > 0) {
    targetGap = asset.targetWeight
  } else if (options.respectTargets) {
    return { ...base, gate: 'target', reasons: ['Sem peso-alvo na carteira (0%): fica de fora ao seguir os pesos-alvo.'] }
  }

  return { ...base, modelMargins, discount, targetGap }
}

function activeWeights(weights: AllocationWeights, useTargets: boolean): AllocationWeights {
  const w = { valuation: Math.max(0, weights.valuation), quality: Math.max(0, weights.quality), targetGap: useTargets ? Math.max(0, weights.targetGap) : 0 }
  const total = w.valuation + w.quality + w.targetGap
  if (total <= EPS) return { valuation: 0.5, quality: 0.5, targetGap: 0 }
  return { valuation: w.valuation / total, quality: w.quality / total, targetGap: w.targetGap / total }
}

interface Scored extends Evaluation {
  components: PriorityComponents
  extraReasons: string[]
}

function compareScored(a: Scored, b: Scored): number {
  const byPriority = b.components.priority - a.components.priority
  if (Math.abs(byPriority) > EPS) return byPriority
  const byDiscount = (b.discount ?? -Infinity) - (a.discount ?? -Infinity)
  if (Math.abs(byDiscount) > EPS) return byDiscount
  const byLiquidity = (b.asset.liquidity ?? -Infinity) - (a.asset.liquidity ?? -Infinity)
  if (Math.abs(byLiquidity) > EPS) return byLiquidity
  return a.asset.ticker.localeCompare(b.asset.ticker)
}

/** Penalidade do modo "Complementar minha carteira": setor ou ativo já acima dos limites. */
function concentrationPenalty(
  asset: AssetContext,
  market: MarketOptions | undefined,
  options: AllocationOptions
): { factor: number; reason: string | null } {
  if (!market?.complementPortfolio || !market.portfolio || market.portfolio.length === 0) return { factor: 1, reason: null }
  const total = market.portfolio.reduce((sum, p) => sum + Math.max(0, p.value), 0)
  if (total <= 0) return { factor: 1, reason: null }
  const own = market.portfolio.filter((p) => p.ticker === asset.ticker).reduce((sum, p) => sum + p.value, 0) / total
  if (own >= options.maxPortfolioPct - EPS) {
    return { factor: CONCENTRATION_PENALTY, reason: `Já é ${formatPct(own)} da sua carteira (limite ${formatPct(options.maxPortfolioPct, { digits: 0 })}): prioridade reduzida à metade.` }
  }
  if (asset.sector) {
    const sectorWeight = market.portfolio.filter((p) => p.sector === asset.sector).reduce((sum, p) => sum + p.value, 0) / total
    if (sectorWeight >= market.sectorMaxPct - EPS) {
      return {
        factor: CONCENTRATION_PENALTY,
        reason: `Setor ${asset.sector} já tem ${formatPct(sectorWeight)} da sua carteira (limite ${formatPct(market.sectorMaxPct, { digits: 0 })}): prioridade reduzida à metade.`,
      }
    }
  }
  return { factor: 1, reason: null }
}

function score(evaluations: Evaluation[], options: AllocationOptions, market?: MarketOptions): Scored[] {
  const maxGap = Math.max(0, ...evaluations.map((e) => e.targetGap ?? 0))
  const useTargets = options.respectTargets && maxGap > EPS
  const weights = activeWeights(options.weights, useTargets)
  return evaluations.map((e) => {
    const valuation = e.discount === null ? 0 : clamp01((e.discount - VALUATION_FLOOR) / (FULL_DISCOUNT - VALUATION_FLOOR))
    const quality = clamp01((e.asset.qualityScore ?? 0) / 100)
    const targetGap = useTargets && e.targetGap !== null ? clamp01(e.targetGap / maxGap) : 0
    const penalty = concentrationPenalty(e.asset, market, options)
    const priority = (weights.valuation * valuation + weights.quality * quality + weights.targetGap * targetGap) * penalty.factor
    return {
      ...e,
      extraReasons: penalty.reason ? [penalty.reason] : [],
      components: {
        discount: e.discount,
        modelMargins: e.modelMargins,
        qualityScore: options.revealQuality ? e.asset.qualityScore : null,
        liquidity: e.asset.liquidity,
        targetGap: e.targetGap,
        normalized: { valuation, quality, targetGap },
        penalty: penalty.factor,
        priority,
      },
    }
  })
}

function lotOf(asset: AssetContext, options: AllocationOptions): number {
  return !options.allowFractional && asset.assetType === 'stock' ? STANDARD_LOT : 1
}

/** Motivos do ativo elegível, todos com números. */
function reasonsFor(s: Scored, options: AllocationOptions, portfolioValue: number): string[] {
  const reasons: string[] = []
  const entries = (Object.entries(s.modelMargins) as [FairValueModelId, number][]).sort((a, b) => b[1] - a[1])
  if (entries.length > 0) reasons.push(describeMargin(entries[0][0], entries[0][1]))
  else reasons.push('Sem preço justo nos modelos escolhidos: prioridade pela distância até o peso-alvo')
  if (entries.length > 1 && s.discount !== null) {
    reasons.push(
      s.discount >= 0
        ? `Desconto mediano de ${formatPct(s.discount)} em ${entries.length} modelos`
        : `Mediana de ${entries.length} modelos: ${formatPct(Math.abs(s.discount))} acima do valor estimado`
    )
  }
  if (s.asset.qualityScore !== null) {
    if (options.revealQuality) {
      const coverage = s.asset.coverage ? ` (${s.asset.coverage.used} de ${s.asset.coverage.total} critérios)` : ''
      reasons.push(`Nota de qualidade ${formatNumber(s.asset.qualityScore, { digits: 0 })}/100${coverage}`)
    } else {
      reasons.push(`Nota de qualidade acima do mínimo de ${options.minQualityScore} (nota completa no Premium)`)
    }
  }
  if (options.respectTargets && s.targetGap !== null && typeof s.asset.targetWeight === 'number' && portfolioValue > 0) {
    const current = Math.max(0, s.asset.holding?.value ?? 0) / portfolioValue
    reasons.push(`${pp(s.targetGap)} abaixo do peso-alvo (${formatPct(current)} → alvo ${formatPct(s.asset.targetWeight)})`)
  }
  reasons.push(...s.extraReasons)
  return reasons
}

interface Slot {
  s: Scored
  lot: number
  lotCost: number
  cap: number
  ideal: number
  qty: number
}

/**
 * Distribuição em quantidades inteiras respeitando: aporte, teto por ativo, teto por setor (opcional) e alvo.
 * Nunca ultrapassa o aporte.
 */
function distribute(
  selected: Scored[],
  amount: number,
  options: AllocationOptions,
  portfolioValue: number,
  sectorMaxPct: number | null
): Slot[] {
  const prioritySum = selected.reduce((sum, s) => sum + s.components.priority, 0)
  const after = portfolioValue + amount
  const slots: Slot[] = selected.map((s) => {
    const lot = lotOf(s.asset, options)
    const price = s.asset.price as number
    const held = Math.max(0, s.asset.holding?.value ?? 0)
    let cap = options.maxPerAssetPct * amount
    if (portfolioValue > 0) {
      const concentration = Math.max(options.maxPortfolioPct, options.respectTargets ? s.asset.targetWeight ?? 0 : 0)
      cap = Math.min(cap, Math.max(0, concentration * after - held))
    }
    if (options.respectTargets && typeof s.asset.targetWeight === 'number' && s.asset.targetWeight > 0) {
      cap = Math.min(cap, Math.max(0, s.asset.targetWeight * after - held))
    }
    const share = prioritySum > EPS ? s.components.priority / prioritySum : 1 / selected.length
    return { s, lot, lotCost: lot * price, cap, ideal: amount * share, qty: 0 }
  })

  let remaining = amount
  const sectorSpent = new Map<string, number>()
  const sectorRoom = (slot: Slot) =>
    sectorMaxPct === null || !slot.s.asset.sector ? Infinity : sectorMaxPct * amount - (sectorSpent.get(slot.s.asset.sector) ?? 0)
  const valueOf = (slot: Slot) => slot.qty * (slot.s.asset.price as number)
  const add = (slot: Slot, lots: number) => {
    if (lots <= 0) return
    const cost = lots * slot.lotCost
    slot.qty += lots * slot.lot
    remaining = round2(remaining - cost)
    if (slot.s.asset.sector) sectorSpent.set(slot.s.asset.sector, (sectorSpent.get(slot.s.asset.sector) ?? 0) + cost)
  }
  const maxLots = (slot: Slot, budget: number) =>
    Math.floor((Math.min(budget, remaining, slot.cap - valueOf(slot), sectorRoom(slot)) + EPS) / slot.lotCost)

  // 1) Parte proporcional à prioridade.
  for (const slot of slots) add(slot, Math.max(0, maxLots(slot, slot.ideal)))

  // 2) Um lote por vez para quem ficou mais longe da própria parte.
  for (;;) {
    const fits = slots.filter((slot) => slot.ideal - valueOf(slot) > EPS && maxLots(slot, Infinity) >= 1)
    if (fits.length === 0) break
    fits.sort((a, b) => b.ideal - valueOf(b) - (a.ideal - valueOf(a)) || compareScored(a.s, b.s))
    add(fits[0], 1)
  }

  // 3) Sobra: na ordem de prioridade, até os limites de cada ativo.
  for (const slot of slots) add(slot, Math.max(0, maxLots(slot, Infinity)))

  return slots
}

/** Ativos barrados nos filtros, em ordem de ticker (resultado independente da ordem de entrada). */
function excludedByGate(evaluations: readonly Evaluation[]): ExcludedRow[] {
  return evaluations
    .filter((e) => e.gate !== null)
    .map((e): ExcludedRow => ({ ticker: e.asset.ticker, name: e.asset.name, gate: e.gate ?? 'selection', reasons: e.reasons }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

function buildResult(
  amount: number,
  slots: Slot[],
  excluded: ExcludedRow[],
  options: AllocationOptions,
  meta: AllocationMeta,
  portfolioValue: number,
  market?: MarketOptions
): AllocationResult {
  const allocations: AllocationRow[] = []
  const notBought: ExcludedRow[] = []
  for (const slot of slots) {
    const price = slot.s.asset.price as number
    if (slot.qty === 0) {
      const reason =
        slot.lotCost > amount
          ? `${slot.lot > 1 ? `Um lote de ${slot.lot} ações` : 'Uma unidade'} custa ${formatBRL(slot.lotCost)}, acima do aporte.`
          : slot.cap < slot.lotCost
            ? `O limite por ativo (${formatBRL(slot.cap)}) não comporta ${slot.lot > 1 ? 'um lote' : 'uma unidade'} de ${formatBRL(slot.lotCost)}.`
            : `Prioridade ${formatNumber(slot.s.components.priority * 100, { digits: 0 })}: o aporte acabou nos ativos de prioridade maior.`
      notBought.push({ ticker: slot.s.asset.ticker, name: slot.s.asset.name, gate: 'amount', reasons: [reason] })
      continue
    }
    const value = round2(slot.qty * price)
    allocations.push({
      ticker: slot.s.asset.ticker,
      name: slot.s.asset.name,
      assetType: slot.s.asset.assetType,
      sector: slot.s.asset.sector,
      qty: slot.qty,
      price,
      value,
      pctOfAmount: value / amount,
      reasons: reasonsFor(slot.s, options, portfolioValue),
      components: slot.s.components,
    })
  }
  allocations.sort((a, b) => b.value - a.value || a.ticker.localeCompare(b.ticker))
  const totalAllocated = round2(allocations.reduce((sum, a) => sum + a.value, 0))
  return {
    amount,
    allocations,
    excluded: [...notBought, ...excluded],
    totalAllocated,
    leftover: round2(amount - totalAllocated),
    assumptions: {
      models: options.models,
      weights: activeWeights(options.weights, options.respectTargets),
      caps: {
        maxPerAssetPct: options.maxPerAssetPct,
        maxPortfolioPct: portfolioValue > 0 ? options.maxPortfolioPct : null,
        ...(market ? { sectorMaxAssets: market.sectorMaxAssets, sectorMaxPct: market.sectorMaxPct } : {}),
      },
      allowFractional: options.allowFractional,
      respectTargets: options.respectTargets,
      minQualityScore: options.minQualityScore,
      dataDate: meta.dataDate,
      macro: meta.macro,
    },
  }
}

function dedupe(assets: readonly AssetContext[]): AssetContext[] {
  const seen = new Set<string>()
  return assets.filter((a) => {
    const key = a.ticker.toUpperCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Distribuição de um aporte entre os ativos informados (tickers digitados, carteira ou radar). */
export function runAllocation(input: {
  amount: number
  assets: readonly AssetContext[]
  options: AllocationOptions
  meta: AllocationMeta
}): AllocationResult {
  const { amount, options, meta } = input
  const assets = dedupe(input.assets)
  const portfolioValue = portfolioValueOf(assets)
  const evaluations = assets.map((a) => evaluate(a, options, portfolioValue))
  const excluded = excludedByGate(evaluations)
  const eligible = score(evaluations.filter((e) => e.gate === null), options).sort(compareScored)
  const slots = amount > 0 && eligible.length > 0 ? distribute(eligible, amount, options, portfolioValue, null) : []
  return buildResult(amount, slots, excluded, options, meta, portfolioValue)
}

const FUNNEL: { gates: (GateId | null)[]; label: string }[] = [
  { gates: ['type', 'price'], label: 'com modelo aplicável e cotação' },
  { gates: ['liquidity'], label: 'com liquidez' },
  { gates: ['coverage'], label: 'com dados suficientes' },
  { gates: ['quality'], label: 'com qualidade' },
  { gates: ['fundamentals'], label: 'com fundamentos preservados' },
  { gates: ['valuation'], label: 'abaixo do valor estimado em ao menos um modelo' },
]

function funnelOf(evaluations: Evaluation[]): FunnelStep[] {
  const steps: FunnelStep[] = [{ label: 'ativos avaliados', count: evaluations.length }]
  let remaining = evaluations.length
  for (const step of FUNNEL) {
    remaining -= evaluations.filter((e) => e.gate !== null && step.gates.includes(e.gate)).length
    steps.push({ label: step.label, count: remaining })
  }
  return steps
}

/**
 * Modo "Todo o mercado": filtros sobre o universo da plataforma → prioridade → seleção com diversificação
 * (N ativos, máximo por setor, penalidade de concentração) → distribuição em quantidades inteiras.
 */
export function runMarketAllocation(input: {
  amount: number
  assets: readonly AssetContext[]
  options: AllocationOptions
  market: MarketOptions
  meta: AllocationMeta
  excludeTickers?: readonly string[]
}): AllocationResult {
  const { amount, options, market, meta } = input
  const exclude = new Set((input.excludeTickers ?? []).map((t) => t.toUpperCase()))
  const assets = dedupe(input.assets).filter((a) => !exclude.has(a.ticker.toUpperCase()))
  const marketOptions: AllocationOptions = { ...options, respectTargets: false }
  const evaluations = assets.map((a) => evaluate(a, marketOptions, 0))
  const ranked = score(evaluations.filter((e) => e.gate === null), marketOptions, market).sort(compareScored)

  const maxAssets = Math.max(1, Math.min(10, Math.round(market.maxAssets)))
  const selected: Scored[] = []
  const notes = new Map<string, { status: CandidateRow['status']; note: string }>()
  const perSector = new Map<string, number>()
  for (const s of ranked) {
    const sector = s.asset.sector ?? s.asset.ticker
    const count = perSector.get(sector) ?? 0
    if (selected.length >= maxAssets) {
      const last = selected[selected.length - 1]
      notes.set(s.asset.ticker, {
        status: 'lower-priority',
        note: `Prioridade ${formatNumber(s.components.priority * 100, { digits: 0 })}, menor que a do ${maxAssets}º selecionado (${formatNumber(last.components.priority * 100, { digits: 0 })}).`,
      })
      continue
    }
    if (count >= market.sectorMaxAssets) {
      notes.set(s.asset.ticker, {
        status: 'sector-limit',
        note: `Limite de ${market.sectorMaxAssets} ${market.sectorMaxAssets === 1 ? 'ativo' : 'ativos'} por setor atingido (${s.asset.sector ?? 'sem setor'}).`,
      })
      continue
    }
    perSector.set(sector, count + 1)
    selected.push(s)
    notes.set(s.asset.ticker, { status: 'selected', note: 'Selecionado para a distribuição.' })
  }

  const slots = amount > 0 && selected.length > 0 ? distribute(selected, amount, marketOptions, 0, market.sectorMaxPct) : []
  for (const slot of slots) {
    if (slot.qty === 0) notes.set(slot.s.asset.ticker, { status: 'no-shares', note: 'Selecionado, mas o valor não comportou nenhuma unidade.' })
  }

  const gateRows = excludedByGate(evaluations)
  const result = buildResult(amount, slots, gateRows, marketOptions, meta, 0, market)
  // Fora da distribuição pelo limite de setor ou pela prioridade (só os não selecionados; os filtros já estão em excluded).
  const notSelected: ExcludedRow[] = ranked
    .filter((s) => !selected.includes(s))
    .map((s) => ({ ticker: s.asset.ticker, name: s.asset.name, gate: 'selection', reasons: [notes.get(s.asset.ticker)?.note ?? ''] }))

  return {
    ...result,
    excluded: [...result.excluded.filter((e) => e.gate === 'amount'), ...notSelected, ...gateRows],
    candidates: ranked.slice(0, MARKET_CANDIDATES_SHOWN).map((s, index) => ({
      rank: index + 1,
      ticker: s.asset.ticker,
      name: s.asset.name,
      sector: s.asset.sector,
      status: notes.get(s.asset.ticker)?.status ?? 'lower-priority',
      note: notes.get(s.asset.ticker)?.note ?? '',
      components: s.components,
    })),
    funnel: funnelOf(evaluations),
  }
}

/**
 * Versão bloqueada para quem não tem acesso: mantém a forma e as contagens reais (prévia desfocada),
 * sem revelar ativos, quantidades nem motivos.
 */
export function maskResult(result: AllocationResult, { hideTickers }: { hideTickers: boolean }): AllocationResult {
  const mask = (ticker: string, index: number) => (hideTickers ? `ATIVO${index + 1}` : ticker)
  const emptyComponents = (c: PriorityComponents): PriorityComponents => ({
    ...c,
    discount: null,
    modelMargins: {},
    qualityScore: null,
    liquidity: null,
    targetGap: null,
    normalized: { valuation: 0, quality: 0, targetGap: 0 },
    priority: 0,
  })
  return {
    ...result,
    allocations: result.allocations.map((a, i) => ({
      ...a,
      ticker: mask(a.ticker, i),
      name: hideTickers ? '' : a.name,
      sector: hideTickers ? null : a.sector,
      qty: 0,
      price: 0,
      value: 0,
      pctOfAmount: 0,
      reasons: [],
      components: emptyComponents(a.components),
    })),
    excluded: hideTickers ? [] : result.excluded.map((e) => ({ ...e, gate: 'selection' as const, reasons: [] })),
    totalAllocated: 0,
    leftover: 0,
    candidates: result.candidates?.map((c, i) => ({
      ...c,
      ticker: mask(c.ticker, i),
      name: '',
      sector: null,
      note: '',
      components: emptyComponents(c.components),
    })),
  }
}
