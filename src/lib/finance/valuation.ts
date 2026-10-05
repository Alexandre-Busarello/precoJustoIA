/**
 * Matemática de valuation, pura e sem I/O. Taxas sempre em fração (0,15 = 15%).
 * Referência: docs/melhorias-2026-09/reports/mercado-financeiro.md §3.1, §3.2, §3.4, §3.13 e §3.15.
 */

import { isFiniteNumber, isPositiveNumber, roundTo } from './utils'

export { marginOfSafety, upside } from '@/lib/valuation-metrics'

/** Spread mínimo exigido entre taxa de desconto e crescimento perpétuo (4 p.p.). Abaixo disso o valor explode. */
export const MIN_DISCOUNT_GROWTH_SPREAD = 0.04

/** Tolerância para comparar spreads (0,15 − 0,11 dá 0,03999… em ponto flutuante). */
const SPREAD_EPSILON = 1e-9

function hasMinSpread(k: number, g: number, minSpread: number): boolean {
  return k - g >= minSpread - SPREAD_EPSILON
}

export interface EquityBridge {
  /** Valor da firma (EV) estimado pelo modelo. */
  ev: number
  /** Dívida líquida (dívida total − caixa); negativa quando há caixa líquido. */
  netDebt: number
  /** Valor para o acionista = EV − dívida líquida. */
  equity: number
}

/** Valor do acionista a partir do EV: `ev − (totalDebt − cash)`. Caixa ausente conta como 0 (conservador). */
export function equityFromEV(ev: number, totalDebt: number, cash: number | null | undefined = 0): number | null {
  if (!isFiniteNumber(ev) || !isFiniteNumber(totalDebt)) return null
  return ev - (totalDebt - (isFiniteNumber(cash) ? cash : 0))
}

/** Dívida líquida implícita no mercado: `enterpriseValue − marketCap` (fallback quando não há dívida/caixa do balanço). */
export function netDebtFromMarket(enterpriseValue: number | null | undefined, marketCap: number | null | undefined): number | null {
  if (!isFiniteNumber(enterpriseValue) || !isPositiveNumber(marketCap)) return null
  return enterpriseValue - marketCap
}

export interface EquityBridgeInput {
  /** EV estimado pelo modelo (ex.: FCFF descontado pelo WACC). */
  ev: number
  totalDebt?: number | null
  cash?: number | null
  /** `FinancialData.enterpriseValue` de mercado, usado no fallback. */
  enterpriseValue?: number | null
  /** `FinancialData.marketCap`, usado no fallback. */
  marketCap?: number | null
}

/**
 * Ponte EV → Equity. Usa `totalDebt − cash` do balanço; sem dívida informada, cai para `enterpriseValue − marketCap`.
 * `null` quando nenhuma das duas fontes está disponível (não assume dívida zero).
 */
export function equityBridge(input: EquityBridgeInput): EquityBridge | null {
  if (!isFiniteNumber(input.ev)) return null
  let netDebt: number | null = null
  if (isFiniteNumber(input.totalDebt)) {
    netDebt = input.totalDebt - (isFiniteNumber(input.cash) ? input.cash : 0)
  } else {
    netDebt = netDebtFromMarket(input.enterpriseValue, input.marketCap)
  }
  if (netDebt === null) return null
  return { ev: input.ev, netDebt, equity: input.ev - netDebt }
}

/** Valor por ação. `null` sem número de ações válido. */
export function perShare(value: number | null | undefined, shares: number | null | undefined): number | null {
  if (!isFiniteNumber(value) || !isPositiveNumber(shares)) return null
  return value / shares
}

export interface GordonInput {
  /** Proventos dos últimos 12 meses por ação (D0), idealmente `sumTTM` sem extraordinários. */
  d0: number
  /** Crescimento perpétuo nominal. */
  g: number
  /** Custo de capital próprio (Ke) nominal. */
  k: number
  /** Spread mínimo k − g. Padrão: 4 p.p. */
  minSpread?: number
}

/** Modelo de Gordon: `D1 / (k − g)` com `D1 = D0 × (1 + g)`. `null` quando `k − g < minSpread` ou D0 ≤ 0. */
export function gordonValue({ d0, g, k, minSpread = MIN_DISCOUNT_GROWTH_SPREAD }: GordonInput): number | null {
  if (!isPositiveNumber(d0) || !isFiniteNumber(g) || !isFiniteNumber(k)) return null
  if (!hasMinSpread(k, g, minSpread)) return null
  return (d0 * (1 + g)) / (k - g)
}

