/**
 * Contexto da página para o Ben: o que o usuário está vendo, montado no cliente com a rota e os dados que a
 * página já tem (nenhum fetch extra). O servidor valida (`sanitizeBenContext`), resume (`serializeBenContext`)
 * e injeta como dica no prompt; os números da página não substituem as ferramentas.
 *
 * Unidades: preços em R$; `margin`, `weight`, `pct` e retornos em fração (0,12 = 12%); scores de 0 a 100.
 */

export type BenAssetType = 'stock' | 'bdr' | 'fii' | 'etf' | 'index'

/** Subpágina do ativo (análise técnica, relatórios, radar de dividendos). */
export type BenAssetSection = 'overview' | 'technical' | 'reports' | 'dividends'

export interface BenValuationItem {
  /** Nome curto do modelo, como na tela (ex.: "FCD"). */
  model: string
  fairValue: number | null
  /** Margem de segurança em fração: 1 − preço ÷ preço justo. */
  margin: number | null
  /** Score do modelo, 0 a 100. */
  score?: number | null
}

interface ContextBase {
  /** O item em que o usuário clicou ("Modelo FCD", "PETR4"); só vem dos pontos "Perguntar ao Ben". */
  focus?: string
}

export interface BenAssetContext extends ContextBase {
  kind: 'asset'
  ticker: string
  assetType: BenAssetType
  section?: BenAssetSection
  companyName?: string
  price?: number | null
  valuations?: BenValuationItem[]
  /** Score geral, 0 a 100. */
  score?: number | null
}

export interface BenPortfolioContext extends ContextBase {
  kind: 'portfolio'
  id: string
  name?: string
  /** Maiores posições, com peso atual em fração. */
  holdings: { ticker: string; weight: number | null }[]
  holdingsCount?: number
  /** Retorno total da carteira em fração. */
  returnPct?: number | null
}

export interface BenRankingContext extends ContextBase {
  kind: 'ranking'
  model: string
  universe?: string
  /** Resumo dos parâmetros, como no painel ("Margem mínima 20% · Liquidez padrão"). */
  params?: string
  /** Até 10 primeiros tickers do resultado. */
  tickers: string[]
  resultCount?: number | null
}

export interface BenScreeningContext extends ContextBase {
  kind: 'screening'
  assetClass: 'acoes' | 'fiis'
  /** Filtros ativos em texto curto ("P/L 5 a 15"). */
  filters: string[]
  resultCount: number | null
  tickers: string[]
}

export interface BenComparadorContext extends ContextBase {
  kind: 'comparador'
  tickers: string[]
}

export interface BenAllocationContext extends ContextBase {
  kind: 'onde-aportar'
  amount: number | null
  universe?: string
  allocations: { ticker: string; value: number; pct: number | null }[]
  leftover?: number | null
}

export interface BenBacktestContext extends ContextBase {
  kind: 'backtest'
  /** Resumo da configuração ("PETR4 50%, VALE3 50% · 2020 a 2025 · aporte mensal R$ 1.000"). */
  config?: string
  totalReturn?: number | null
  cdiReturn?: number | null
  ibovReturn?: number | null
}

export interface BenAgendaContext extends ContextBase {
  kind: 'agenda'
  /** Próximos eventos; data em YYYY-MM-DD. */
  events: { ticker: string; type: string; date: string; amount?: number | null }[]
}

export interface BenAlertsContext extends ContextBase {
  kind: 'alerts'
  /** Alerta em que o usuário clicou. */
  alert?: { ticker: string; conditions: string[]; lastTriggeredAt?: string | null; active?: boolean }
}

export interface BenDashboardContext extends ContextBase {
  kind: 'dashboard'
}

export interface BenGenericContext extends ContextBase {
  kind: 'generic'
  path: string
}

export type BenPageContext =
  | BenAssetContext
  | BenPortfolioContext
  | BenRankingContext
  | BenScreeningContext
  | BenComparadorContext
  | BenAllocationContext
  | BenBacktestContext
  | BenAgendaContext
  | BenAlertsContext
  | BenDashboardContext
  | BenGenericContext

export type BenContextKind = BenPageContext['kind']

/** Limite do contexto serializado que vai para o prompt. */
export const BEN_CONTEXT_MAX_CHARS = 1500
