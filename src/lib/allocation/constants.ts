/**
 * Padrões, presets e rótulos do "Onde aportar". Puro: pode ser importado no cliente.
 */

import type {
  AllocationAssetType,
  AllocationOptions,
  AllocationPresetId,
  AllocationWeights,
  FairValueModelId,
  MarketOptions,
} from './types'

export const ALLOCATION_MODEL_LABEL: Record<FairValueModelId, string> = {
  graham: 'Graham',
  fcd: 'FCD',
  gordon: 'Gordon',
  bazin: 'Bazin',
  bankPvp: 'P/VP justo',
  fiiCeiling: 'Preço-teto FII',
}

/** Como o modelo aparece nos motivos: "22,4% abaixo do preço-teto (Bazin)". */
export const ALLOCATION_MODEL_TARGET: Record<FairValueModelId, string> = {
  graham: 'do preço justo (Graham)',
  fcd: 'do valor estimado (FCD)',
  gordon: 'do preço justo (Gordon)',
  bazin: 'do preço-teto (Bazin)',
  bankPvp: 'do P/VP justo',
  fiiCeiling: 'do preço-teto do FII',
}

/** Modelos de cada tipo de ativo, na ordem exibida. ETFs e BDRs não têm modelo de preço justo aplicável. */
export const MODELS_BY_ASSET_TYPE: Record<AllocationAssetType, FairValueModelId[]> = {
  stock: ['graham', 'fcd', 'gordon', 'bazin', 'bankPvp'],
  fii: ['fiiCeiling'],
  etf: [],
  bdr: [],
}

export const ALL_MODELS: FairValueModelId[] = ['graham', 'fcd', 'gordon', 'bazin', 'bankPvp', 'fiiCeiling']

/** Modelos liberados sem assinatura (mesmo registro da página do ativo: só Graham é gratuito). */
export const FREE_MODELS: FairValueModelId[] = ['graham']

/** Limite de tickers para visitantes e plano gratuito. */
export const FREE_MAX_TICKERS = 3
/** Limite de tickers digitados no Premium (protege o servidor). */
export const PREMIUM_MAX_TICKERS = 40

export const MIN_AMOUNT = 10
export const MAX_AMOUNT = 10_000_000

export interface AllocationPreset {
  id: AllocationPresetId
  label: string
  description: string
  weights: AllocationWeights
}

export const ALLOCATION_PRESETS: AllocationPreset[] = [
  {
    id: 'desconto',
    label: 'Mais desconto',
    description: 'Prioriza o maior desconto em relação ao valor estimado.',
    weights: { valuation: 0.7, quality: 0.3, targetGap: 0 },
  },
  {
    id: 'equilibrio',
    label: 'Equilíbrio',
    description: 'Desconto e qualidade com o mesmo peso; com carteira, considera também os pesos-alvo.',
    weights: { valuation: 0.4, quality: 0.4, targetGap: 0.2 },
  },
  {
    id: 'pesos',
    label: 'Seguir meus pesos-alvo',
    description: 'Prioriza os ativos mais distantes do peso-alvo da sua carteira, sem passar do alvo.',
    weights: { valuation: 0.3, quality: 0.1, targetGap: 0.6 },
  },
]

export function getPreset(id: AllocationPresetId): AllocationPreset {
  return ALLOCATION_PRESETS.find((preset) => preset.id === id) ?? ALLOCATION_PRESETS[1]
}

/**
 * Faixa da margem de segurança mediana que vira o componente de valuation 0–1: −50% (preço 50% acima do valor
 * estimado) → 0; +50% de desconto → 1. Uma faixa simétrica mantém a ordem mesmo quando a mediana é negativa
 * (o ativo passa no filtro com um modelo abaixo do valor estimado, mas a mediana fica acima).
 */
export const VALUATION_FLOOR = -0.5
export const FULL_DISCOUNT = 0.5

/** Multiplicador da prioridade quando o setor ou o ativo já pesa demais na carteira (modo "Complementar"). */
export const CONCENTRATION_PENALTY = 0.5

/** Lote padrão de ações sem fracionário. */
export const STANDARD_LOT = 100

export const DEFAULT_ALLOCATION_OPTIONS: AllocationOptions = {
  models: ALL_MODELS,
  weights: getPreset('equilibrio').weights,
  maxPerAssetPct: 0.4,
  maxPortfolioPct: 0.25,
  allowFractional: true,
  minLiquidity: null,
  respectTargets: false,
  minQualityScore: 50,
  minCoverage: 0.6,
  revealQuality: true,
  strictData: true,
}

export const DEFAULT_MARKET_OPTIONS: Omit<MarketOptions, 'portfolio'> = {
  maxAssets: 5,
  sectorMaxAssets: 2,
  sectorMaxPct: 0.35,
  complementPortfolio: true,
}

/** Quantos candidatos o modo "Todo o mercado" mostra na tabela de transparência. */
export const MARKET_CANDIDATES_SHOWN = 20

export const MARKET_ASSET_TYPES: { id: AllocationAssetType; label: string }[] = [
  { id: 'stock', label: 'Ações' },
  { id: 'fii', label: 'FIIs' },
  { id: 'etf', label: 'ETFs' },
  { id: 'bdr', label: 'BDRs' },
]

export const ALLOCATION_DISCLAIMER =
  'Simulação baseada nos modelos quantitativos da plataforma e nos critérios definidos por você. Não é recomendação de investimento.'

export const MARKET_DISCLAIMER =
  'Resultado de modelos quantitativos aplicados a dados públicos, segundo os critérios que você definiu. Não é recomendação de investimento nem consultoria.'
