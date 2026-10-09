'use server'

/**
 * Server Actions das faixas estatísticas do Ibovespa.
 */

import { requireAdminUser } from '@/lib/user-service'
import {
  getIbovProjectionReport,
  listProjectionSnapshots,
  warmIbovProjections,
  type ProjectionSnapshotRow,
  type WarmUpResult,
} from '@/lib/ibov-projections/service'
import type { HorizonId } from '@/lib/ibov-projections/types'

export interface IbovBannerSummary {
  period: HorizonId
  low: number
  high: number
  lastCloseDate: string
}

/** Faixa provável do mês para o aviso do dashboard. `null` se não houver cálculo válido e atual. */
export async function getIbovBannerSummary(): Promise<IbovBannerSummary | null> {
  try {
    const report = await getIbovProjectionReport()
    const monthly = report.horizons.find((h) => h.id === 'MONTHLY')
    if (!monthly?.levels || report.stale.isStale || !report.lastCloseDate) return null
    return { period: 'MONTHLY', low: monthly.levels.p16, high: monthly.levels.p84, lastCloseDate: report.lastCloseDate }
  } catch {
    return null
  }
}

export interface AdminIbovState {
  lastClose: number | null
  lastCloseDate: string | null
  stale: boolean
  generatedAt: string | null
  snapshots: ProjectionSnapshotRow[]
  error?: string
}

async function assertAdmin() {
  const user = await requireAdminUser()
  if (!user?.isAdmin) throw new Error('Não autorizado')
}

/** Estado atual do cálculo e últimos registros salvos (admin). */
export async function getAdminIbovState(): Promise<AdminIbovState> {
  await assertAdmin()
  const [report, snapshots] = await Promise.all([
    getIbovProjectionReport().catch((error: unknown) => (error instanceof Error ? error : new Error('Erro desconhecido'))),
    listProjectionSnapshots(),
  ])
  if (report instanceof Error) {
    return { lastClose: null, lastCloseDate: null, stale: true, generatedAt: null, snapshots, error: report.message }
  }
  return {
    lastClose: report.lastClose,
    lastCloseDate: report.lastCloseDate,
    stale: report.stale.isStale,
    generatedAt: report.generatedAt,
    snapshots,
  }
}

/** Recalcula as faixas e grava o registro do dia, sem chamar a IA (admin). */
export async function recomputeIbovProjections(): Promise<WarmUpResult> {
  await assertAdmin()
  return warmIbovProjections({ withCommentary: false })
}
