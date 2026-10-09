'use client'

import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { CompanyLogo } from '@/components/company-logo'
import { RadarStatusIndicator } from '@/components/radar-status-indicator'
import { RadarStrategyBadges, RADAR_STRATEGY_LABELS, type RadarStrategies } from '@/components/radar-strategy-badges'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import { normalizeTechnicalLabel, technicalRangeText } from '@/lib/radar-service'
import { cn } from '@/lib/utils'
import { formatMarginOfSafety, marginOfSafety } from '@/lib/valuation-metrics'

export type RadarAssetKind = 'STOCK' | 'FII' | 'BDR' | 'ETF'

export interface RadarAssetData {
  ticker: string
  name: string
  sector: string | null
  /** Quando omitido, trata-se como ação (STOCK) para links e colunas. */
  assetType?: RadarAssetKind
  currentPrice: number
  logoUrl: string | null
  overallScore: number | null
  overallStatus: 'green' | 'yellow' | 'red'
  fiiProfile?: {
    segment: string | null
    isPapel: boolean | null
  }
  etfProfile?: {
    etfClass: string | null
    netExpenseRatio: number | null
  }
  strategies: {
    approved: string[]
    /** Formato varia por tipo de ativo (ações, FII, ETF). */
    all: any
  }
  valuation: {
    /** Potencial (upside) em pontos percentuais (12,5 = 12,5%); a UI mostra a margem de segurança. */
    upside: number | null
    status: 'green' | 'yellow' | 'red'
    label: string
    /** Linha de texto para valuation FII (ex.: P/VP e DY) ou ETF (retorno 1a). */
    detail?: string | null
  }
  technical: {
    status: 'green' | 'yellow' | 'red'
    label: string
    fairEntryPrice: number | null
  }
  sentiment: {
    score: number | null
    status: 'green' | 'yellow' | 'red'
    label: string
  }
}

interface RadarGridProps {
  data: RadarAssetData[]
  loading?: boolean
  className?: string
  onAddToRadar?: (ticker: string) => void | Promise<void>
  radarTickers?: string[]
  showAddButton?: boolean
  isPremium?: boolean
  etfMode?: boolean
}

function assetHref(asset: RadarAssetData) {
  const ticker = asset.ticker.toLowerCase()
  if (asset.assetType === 'FII') return `/fii/${ticker}`
  if (asset.assetType === 'ETF') return `/etf/${ticker}`
  if (asset.assetType === 'BDR') return `/bdr/${ticker}`
  return `/acao/${ticker}`
}

function technicalHref(asset: RadarAssetData) {
  if (asset.assetType === 'FII') return assetHref(asset)
  return `${assetHref(asset)}/analise-tecnica`
}

function approvedCount(asset: RadarAssetData): number | null {
  if (asset.assetType === 'FII' || asset.assetType === 'ETF') return null
  const all = (asset.strategies.all ?? {}) as RadarStrategies
  const present = RADAR_STRATEGY_LABELS.filter((s) => all[s.key])
  if (present.length === 0) return null
  return present.filter((s) => all[s.key]?.isEligible).length
}

function profileText(asset: RadarAssetData): string {
  if (asset.assetType === 'ETF') {
    const parts = [asset.etfProfile?.etfClass ?? 'ETF']
    const fee = asset.etfProfile?.netExpenseRatio
    if (fee !== null && fee !== undefined) parts.push(`taxa ${formatPct(fee, { digits: 2 })} a.a.`)
    return parts.join(' · ')
  }
  const parts = ['FII']
  if (asset.fiiProfile?.isPapel === true) parts.push('Papel')
  if (asset.fiiProfile?.isPapel === false) parts.push('Tijolo')
  if (asset.fiiProfile?.segment) parts.push(asset.fiiProfile.segment)
  return parts.join(' · ')
}

function sentimentValue(asset: RadarAssetData): string {
  if (typeof asset.sentiment.score === 'number') return formatNumber(asset.sentiment.score, { digits: 0 })
  const label = asset.sentiment.label
  return !label || label === 'N/A' ? '—' : label
}