export interface FairPvpInput {
  roe: number
  g: number
  ke: number
  minSpread?: number
}

/**
 * P/VP justo (lucro residual em perpetuidade): `(ROE − g) / (Ke − g)`. Para bancos e seguradoras.
 * `null` quando `Ke − g < minSpread` ou quando ROE ≤ g (resultado sem significado).
 */
export function fairPVP({ roe, g, ke, minSpread = MIN_DISCOUNT_GROWTH_SPREAD }: FairPvpInput): number | null {
  if (!isFiniteNumber(roe) || !isFiniteNumber(g) || !isFiniteNumber(ke)) return null
  if (!hasMinSpread(ke, g, minSpread) || roe <= g) return null
  return (roe - g) / (ke - g)
}

/** Valor justo de financeiras: `VPA × P/VP justo`. */
export function bankFairValue(vpa: number, roe: number, g: number, ke: number): number | null {
  if (!isPositiveNumber(vpa)) return null
  const pvp = fairPVP({ roe, g, ke })
  return pvp === null ? null : vpa * pvp
}

/** PEG de Lynch: `P/L ÷ (g × 100)`, com g em fração. `null` com P/L ou crescimento ≤ 0. */
export function peg(pl: number, gFraction: number): number | null {
  if (!isPositiveNumber(pl) || !isPositiveNumber(gFraction)) return null
  return roundTo(pl / (gFraction * 100), 10)
}

/** P/L justo de Lynch: crescimento + dividend yield, ambos em pontos percentuais (0,15 e 0,04 → 19). */
export function lynchFairPE(gFraction: number, dyFraction: number): number | null {
  if (!isFiniteNumber(gFraction) || !isFiniteNumber(dyFraction)) return null
  const value = roundTo((gFraction + dyFraction) * 100, 10)
  return value > 0 ? value : null
}

/** Preço-teto por dividend yield alvo (Bazin, Barsi, FIIs): `proventos anuais ÷ DY alvo`. */
export function ceilingPrice(annualDividends: number | null | undefined, targetYield: number): number | null {
  if (!isPositiveNumber(annualDividends) || !isPositiveNumber(targetYield)) return null
  return roundTo(annualDividends / targetYield, 10)
}

export interface MagicFormulaInput {
  id: string | number
  /** Retorno sobre o capital (fração). */
  roic: number | null | undefined
  /** EV/EBIT; o earnings yield usado é 1 / evEbit. */
  evEbit: number | null | undefined
}

export type MagicFormulaResult<T extends MagicFormulaInput> = T & {
  earningsYield: number
  roicRank: number
  eyRank: number
  /** Soma das posições (menor é melhor). */
  combinedRank: number
  /** Posição final, começando em 1. */
  position: number
}

/** Posição com empates dividindo a mesma posição (ranking "1-2-2-4"). */
function rankDescending(values: readonly number[]): number[] {
  return values.map((v) => 1 + values.filter((other) => other > v).length)
}

/**
 * Fórmula Mágica (Greenblatt): posição por ROIC (desc) + posição por EY = EBIT/EV (desc), ordenado pela soma crescente.
 * Ignora itens com ROIC ausente ou ≤ 0 e com EV/EBIT ausente ou ≤ 0 (earnings yield não positivo). Desempate: maior EY, depois maior ROIC, depois `id`.
 * A exclusão de financeiras, utilities e ativos ilíquidos é responsabilidade de quem chama.
 */
export function magicFormulaRank<T extends MagicFormulaInput>(items: readonly T[]): MagicFormulaResult<T>[] {
  const eligible = items.filter(
    (item): item is T & { roic: number; evEbit: number } => isPositiveNumber(item.roic) && isPositiveNumber(item.evEbit)
  )
  const roics = eligible.map((item) => item.roic)
  const eys = eligible.map((item) => 1 / item.evEbit)
  const roicRanks = rankDescending(roics)
  const eyRanks = rankDescending(eys)

  const scored = eligible.map((item, i) => ({
    ...item,
    earningsYield: eys[i],
    roicRank: roicRanks[i],
    eyRank: eyRanks[i],
    combinedRank: roicRanks[i] + eyRanks[i],
  }))

  scored.sort(
    (a, b) =>
      a.combinedRank - b.combinedRank ||
      b.earningsYield - a.earningsYield ||
      b.roic - a.roic ||
      String(a.id).localeCompare(String(b.id))
  )

  return scored.map((item, i) => ({ ...item, position: i + 1 }))
}
