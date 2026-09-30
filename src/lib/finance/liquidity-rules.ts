/**
 * Regras de liquidez puras (sem banco), seguras para importar em qualquer lugar, inclusive em componentes cliente.
 * O cálculo do volume financeiro médio fica em `./liquidity` (somente servidor).
 */

export type LiquidityAssetType = 'stock' | 'fii' | 'bdr'

/**
 * Volume financeiro médio diário mínimo (R$/dia) por tipo de ativo.
 * Ações: R$ 1 mi; FIIs: R$ 500 mil; BDRs: R$ 200 mil (BDRs são naturalmente pouco negociados: prefira alertar a excluir).
 */
export const LIQUIDITY_DEFAULTS: Readonly<Record<LiquidityAssetType, number>> = {
  stock: 1_000_000,
  fii: 500_000,
  bdr: 200_000,
}

/**
 * Normaliza o tipo do ativo: aceita os valores de `LiquidityAssetType` e os do enum Prisma `AssetType`
 * ('STOCK', 'FII', 'BDR'; 'ETF' e demais usam o limite de ações).
 */
export function toLiquidityAssetType(assetType: string | null | undefined): LiquidityAssetType {
  const t = (assetType ?? '').toLowerCase()
  if (t === 'fii') return 'fii'
  if (t === 'bdr') return 'bdr'
  return 'stock'
}

/**
 * `true` quando o volume médio diário (R$) fica abaixo do limite do tipo de ativo (ou de `threshold`, se informado).
 * Volume ausente ou inválido conta como ilíquido: sem dado, não há benefício da dúvida.
 */
export function isIlliquid(
  averageDailyTradedValue: number | null | undefined,
  assetType: LiquidityAssetType | string | null | undefined,
  threshold?: number
): boolean {
  if (typeof averageDailyTradedValue !== 'number' || !Number.isFinite(averageDailyTradedValue)) return true
  const limit = threshold ?? LIQUIDITY_DEFAULTS[toLiquidityAssetType(assetType)]
  return averageDailyTradedValue < limit
}
