/**
 * Formato devolvido pela API de faixas do Ibovespa. Sem dependências de servidor: pode ser importado no cliente.
 */

import type { IbovProjectionCore } from './engine'

export type { ConePoint, HorizonId, HorizonProjection, IbovProjectionCore, Quantiles } from './engine'

export interface MacroRate {
  /** Fração ao ano (0,15 = 15% a.a.). */
  value: number
  asOf: string
  /** 'fallback' quando o valor é a premissa padrão, sem dado recente no banco. */
  source: 'db' | 'fallback'
}

export interface PlBolsaContext {
  /** P/L agregado da bolsa no mês mais recente. */
  current: number
  /** Média histórica do P/L no período. */
  average: number
  /** Fração dos meses da série com P/L menor ou igual ao atual (0,8 = percentil 80). */
  percentileRank: number
  asOf: string
  since: string
  samples: number
}

export interface MarketContext {
  plBolsa: PlBolsaContext | null
  selic: MacroRate | null
  cdi: MacroRate | null
}

export interface IbovCommentary {
  text: string
  generatedAt: string
}

export interface IbovProjectionReport extends IbovProjectionCore {
  context: MarketContext
  commentary: IbovCommentary | null
  /** Momento do cálculo (ISO). */
  generatedAt: string
  /** Data de referência do cálculo (YYYY-MM-DD, Brasília). */
  referenceDate: string
}
