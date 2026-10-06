'use client'

/**
 * Visão diária do índice: variação de cada pregão e a contribuição de cada ativo (linha expansível).
 * Sem Premium: prévia borrada de 3 linhas e um convite para assinar.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate, formatDeltaPct, formatNumber } from '@/lib/format'
import { useAdminStatus } from '@/hooks/use-admin-status'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'

interface DailyViewData {
  date: string
  points: number
  /** Variação do dia, em pontos percentuais. */
  dailyChange: number
  /** Soma das contribuições, em pontos percentuais. */
  contributionsSum: number
  contributions: Array<{ ticker: string; contribution: number }>
  hasContributions: boolean
}

const PAGE_SIZE = 10
/** Diferença tolerada (em pontos percentuais) entre a variação do dia e a soma das contribuições. */
const TOLERANCE = 0.01

function Delta({ value }: { value: number }) {
  const fraction = value / 100
  return (
    <span className={cn('font-medium', fraction > 0 ? 'text-positive' : fraction < 0 ? 'text-negative' : 'text-muted-foreground')}>
      {formatDeltaPct(fraction, { digits: 2 })}
    </span>
  )
}

/** `YYYY-MM-DD` → Date ao meio-dia UTC (evita trocar o dia por fuso). */
function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function isConsistent(day: DailyViewData) {
  return Math.abs(day.dailyChange - day.contributionsSum) < TOLERANCE
}

const columns: DataTableColumn<DailyViewData>[] = [
  {
    key: 'date',
    header: 'Data',
    sticky: true,
    cell: (day) => <span className="font-medium whitespace-nowrap text-foreground">{formatDate(parseDay(day.date))}</span>,
  },
  { key: 'dailyChange', header: 'Variação', align: 'right', cell: (day) => <Delta value={day.dailyChange} /> },
  { key: 'points', header: 'Pontos', align: 'right', cell: (day) => formatNumber(day.points, { digits: 2 }) },
  {
    key: 'check',
    header: 'Conferência',
    hint: 'Compara a variação do dia com a soma das contribuições de cada ativo.',
    cell: (day) =>
      !day.hasContributions ? (
        <span className="text-xs text-muted-foreground">Sem detalhe</span>
      ) : isConsistent(day) ? (
        <Badge variant="neutral">Confere</Badge>
      ) : (
        <Badge variant="warning">
          Diferença de {formatNumber(Math.abs(day.dailyChange - day.contributionsSum), { digits: 4 })} p.p.
        </Badge>
      ),
  },
]

export function IndexDailyView({ ticker }: { ticker: string }) {
  const [data, setData] = useState<DailyViewData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { isAdmin } = useAdminStatus()
  const { isPremium } = usePremiumStatus()

  const load = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(`/api/indices/${ticker}/daily-view`)
      const result = await response.json()
      if (result.success) setData(result.dailyData)
      else setError(result.error || 'Não foi possível carregar os dados.')
    } catch (err) {
      console.error('Error fetching daily view:', err)
      setError('Não foi possível carregar os dados diários.')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    load()
  }, [load])

  const handleRecalculateDay = async (date: string) => {
    try {
      setRecalculating(date)
      const response = await fetch(`/api/admin/indices/${ticker}/recalculate-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const result = await response.json()
      if (result.success) await load()
      else toast.error('Não foi possível recalcular o dia', { description: result.error })
    } catch (err) {
      console.error('Error recalculating day:', err)
      toast.error('Não foi possível recalcular o dia')
    } finally {
      setRecalculating(null)
    }
  }

  const header = (
    <SectionHeader title="Visão diária" description="Variação de cada pregão e quanto cada ativo contribuiu para ela." />
  )

  if (error) {
    return (
      <section className="space-y-4">
        {header}
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); load() }}>
            Tentar novamente
          </Button>
        </div>
      </section>
    )
  }

  if (!loading && !isPremium && data.length > 0) {
    return (
      <section className="space-y-4">
        {header}
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none select-none blur-sm">
            <DataTable columns={columns} rows={data.slice(0, 3)} getRowId={(day) => day.date} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-popover p-4 text-center shadow-md">
              <Lock className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <p className="text-sm text-foreground">
                Veja os {data.length} pregões do histórico com a contribuição de cada ativo.
              </p>
              <Button asChild size="sm">
                <Link href="/planos">Conhecer o Premium</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const rows = data.slice(start, start + PAGE_SIZE)

  return (
    <section className="space-y-4">
      {header}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowId={(day) => day.date}
        caption="Variação diária do índice"
        empty={{ title: 'Ainda não há pregões registrados' }}
        renderExpanded={(day) => (
          <div className="space-y-3">
            {day.hasContributions ? (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {day.contributions.map((contrib) => (
                  <li key={contrib.ticker} className="flex justify-between gap-3 tabular-nums">
                    <span className="font-medium text-foreground">{contrib.ticker}</span>
                    <Delta value={contrib.contribution} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Contribuições não disponíveis para este dia.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Soma das contribuições: <Delta value={day.contributionsSum} />
            </p>
            {isAdmin && day.hasContributions && !isConsistent(day) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRecalculateDay(day.date)}
                disabled={recalculating === day.date}
              >
                <RefreshCw className={cn('size-4', recalculating === day.date && 'animate-spin')} strokeWidth={1.75} />
                {recalculating === day.date ? 'Recalculando' : 'Recalcular dia'}
              </Button>
            )}
          </div>
        )}
      />
      {totalPages > 1 && (
        <nav aria-label="Paginação da visão diária" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, data.length)} de {data.length} pregões
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </nav>
      )}
    </section>
  )
}
