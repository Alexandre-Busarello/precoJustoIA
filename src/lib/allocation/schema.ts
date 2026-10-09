/**
 * Validação (zod) do corpo de `POST /api/allocation/simulate` e `POST /api/allocation/register`.
 */

import { z } from 'zod'
import { ALL_MODELS, MAX_AMOUNT, MIN_AMOUNT, PREMIUM_MAX_TICKERS } from './constants'

const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,7}$/, 'Ticker inválido')

const fraction = z.number().min(0).max(1)

const universeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tickers'), tickers: z.array(ticker).min(1).max(PREMIUM_MAX_TICKERS) }),
  z.object({ kind: z.literal('portfolio'), portfolioId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal('radar') }),
  z.object({
    kind: z.literal('market'),
    assetTypes: z.array(z.enum(['stock', 'fii', 'etf', 'bdr'])).min(1).max(4),
    maxAssets: z.number().int().min(1).max(10).optional(),
    sectorMaxAssets: z.number().int().min(1).max(10).optional(),
    sectorMaxPct: z.number().min(0.1).max(1).optional(),
    complementPortfolio: z.boolean().optional(),
    complementPortfolioId: z.string().min(1).max(64).nullable().optional(),
    excludeTickers: z.array(ticker).max(50).optional(),
  }),
])

export const simulateRequestSchema = z.object({
  amount: z.number().finite().min(MIN_AMOUNT).max(MAX_AMOUNT),
  universe: universeSchema,
  preset: z.enum(['desconto', 'equilibrio', 'pesos']).default('equilibrio'),
  weights: z.object({ valuation: fraction, quality: fraction, targetGap: fraction }).optional(),
  models: z.array(z.enum(['graham', 'fcd', 'gordon', 'bazin', 'bankPvp', 'fiiCeiling'])).max(ALL_MODELS.length).optional(),
  maxPerAssetPct: z.number().min(0.05).max(1).optional(),
  maxPortfolioPct: z.number().min(0.05).max(1).optional(),
  allowFractional: z.boolean().optional(),
  respectTargets: z.boolean().optional(),
})

export type SimulateRequest = z.infer<typeof simulateRequestSchema>
/** Corpo enviado pelo cliente (campos com padrão podem ser omitidos). */
export type SimulateRequestInput = z.input<typeof simulateRequestSchema>

export type SimulateUniverse = SimulateRequest['universe']