/**
 * Ações e BDRs: margem de segurança (1 − preço ÷ preço justo), a mesma métrica do cabeçalho do ativo, recalculada a
 * partir do potencial que a API devolve em pontos percentuais. ETFs: distância até a referência técnica, em fração.
 */
function valuationFraction(asset: RadarAssetData, etfMode: boolean): number | null {
  const upside = asset.valuation.upside
  if (typeof upside !== 'number' || !Number.isFinite(upside)) return null
  if (etfMode || asset.assetType === 'ETF') return upside / 100
  return marginOfSafety(asset.currentPrice, asset.currentPrice * (1 + upside / 100))
}

function ValuationCell({ asset, etfMode }: { asset: RadarAssetData; etfMode: boolean }) {
  if (asset.assetType === 'FII') {
    const detail = asset.valuation.detail
    return <span className="text-sm tabular-nums text-foreground">{detail && detail !== 'N/A' ? detail : '—'}</span>
  }
  const fraction = valuationFraction(asset, etfMode)
  const shown = fraction === null ? 0 : Math.sign(fraction) * Math.sign(Math.round(Math.abs(fraction) * 1000))
  return (
    <span
      className={cn(
        'text-sm font-medium tabular-nums',
        shown > 0 ? 'text-positive' : shown < 0 ? 'text-negative' : 'text-foreground'
      )}
    >
      {etfMode ? formatDeltaPct(fraction) : formatMarginOfSafety(fraction)}
    </span>
  )
}

function TechnicalCell({ asset }: { asset: RadarAssetData }) {
  const text = technicalRangeText(asset.technical.label)
  const entry = asset.technical.fairEntryPrice
  const hasData = normalizeTechnicalLabel(asset.technical.label) !== null
  const detail =
    entry !== null ? (
      <span className="block text-xs tabular-nums text-muted-foreground">
        Entrada {formatBRL(entry)}
        {asset.currentPrice > 0 && ` · preço ${formatDeltaPct(asset.currentPrice / entry - 1)}`}
      </span>
    ) : null
  if (!hasData) {
    return (
      <div className="min-w-0">
        <span className="text-sm text-muted-foreground">—</span>
        {detail}
      </div>
    )
  }
  return (
    <Link
      href={technicalHref(asset)}
      className="group flex min-h-11 min-w-0 flex-col justify-center rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      title={asset.assetType === 'FII' ? 'Ver análise técnica na página do FII' : 'Ver análise técnica completa'}
    >
      <span className="text-sm font-medium text-foreground underline decoration-border decoration-1 underline-offset-4 group-hover:decoration-foreground">
        {text}
      </span>
      {detail}
    </Link>
  )
}

