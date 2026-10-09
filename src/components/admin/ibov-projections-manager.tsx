'use client'

/**
 * Admin: estado das faixas estatísticas do Ibovespa e registros diários salvos.
 * "Recalcular agora" refaz o cálculo determinístico e grava o registro do dia; não chama IA.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'

import { getAdminIbovState, recomputeIbovProjections, type AdminIbovState } from '@/app/actions/ibov-projection'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Stat } from '@/components/ui/stat'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatNumber } from '@/lib/format'
import type { ProjectionSnapshotRow } from '@/lib/ibov-projections/service'

const PERIOD_LABEL: Record<string, string> = { DAILY: 'Diária', WEEKLY: '1 semana', MONTHLY: '1 mês', ANNUAL: '12 meses' }

const COLUMNS: DataTableColumn<ProjectionSnapshotRow>[] = [
  { key: 'period', header: 'Horizonte', sticky: true, cell: (row) => PERIOD_LABEL[row.period] ?? row.period },
  { key: 'median', header: 'Mediana (pts)', align: 'right', cell: (row) => formatNumber(row.median, { digits: 0 }) },
  {
    key: 'lastCloseDate',
    header: 'Fechamento base',
    cell: (row) => (row.lastCloseDate ? formatDate(`${row.lastCloseDate}T12:00:00Z`) : '—'),
  },
  { key: 'createdAt', header: 'Gravado em', cell: (row) => formatDate(row.createdAt, { style: 'datetime' }) },
  {
    key: 'isCurrentMethod',
    header: 'Método',
    cell: (row) =>
      row.isCurrentMethod ? <Badge variant="brand">Estatístico</Badge> : <Badge variant="neutral">Antigo (IA, ignorado)</Badge>,
  },
  { key: 'hasCommentary', header: 'Comentário', cell: (row) => (row.hasCommentary ? 'Sim' : 'Não') },
]

export function IbovProjectionsManager() {
  const [state, setState] = useState<AdminIbovState | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setState(await getAdminIbovState())
    } catch (error) {
      toast({ title: 'Erro ao carregar', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const recompute = async () => {
    setRecomputing(true)
    try {
      const result = await recomputeIbovProjections()
      toast({
        title: 'Faixas recalculadas',
        description: `Fechamento de ${result.lastCloseDate ? formatDate(`${result.lastCloseDate}T12:00:00Z`) : '—'}; ${result.snapshots} registros gravados.`,
      })
      await load()
    } catch (error) {
      toast({ title: 'Erro ao recalcular', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projeções do Ibovespa"
        description="Faixas estatísticas calculadas a partir do histórico do índice. A página pública recalcula sozinha a cada pregão; o cron só aquece o cache e grava o registro do dia."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Projeções do Ibovespa' }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/projecoes-ibov">Ver página</Link>
            </Button>
            <Button onClick={recompute} disabled={recomputing || loading}>
              {recomputing ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              Recalcular agora
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <Stat label="Último fechamento" value={state?.lastClose ? `${formatNumber(state.lastClose, { digits: 0 })} pts` : '—'} />
        <Stat
          label="Data do fechamento"
          value={state?.lastCloseDate ? formatDate(`${state.lastCloseDate}T12:00:00Z`) : '—'}
          caption={state?.stale ? 'desatualizado' : undefined}
        />
        <Stat
          label="Cálculo em cache"
          value={state?.generatedAt ? formatDate(state.generatedAt, { style: 'datetime' }) : '—'}
          size="sm"
          className="col-span-2 sm:col-span-1"
        />
      </section>

      {state?.error && (
        <p role="alert" className="rounded-lg border border-border bg-negative-subtle p-4 text-sm text-foreground">
          Falha no cálculo: {state.error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Registros salvos</h2>
        <DataTable
          columns={COLUMNS}
          rows={state?.snapshots ?? []}
          getRowId={(row) => row.id}
          loading={loading}
          stickyFirstColumn
          caption="Últimos registros de projeções do Ibovespa"
          empty={{ title: 'Nenhum registro salvo', description: 'Use "Recalcular agora" ou aguarde o cron.' }}
        />
      </section>
    </div>
  )
}
