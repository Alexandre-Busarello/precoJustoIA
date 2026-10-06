'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { AssetCell, assetHref } from '@/components/asset/asset-cell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { useRadar } from '@/hooks/use-radar'
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import { marginOfSafety, valuationStatus, VALUATION_STATUS_LABEL, VALUATION_STATUS_TONE } from '@/lib/valuation-metrics'
import { BlockEmpty, BlockError } from '@/app/dashboard/_components/block-state'
import type { RadarAssetData } from './radar-grid'

/** Máximo de linhas no resumo do dashboard; a lista completa fica em /radar. */
const MAX_ROWS = 10

type RadarApiAsset = RadarAssetData & {
  /** Variação do dia em pontos percentuais (1,2 = +1,2%), quando a API do radar informar. */
  changePercent?: number | null
}

interface RadarRow {
  ticker: string
  name: string
  href: string
  logoUrl: string | null
  price: number
  /** Fração (0,012 = +1,2%). */
  dayChange: number | null
  /** Margem de segurança em fração (1 − P/PJ). */
  margin: number | null
  score: number | null
}

function toRow(asset: RadarApiAsset): RadarRow {
  const price = asset.currentPrice
  // A API devolve o upside em pontos percentuais (preço justo / preço − 1, × 100).
  const upsidePct = asset.valuation?.upside
  const fair = typeof upsidePct === 'number' && Number.isFinite(upsidePct) && price > 0 ? price * (1 + upsidePct / 100) : null
  const change = asset.changePercent
  return {
    ticker: asset.ticker,
    name: asset.name,
    href: assetHref(asset.ticker, asset.assetType),
    logoUrl: asset.logoUrl ?? null,
    price,
    dayChange: typeof change === 'number' && Number.isFinite(change) ? change / 100 : null,
    margin: marginOfSafety(price, fair),
    score: asset.overallScore,
  }
}

function signTone(value: number | null): string {
  if (value === null || Math.round(Math.abs(value) * 1000) === 0) return 'text-muted-foreground'
  return value > 0 ? 'text-positive' : 'text-negative'
}

export function DashboardRadarSection() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { radarConfig, radarData, loadingConfig, loadingData, configError, dataError } = useRadar()

  const tickers = radarConfig?.tickers ?? []
  const rows = (radarData as RadarApiAsset[]).map(toRow)
  const hasDayChange = rows.some((row) => row.dayChange !== null)
  const loading = loadingConfig || (tickers.length > 0 && loadingData)

  const retry = () => {
    queryClient.invalidateQueries({ queryKey: ['radar-config'] })
    queryClient.invalidateQueries({ queryKey: ['radar-data'] })
  }

  const columns: DataTableColumn<RadarRow>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      sortable: true,
      cell: (row) => (
        <AssetCell href={row.href} ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} className="max-w-40 sm:max-w-56" />
      ),
    },
    { key: 'price', header: 'Preço', align: 'right', sortable: true, cell: (row) => formatBRL(row.price) },
    ...(hasDayChange
      ? [
          {
            key: 'dayChange',
            header: 'Δ dia',
            align: 'right' as const,
            sortable: true,
            cell: (row: RadarRow) => <span className={signTone(row.dayChange)}>{formatDeltaPct(row.dayChange)}</span>,
          },
        ]
      : []),
    {
      key: 'margin',
      header: 'Margem',
      hint: 'Margem de segurança: 1 − preço ÷ preço justo estimado (melhor entre Graham, FCD e Gordon).',
      align: 'right',
      sortable: true,
      cell: (row) => <span className={signTone(row.margin)}>{formatPct(row.margin)}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      sortable: true,
      cell: (row) => formatNumber(row.score, { digits: 0 }),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (row) => row.margin,
      cell: (row) => {
        const status = valuationStatus(row.margin)
        return status ? (
          <Badge variant={VALUATION_STATUS_TONE[status]}>{VALUATION_STATUS_LABEL[status]}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
  ]

  return (
    <section aria-labelledby="dashboard-radar" className="space-y-3">
      <SectionHeader
        id="dashboard-radar"
        title="Radar"
        description={tickers.length > 0 ? `${tickers.length} ${tickers.length === 1 ? 'ativo acompanhado' : 'ativos acompanhados'}` : undefined}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/radar">Gerenciar</Link>
          </Button>
        }
      />
      {configError || dataError ? (
        <BlockError message="Não foi possível carregar o radar." onRetry={retry} />
      ) : !loading && tickers.length === 0 ? (
        <BlockEmpty
          title="Seu radar está vazio"
          description="Adicione ativos para acompanhar preço, margem e score em um só lugar."
          action={
            <Button asChild size="sm">
              <Link href="/radar">Montar radar</Link>
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, MAX_ROWS)}
            getRowId={(row) => row.ticker}
            loading={loading}
            loadingRows={Math.min(Math.max(tickers.length, 3), 5)}
            stickyFirstColumn
            dense
            caption="Ativos do seu radar"
            onRowClick={(row) => router.push(row.href)}
            empty={{ title: 'Sem dados para os ativos do radar no momento' }}
          />
          {!loading && rows.length > MAX_ROWS && (
            <p className="text-xs text-muted-foreground">
              Mostrando {MAX_ROWS} de {rows.length}.{' '}
              <Link href="/radar" className="text-brand underline-offset-4 hover:underline">
                Ver radar completo
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  )
}
