/**
 * Vitrine de backtests: carteiras fixas, escolhidas por regra antes de olhar qualquer resultado. Aparecem sempre
 * juntas e nesta ordem, inclusive quando rendem menos que o CDI. Nada de carteira montada a partir do ranking de hoje
 * (o motor não tem fundamentos point-in-time: seria viés de olhar para trás).
 *
 * Mudar uma definição exige uma nota datada na seção /metodologia#backtest e atualizar `SHOWCASE_DEFINITIONS_SINCE`.
 */
import { EXAMPLE_INITIAL_CAPITAL, EXAMPLE_TICKERS } from '@/app/backtest/backtest-utils'

export type ShowcaseRebalance = 'monthly' | 'quarterly' | 'yearly'

export interface ShowcaseDefinition {
  id: string
  title: string
  /** Por que esta carteira (sem falar de desempenho). */
  why: string
  tickers: string[]
  initialCapital: number
  monthlyContribution: number
  rebalanceFrequency: ShowcaseRebalance
}

/** Janela padrão: últimos 5 anos completos, a mesma regra da carteira de exemplo e do backtest rápido. */
export const SHOWCASE_YEARS = 5
/** Se algum ativo tiver menos história, todas as carteiras usam a janela comum, desde que tenha ao menos 3 anos. */
export const SHOWCASE_MIN_MONTHS = 36
/** Data em que as definições abaixo passaram a valer (dia civil). */
export const SHOWCASE_DEFINITIONS_SINCE = '2026-10-09'

export const SHOWCASE_DEFINITIONS: readonly ShowcaseDefinition[] = [
  {
    id: 'ibov-aportes',
    title: 'BOVA11 com aportes mensais',
    why: 'Investir todo mês no índice, sem escolher ações.',
    tickers: ['BOVA11'],
    initialCapital: 0,
    monthlyContribution: 1_000,
    rebalanceFrequency: 'monthly',
  },
  {
    id: 'dividendos-etf',
    title: 'DIVO11 com aportes mensais',
    why: 'Um ETF de empresas pagadoras, sem escolher ações.',
    tickers: ['DIVO11'],
    initialCapital: 0,
    monthlyContribution: 1_000,
    rebalanceFrequency: 'monthly',
  },
  {
    id: 'exemplo-5-acoes',
    title: 'Carteira de exemplo com 5 ações',
    why: 'A carteira de exemplo que abre a ferramenta; não foi escolhida pelo desempenho.',
    tickers: [...EXAMPLE_TICKERS],
    initialCapital: EXAMPLE_INITIAL_CAPITAL,
    monthlyContribution: 0,
    rebalanceFrequency: 'monthly',
  },
]

/** Tag do cache da vitrine (revalidada pelo cron /api/cron/backtest-showcase). */
export const SHOWCASE_CACHE_TAG = 'backtest-showcase'
/** 7 dias, em segundos. */
export const SHOWCASE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60
