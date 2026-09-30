import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatBRL, formatBRLCompact, formatDeltaPct, formatNumber, formatPct } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { EtfComparisonSelector } from '@/components/etf-comparison-selector'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import {
  ComparisonTable,
  type ComparisonBetter,
  type ComparisonGroup,
  type ComparisonRow,
} from '@/components/comparison-table'

interface PageProps {
  params: { tickers: string[] }
}

type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

function n(v: PrismaDecimal): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'object' && 'toNumber' in v) return v.toNumber()
  const parsed = parseFloat(String(v))
  return Number.isNaN(parsed) ? null : parsed
}

const HUB_HREF = '/comparador?tipo=etfs'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tickers: tickerSegments } = await params
  const tickers = tickerSegments.map((t) => t.toUpperCase())
  const title = `Comparar ETFs: ${tickers.join(' vs ')}`
  const description = `Compare ${tickers.join(', ')} lado a lado: taxa, retorno, patrimônio e Score PJ, com o melhor valor de cada indicador destacado.`
  return {
    title,
    description,
    alternates: { canonical: `/compara-etfs/${tickerSegments.join('/')}` },
    robots: { index: false, follow: true },
  }
}

export default async function ComparaEtfsPage({ params }: PageProps) {
  const { tickers: tickerSegments } = await params
  const tickers = tickerSegments.slice(0, 6).map((t) => t.toUpperCase())

  if (tickers.length < 2) return notFound()

  const companies = await prisma.company.findMany({
    where: { ticker: { in: tickers }, assetType: 'ETF', isActive: true },
    select: {
      ticker: true,
      name: true,
      logoUrl: true,
      etfData: {
        select: {
          etfScore: true,
          etfClass: true,
          category: true,
          benchmarkIndex: true,
          netExpenseRatio: true,
          netAssets: true,
          return1m: true,
          return3m: true,
          return6m: true,
          return1y: true,
          return3y: true,
          return5y: true,
          returnSinceInception: true,
          volatility12m: true,
          holdingsConcentrationTop5: true,
          aiAnalysisScore: true,
          aiAnalysisSummary: true,
          aiConcentracaoPenaltyOverride: true,
          holdings: {
            orderBy: { weight: 'desc' },
            take: 5,
            select: { ticker: true, name: true, weight: true },
          },
        },
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { price: true },
      },
    },
  })

  if (companies.length < 2) return notFound()

  // Preserva a ordem da URL
  const etfs = tickers
    .map((t) => companies.find((c) => c.ticker === t))
    .filter((c): c is (typeof companies)[number] => Boolean(c))
    .map((c) => ({
      ticker: c.ticker,
      name: c.name,
      price: n(c.dailyQuotes[0]?.price ?? null),
      etfScore: c.etfData?.etfScore ?? null,
      etfClass: c.etfData?.etfClass ?? null,
      category: c.etfData?.category ?? null,
      benchmarkIndex: c.etfData?.benchmarkIndex ?? null,
      netExpenseRatio: n(c.etfData?.netExpenseRatio ?? null),
      netAssets: n(c.etfData?.netAssets ?? null),
      return1m: n(c.etfData?.return1m ?? null),
      return3m: n(c.etfData?.return3m ?? null),
      return6m: n(c.etfData?.return6m ?? null),
      return1y: n(c.etfData?.return1y ?? null),
      return3y: n(c.etfData?.return3y ?? null),
      return5y: n(c.etfData?.return5y ?? null),
      returnSinceInception: n(c.etfData?.returnSinceInception ?? null),
      volatility12m: n(c.etfData?.volatility12m ?? null),
      holdingsConcentrationTop5: n(c.etfData?.holdingsConcentrationTop5 ?? null),
      aiAnalysisScore: c.etfData?.aiAnalysisScore ?? null,
      aiAnalysisSummary: c.etfData?.aiAnalysisSummary ?? null,
      aiConcentracaoPenaltyOverride: c.etfData?.aiConcentracaoPenaltyOverride ?? false,
      topHoldings: (c.etfData?.holdings ?? []).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: n(h.weight) ?? 0,
      })),
    }))

  if (etfs.length < 2) return notFound()

  type Etf = (typeof etfs)[number]
  const score100 = (v: number | null) => formatNumber(v, { digits: 0 })

  function metricRow(options: {
    key: string
    label: string
    description?: string
    hint?: string
    better: ComparisonBetter
    get: (e: Etf) => number | null
    format: (v: number | null) => string
  }): ComparisonRow {
    return {
      key: options.key,
      label: options.label,
      description: options.description,
      hint: options.hint,
      better: options.better,
      cells: etfs.map((e) => {
        const value = options.get(e)
        return { value, text: options.format(value) }
      }),
    }
  }

  function textRow(key: string, label: string, get: (e: Etf) => string | null): ComparisonRow {
    return {
      key,
      label,
      better: 'none',
      text: true,
      cells: etfs.map((e) => ({ value: null, text: get(e) ?? '—' })),
    }
  }

  const returnRow = (key: keyof Etf, label: string) =>
    metricRow({ key, label, better: 'higher', get: (e) => e[key] as number | null, format: formatDeltaPct })

  const groups: ComparisonGroup[] = [
    {
      key: 'score',
      label: 'Score Preço Justo (0 a 100)',
      rows: [
        metricRow({
          key: 'etfScore',
          label: 'Score PJ-ETF',
          description: 'Custo, retorno, risco e concentração',
          hint: 'Nota de 0 a 100 criada pelo Preço Justo AI para resumir a qualidade geral do ETF, considerando custo, retorno, risco e concentração.',
          better: 'higher',
          get: (e) => e.etfScore,
          format: score100,
        }),
        metricRow({
          key: 'aiAnalysisScore',
          label: 'Score IA',
          description: 'Estimativa gerada por IA',
          hint: 'Nota gerada por inteligência artificial a partir dos dados quantitativos do ETF, complementar ao Score PJ-ETF.',
          better: 'higher',
          get: (e) => e.aiAnalysisScore,
          format: score100,
        }),
      ],
    },
    {
      key: 'custo',
      label: 'Custo',
      rows: [
        metricRow({
          key: 'netExpenseRatio',
          label: 'Taxa de administração',
          description: 'Ao ano',
          hint: 'Percentual cobrado por ano sobre o valor investido para manter o ETF funcionando. Quanto menor, mais fica de retorno para o investidor.',
          better: 'lower',
          get: (e) => e.netExpenseRatio,
          format: (v) => formatPct(v, { digits: 2 }),
        }),
      ],
    },
    {
      key: 'retorno',
      label: 'Retorno histórico',
      rows: [
        returnRow('return1m', '1 mês'),
        returnRow('return3m', '3 meses'),
        returnRow('return6m', '6 meses'),
        returnRow('return1y', '1 ano'),
        returnRow('return3y', '3 anos'),
        returnRow('return5y', '5 anos'),
        returnRow('returnSinceInception', 'Desde o início'),
      ],
    },
    {
      key: 'patrimonio',
      label: 'Patrimônio e liquidez',
      rows: [
        metricRow({
          key: 'netAssets',
          label: 'Patrimônio líquido',
          better: 'higher',
          get: (e) => e.netAssets,
          format: formatBRLCompact,
        }),
        metricRow({ key: 'price', label: 'Cotação', better: 'none', get: (e) => e.price, format: formatBRL }),
      ],
    },
    {
      key: 'risco',
      label: 'Risco',
      rows: [
        metricRow({
          key: 'volatility12m',
          label: 'Volatilidade 12m',
          hint: 'Mede o quanto o preço do ETF costuma variar nos últimos 12 meses. Quanto maior, mais oscilações o investimento pode apresentar no curto prazo.',
          better: 'lower',
          get: (e) => e.volatility12m,
          format: formatPct,
        }),
        metricRow({
          key: 'holdingsConcentrationTop5',
          label: 'Concentração top 5',
          description: 'Peso das 5 maiores posições',
          better: 'lower',
          get: (e) => e.holdingsConcentrationTop5,
          format: (v) => formatPct(v, { digits: 0 }),
        }),
      ],
    },
    {
      key: 'info',
      label: 'Informações',
      rows: [
        textRow('benchmark', 'Benchmark', (e) => e.benchmarkIndex ?? e.category),
        textRow('etfClass', 'Classe', (e) => e.etfClass),
        textRow('espelho', 'Fundo espelho', (e) => (e.aiConcentracaoPenaltyOverride ? 'Quanto/Espelho' : null)),
      ],
    },
  ]

  const assets = etfs.map((e) => ({
    ticker: e.ticker,
    name: e.name,
    href: `/etf/${e.ticker.toLowerCase()}`,
    meta: e.price !== null ? formatBRL(e.price) : null,
  }))

  const title = etfs.map((e) => e.ticker).join(' vs ')
  const withSummary = etfs.filter((e) => e.aiAnalysisSummary)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[
          { label: 'Início', href: '/' },
          { label: 'Comparador de ETFs', href: HUB_HREF },
          { label: title },
        ]}
        title={title}
        description={`Comparação de ${etfs.length} ETFs da B3, indicador por indicador.`}
        actions={
          <Button variant="outline" asChild>
            <Link href={HUB_HREF}>Nova comparação</Link>
          </Button>
        }
      />

      <ComparisonTable caption={`Indicadores de ${etfs.map((e) => e.ticker).join(', ')}`} assets={assets} groups={groups} />

      <section className="space-y-4">
        <SectionHeader title="Principais posições" description="As 5 maiores posições de cada ETF, pelo peso na carteira." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {etfs.map((etf) => (
            <div key={etf.ticker} className="min-w-0 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-foreground">{etf.ticker}</h3>
              {etf.topHoldings.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sem dados de composição.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {etf.topHoldings.map((h, i) => (
                    <li key={`${h.ticker ?? h.name}-${i}`} className="min-w-0">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-foreground">{h.ticker ?? h.name}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{formatPct(h.weight)}</span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full bg-brand"
                          style={{ width: `${Math.min(100, Math.max(0, h.weight * 100))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      {withSummary.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Resumo gerado por IA" description="Estimativa gerada por IA a partir dos dados de cada ETF. Não é recomendação." />
          <div className="grid gap-3 sm:grid-cols-2">
            {withSummary.map((etf) => (
              <div key={etf.ticker} className="min-w-0 rounded-lg border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">{etf.ticker}</h3>
                  {etf.aiAnalysisScore !== null && (
                    <span className="text-xs text-muted-foreground tabular-nums">Score IA {score100(etf.aiAnalysisScore)}</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{etf.aiAnalysisSummary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <EtfComparisonSelector title="Modificar comparação" initialTickers={etfs.map((e) => e.ticker)} />
    </div>
  )
}
