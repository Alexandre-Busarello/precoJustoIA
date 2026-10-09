/**
 * Tipos do "Onde aportar": distribuição simulada de um aporte entre ativos, segundo os critérios do usuário.
 * Todos os percentuais são frações (0,25 = 25%) e os valores monetários estão em R$.
 */

export type AllocationAssetType = 'stock' | 'fii' | 'etf' | 'bdr'

/** Modelos com preço justo usados na distribuição. Peter Lynch e Barsi não entram (sem preço-alvo próprio). */
export type FairValueModelId = 'graham' | 'fcd' | 'gordon' | 'bazin' | 'bankPvp' | 'fiiCeiling'

export type AllocationPresetId = 'desconto' | 'equilibrio' | 'pesos'

/** Pesos dos componentes da prioridade (somam 1 entre os componentes ativos). */
export interface AllocationWeights {
  valuation: number
  quality: number
  targetGap: number
}

export interface DataCoverage {
  used: number
  total: number
}

/** Situação dos fundamentos: `intact` null quando a checagem não se aplica (FIIs). */
export interface FundamentalsStatus {
  intact: boolean | null
  /** `true` quando faltou histórico para checar (sem benefício da dúvida). */
  insufficient?: boolean
  /** Motivo curto do primeiro critério reprovado, ou do dado faltante. */
  detail?: string
}

/** Tudo que o motor precisa saber de um ativo; carregado no servidor pelo mesmo caminho da página do ativo. */
export interface AssetContext {
  ticker: string
  name: string
  assetType: AllocationAssetType
  sector: string | null
  /** Cotação mais recente (R$), ou null sem cotação. */
  price: number | null
  /** Preço justo por modelo (R$). Ausente/null quando o modelo não se aplica ou falta dado. */
  fairValues: Partial<Record<FairValueModelId, number | null>>
  /** Margem de segurança informada pelo modelo (1 − P/VJ), quando ele a calcula de outro jeito; senão é derivada. */
  margins?: Partial<Record<FairValueModelId, number | null>>
  /** Nota de qualidade 0–100 (Score geral de ações ou Score PJ-FII). */
  qualityScore: number | null
  /** Critérios com dado disponível na nota (ações). null quando a nota não informa cobertura. */
  coverage: DataCoverage | null
  /** Volume financeiro médio diário (R$/dia). */
  liquidity: number | null
  fundamentals: FundamentalsStatus
  /** Posição atual (quando o universo é uma carteira). */
  holding?: { quantity: number; value: number } | null
  /** Peso-alvo na carteira (fração), quando definido. */
  targetWeight?: number | null
}

export interface AllocationOptions {
  /** Modelos escolhidos; cada ativo usa os que se aplicam a ele. */
  models: FairValueModelId[]
  weights: AllocationWeights
  /** Máximo por ativo, em fração do aporte. Padrão 0,40. */
  maxPerAssetPct: number
  /** Máximo por ativo, em fração da carteira depois do aporte (só com carteira existente). Padrão 0,25. */
  maxPortfolioPct: number
  /** Fracionário (B3): quantidade inteira ≥ 1. Sem fracionário, ações em lotes de 100. */
  allowFractional: boolean
  /** Liquidez mínima (R$/dia) para todos os tipos; null usa o padrão por tipo. */
  minLiquidity: number | null
  /** Segue os pesos-alvo: só compra o que está abaixo do alvo e até atingi-lo. */
  respectTargets: boolean
  /** Nota de qualidade mínima (0–100). */
  minQualityScore: number
  /** Cobertura mínima de critérios da nota (fração). */
  minCoverage: number
  /** Exibe a nota de qualidade nos motivos (a nota completa é do Premium). */
  revealQuality: boolean
  /**
   * `true` (padrão): dado ausente exclui o ativo (sem benefício da dúvida).
   * `false` (sugestões da carteira, que seguem os pesos do próprio usuário): só exclui com evidência contrária
   * (ilíquido, nota baixa, fundamentos em piora, acima do valor estimado em todos os modelos); ativos sem modelo
   * de preço justo (ETFs, BDRs) ou sem nota seguem pelo peso-alvo.
   */
  strictData: boolean
}

/** Opções do modo "Todo o mercado". */
export interface MarketOptions {
  /** Quantos ativos entram no aporte (1–10). */
  maxAssets: number
  /** Máximo de ativos do mesmo setor. */
  sectorMaxAssets: number
  /** Máximo do aporte no mesmo setor (fração). */
  sectorMaxPct: number
  /** Penaliza setores e ativos já pesados na carteira do usuário. */
  complementPortfolio: boolean
  /** Posições da carteira usadas no complemento (valor atual por ticker e setor). */
  portfolio?: { ticker: string; sector: string | null; value: number }[]
}

export type GateId =
  | 'type'
  | 'price'
  | 'liquidity'
  | 'coverage'
  | 'quality'
  | 'fundamentals'
  | 'valuation'
  | 'target'

export interface PriorityComponents {
  /** Mediana da margem de segurança nos modelos aplicáveis (fração). */
  discount: number | null
  /** Margem de cada modelo aplicável (fração). */
  modelMargins: Partial<Record<FairValueModelId, number>>
  qualityScore: number | null
  liquidity: number | null
  /** Distância até o peso-alvo (fração da carteira; positiva = abaixo do alvo). */
  targetGap: number | null
  /** Componentes normalizados 0–1. */
  normalized: { valuation: number; quality: number; targetGap: number }
  /** Multiplicador por concentração já existente (1 = sem penalidade). */
  penalty: number
  /** Prioridade final 0–1. */
  priority: number
}

export interface AllocationRow {
  ticker: string
  name: string
  assetType: AllocationAssetType
  sector: string | null
  qty: number
  price: number
  value: number
  pctOfAmount: number
  reasons: string[]
  components: PriorityComponents
}

export interface ExcludedRow {
  ticker: string
  name: string
  gate: GateId | 'amount' | 'selection'
  reasons: string[]
}

export type CandidateStatus = 'selected' | 'sector-limit' | 'lower-priority' | 'no-shares'

export interface CandidateRow {
  rank: number
  ticker: string
  name: string
  sector: string | null
  status: CandidateStatus
  note: string
  components: PriorityComponents
}

export interface FunnelStep {
  label: string
  count: number
}

export interface AllocationAssumptions {
  models: FairValueModelId[]
  weights: AllocationWeights
  caps: { maxPerAssetPct: number; maxPortfolioPct: number | null; sectorMaxAssets?: number; sectorMaxPct?: number }
  allowFractional: boolean
  respectTargets: boolean
  minQualityScore: number
  dataDate: string | null
  macro: { selic: number | null; ke: number | null }
}

export interface AllocationResult {
  amount: number
  allocations: AllocationRow[]
  excluded: ExcludedRow[]
  totalAllocated: number
  leftover: number
  assumptions: AllocationAssumptions
  /** Modo "Todo o mercado": ranking dos 20 primeiros candidatos e contagem por etapa. */
  candidates?: CandidateRow[]
  funnel?: FunnelStep[]
}

export interface AllocationMeta {
  dataDate: string | null
  macro: { selic: number | null; ke: number | null }
}