export function RadarGrid({
  data,
  loading,
  className,
  onAddToRadar,
  radarTickers = [],
  showAddButton = false,
  isPremium = false,
  etfMode = false,
}: RadarGridProps) {
  const hasFii = data.some((a) => a.assetType === 'FII')
  const strategyNames = RADAR_STRATEGY_LABELS.map((s) => s.label).join(', ')

  const columns: DataTableColumn<RadarAssetData>[] = [
    {
      key: 'ticker',
      header: 'Ativo',
      sortable: true,
      sortValue: (asset) => asset.ticker,
      cell: (asset) => (
        <Link
          href={assetHref(asset)}
          className="flex min-h-11 items-center gap-2.5 rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          <CompanyLogo logoUrl={asset.logoUrl} companyName={asset.name} ticker={asset.ticker} size={32} />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{asset.ticker}</span>
            <span className="block max-w-[7.5rem] truncate text-xs text-muted-foreground sm:max-w-[13rem]">{asset.name}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'score',
      className: 'whitespace-nowrap',
      header: 'Score',
      sortable: true,
      sortValue: (asset) => asset.overallScore,
      hint: 'Nota de solidez de 0 a 100 (PJ-FII para fundos, PJ-ETF para ETFs). Ponto cheio: 70 ou mais; meio cheio: 50 a 69; vazio: abaixo de 50.',
      cell: (asset) => (
        <RadarStatusIndicator
          status={asset.overallStatus}
          value={formatNumber(asset.overallScore, { digits: 0 })}
        />
      ),
    },
    {
      key: 'strategies',
      className: 'whitespace-nowrap',
      header: etfMode ? 'Classe e taxa' : hasFii ? 'Estratégias / perfil' : 'Estratégias',
      sortable: !etfMode,
      sortValue: approvedCount,
      hint: etfMode
        ? 'Classe do ETF e taxa de administração anual.'
        : `Quantos modelos o ativo atende: ${strategyNames}. Ponto cheio: aprovado; vazio: não aprovado.${
            isPremium ? '' : ' No plano gratuito, só o modelo de Graham é considerado.'
          }${hasFii ? ' Para FIIs, mostra o tipo e o segmento do fundo.' : ''}`,
      cell: (asset) =>
        asset.assetType === 'ETF' || asset.assetType === 'FII' ? (
          <span className="block max-w-[12rem] truncate text-sm text-muted-foreground">{profileText(asset)}</span>
        ) : (
          <RadarStrategyBadges strategies={(asset.strategies.all ?? {}) as RadarStrategies} ticker={asset.ticker} />
        ),
    },
    {
      key: 'valuation',
      className: 'whitespace-nowrap',
      header: etfMode ? 'Vs. referência técnica' : hasFii ? 'Margem de segurança · P/VP e DY' : 'Margem de segurança',
      align: 'right',
      sortable: true,
      sortValue: (asset) => (asset.assetType === 'FII' ? null : valuationFraction(asset, etfMode)),
      hint: etfMode
        ? 'Distância entre o preço atual e a referência técnica estimada. É uma estimativa, não recomendação.'
        : `1 − preço ÷ preço justo, pelo maior preço justo entre Graham, FCD e Gordon. É uma estimativa de modelo, não recomendação.${
            hasFii ? ' Para FIIs, mostra P/VP e dividend yield.' : ''
          }`,
      cell: (asset) => <ValuationCell asset={asset} etfMode={etfMode} />,
    },
    {
      key: 'technical',
      className: 'whitespace-nowrap',
      header: 'Técnica',
      hint: 'Posição do preço em relação à faixa técnica estimada por IA para 30 dias. Dentro da faixa: preço na faixa e até a entrada técnica, com score de 50 ou mais. Dentro da faixa, acima da entrada: preço na faixa, mas acima da entrada técnica. Acima ou abaixo da faixa: preço fora da faixa. Até ou acima da entrada: sem faixa estimada, só a comparação com a entrada técnica. Neutro: preço próximo da entrada ou score abaixo de 50. Não é recomendação.',
      cell: (asset) => <TechnicalCell asset={asset} />,
    },
    {
      key: 'sentiment',
      className: 'whitespace-nowrap',
      header: etfMode ? 'Score IA' : 'Sentimento',
      sortable: true,
      sortValue: (asset) => asset.sentiment.score,
      hint: etfMode
        ? 'Nota de 0 a 100 da análise do ETF feita por IA.'
        : 'Sentimento de 0 a 100 a partir de notícias e vídeos sobre o ativo. Ponto cheio: 70 ou mais; meio cheio: 50 a 69; vazio: abaixo de 50.',
      cell: (asset) => <RadarStatusIndicator status={asset.sentiment.status} value={sentimentValue(asset)} />,
    },
  ]

  if (showAddButton) {
    columns.push({
      key: 'action',
      header: <span className="sr-only">Adicionar ao radar</span>,
      align: 'right',
      cell: (asset) =>
        radarTickers.includes(asset.ticker) ? (
          <span className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
            No radar
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onAddToRadar?.(asset.ticker)
            }}
            aria-label={`Adicionar ${asset.ticker} ao radar`}
          >
            <Plus className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Adicionar
          </Button>
        ),
    })
  }

  return (
    <DataTable
      className={className}
      columns={columns}
      rows={data}
      getRowId={(asset) => asset.ticker}
      stickyFirstColumn
      loading={loading}
      loadingRows={4}
      caption="Ativos do radar"
      empty={{
        title: 'Nenhum ativo no radar',
        description: 'Adicione tickers ao seu radar ou veja a aba Explorar.',
      }}
    />
  )
}
