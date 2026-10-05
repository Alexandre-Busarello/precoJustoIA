'use client'

/**
 * Pontos de carregamento sob demanda da página de detalhe do índice.
 * O gráfico (recharts) e as abas com dados do cliente só baixam o JS quando aparecem, com skeleton no lugar.
 */

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

function ChartSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-72 w-full sm:h-96" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-5 w-64" />
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}

export const IndexComparisonChartLazy = dynamic(
  () => import('@/components/indices/index-comparison-chart').then((m) => m.IndexComparisonChart),
  { ssr: false, loading: ChartSkeleton }
)

export const IndexAssetPerformanceLazy = dynamic(
  () => import('@/components/indices/index-asset-performance').then((m) => m.IndexAssetPerformance),
  { ssr: false, loading: TableSkeleton }
)

export const IndexDailyViewLazy = dynamic(
  () => import('@/components/indices/index-daily-view').then((m) => m.IndexDailyView),
  { ssr: false, loading: TableSkeleton }
)
