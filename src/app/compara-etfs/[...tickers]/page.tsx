import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { CompanyLogo } from '@/components/company-logo'
import { Footer } from '@/components/footer'
import { Breadcrumbs } from '@/components/landing/breadcrumbs'
import { EtfComparisonSelector } from '@/components/etf-comparison-selector'
import Link from 'next/link'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy, Medal, Award, TrendingUp, DollarSign, BarChart3,
  ExternalLink, ArrowLeft, Activity, Shield
} from 'lucide-react'

interface PageProps {
  params: { tickers: string[] }
}

type PrismaDecimal = { toNumber: () => number } | number | string | null | undefined

function n(v: PrismaDecimal): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v)
  if (typeof v === 'object' && 'toNumber' in v) return v.toNumber()
  return parseFloat(String(v))
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(decimals)}%`
}

function fmtBrl(v: number | null): string {
  if (v === null) return '—'
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(0)}M`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function fmtTaxa(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(2)}% a.a.`
}

function medal(rank: number): { icon: ReactNode; label: string; bg: string } | null {
  if (rank === 0) return {
    icon: <Trophy className="w-4 h-4 text-yellow-500" />,
    label: 'Ouro',
    bg: 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700',
  }
  if (rank === 1) return {
    icon: <Medal className="w-4 h-4 text-gray-400" />,
    label: 'Prata',
    bg: 'bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700',
  }
  if (rank === 2) return {
    icon: <Award className="w-4 h-4 text-amber-600" />,
    label: 'Bronze',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700',
  }
  return null
}

function rankByScore<T>(items: T[], getScore: (item: T) => number | null, higherIsBetter = true): number[] {
  const withIdx = items.map((item, i) => ({ i, score: getScore(item) }))
  const valid = withIdx.filter((x) => x.score !== null)
  valid.sort((a, b) => higherIsBetter ? (b.score! - a.score!) : (a.score! - b.score!))

  const ranks = new Array(items.length).fill(-1)
  valid.forEach((x, rank) => { ranks[x.i] = rank })
  return ranks
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tickers: tickerSegments } = await params
  const tickers = tickerSegments.map((t) => t.toUpperCase())
  const title = `Comparar ETFs: ${tickers.join(' vs ')} | Preço Justo AI`
  const description = `Compare ${tickers.join(', ')} lado a lado — taxa, retorno, patrimônio e Score PJ. Encontre o melhor ETF para sua carteira.`
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
      website: true,
      description: true,
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

  // Preserve order
  const etfs = tickers
    .map((t) => companies.find((c) => c.ticker === t))
    .filter(Boolean)
    .map((c) => ({
      ticker: c!.ticker,
      name: c!.name,
      logoUrl: c!.logoUrl,
      website: c!.website,
      description: c!.description,
      price: n(c!.dailyQuotes[0]?.price ?? null),
      etfScore: c!.etfData?.etfScore ?? null,
      etfClass: c!.etfData?.etfClass ?? null,
      category: c!.etfData?.category ?? null,
      benchmarkIndex: c!.etfData?.benchmarkIndex ?? null,
      netExpenseRatio: n(c!.etfData?.netExpenseRatio ?? null),
      netAssets: n(c!.etfData?.netAssets ?? null),
      return1m: n(c!.etfData?.return1m ?? null),
      return3m: n(c!.etfData?.return3m ?? null),
      return6m: n(c!.etfData?.return6m ?? null),
      return1y: n(c!.etfData?.return1y ?? null),
      return3y: n(c!.etfData?.return3y ?? null),
      return5y: n(c!.etfData?.return5y ?? null),
      returnSinceInception: n(c!.etfData?.returnSinceInception ?? null),
      volatility12m: n(c!.etfData?.volatility12m ?? null),
      holdingsConcentrationTop5: n(c!.etfData?.holdingsConcentrationTop5 ?? null),
      aiAnalysisScore: c!.etfData?.aiAnalysisScore ?? null,
      aiAnalysisSummary: c!.etfData?.aiAnalysisSummary ?? null,
      aiConcentracaoPenaltyOverride: c!.etfData?.aiConcentracaoPenaltyOverride ?? false,
      topHoldings: (c!.etfData?.holdings ?? []).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: n(h.weight) ?? 0,
      })),
    }))

  if (etfs.length < 2) return notFound()

  // Rankings
  const rankScore = rankByScore(etfs, (e) => e.etfScore, true)
  const rankCusto = rankByScore(etfs, (e) => e.netExpenseRatio, false) // lower is better
  const rankReturn1y = rankByScore(etfs, (e) => e.return1y, true)
  const rankReturn3y = rankByScore(etfs, (e) => e.return3y, true)
  const rankReturn5y = rankByScore(etfs, (e) => e.return5y, true)
  const rankAssets = rankByScore(etfs, (e) => e.netAssets, true)
  const rankVol = rankByScore(etfs, (e) => e.volatility12m, false) // lower is better
  const rankAI = rankByScore(etfs, (e) => e.aiAnalysisScore, true)

  const scoreWinnerIdx = rankScore.indexOf(0)
  const scoreWinner = scoreWinnerIdx >= 0 ? etfs[scoreWinnerIdx] : null

  const colWidth = `${Math.max(140, Math.floor(640 / etfs.length))}px`

  // Helper to render a metric row
  function MetricRow({
    label,
    values,
    ranks,
    format,
    sublabel,
  }: {
    label: string
    values: (number | null)[]
    ranks: number[]
    format: (v: number | null) => string
    sublabel?: string
  }) {
    return (
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
        <td className="py-3 px-4 text-sm font-medium text-muted-foreground sticky left-0 bg-background z-10 min-w-[140px]">
          {label}
          {sublabel && <div className="text-xs text-muted-foreground/70">{sublabel}</div>}
        </td>
        {values.map((val, i) => {
          const m = medal(ranks[i])
          return (
            <td key={i} className="py-3 px-4 text-center text-sm" style={{ minWidth: colWidth }}>
              {m ? (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${m.bg}`}>
                  {m.icon}
                  <span>{format(val)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">{format(val)}</span>
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  // Section header row
  function SectionRow({ label }: { label: string }) {
    return (
      <tr className="bg-muted/40">
        <td colSpan={etfs.length + 1} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </td>
      </tr>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 pt-6">
        <Breadcrumbs items={[
          { label: 'Ferramentas', href: '/ranking' },
          { label: 'Comparador de ETFs', href: '/comparador-etfs' },
          { label: etfs.map((e) => e.ticker).join(' vs ') },
        ]} />
      </div>

      <div className="container mx-auto max-w-7xl px-4 pt-4 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link href="/comparador-etfs">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Nova comparação
            </Link>
          </Button>
          <h1 className="text-xl font-bold">
            {etfs.map((e) => e.ticker).join(' vs ')}
          </h1>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-12 space-y-8">
        {/* Winner highlight */}
        {scoreWinner && (
          <Card className="border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="py-4 flex items-center gap-4 flex-wrap">
              <Trophy className="w-8 h-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Melhor Score PJ-ETF</p>
                <div className="flex items-center gap-2">
                  <CompanyLogo ticker={scoreWinner.ticker} companyName={scoreWinner.name} logoUrl={scoreWinner.logoUrl} size={36} />
                  <span className="text-lg font-bold">{scoreWinner.ticker}</span>
                  <span className="text-muted-foreground">–</span>
                  <span className="text-base">{scoreWinner.name}</span>
                  {scoreWinner.etfScore && (
                    <Badge className="bg-yellow-500 text-white ml-1">{scoreWinner.etfScore}/100</Badge>
                  )}
                </div>
              </div>
              <div className="ml-auto">
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Link href={`/etf/${scoreWinner.ticker.toLowerCase()}`}>
                    Ver análise completa
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main comparison table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              Comparação Detalhada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="py-4 px-4 text-left text-sm font-semibold sticky left-0 bg-background z-10 min-w-[140px]">
                      Indicador
                    </th>
                    {etfs.map((etf) => (
                      <th
                        key={etf.ticker}
                        className="py-4 px-4 text-center"
                        style={{ minWidth: colWidth }}
                      >
                        <Link href={`/etf/${etf.ticker.toLowerCase()}`} className="group">
                          <div className="flex flex-col items-center gap-1">
                            <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={44} />
                            <span className="text-sm font-bold group-hover:text-teal-600 transition-colors">
                              {etf.ticker}
                            </span>
                            <span className="text-xs text-muted-foreground text-center line-clamp-2 max-w-[120px]">
                              {etf.name}
                            </span>
                            {etf.etfClass && (
                              <Badge variant="outline" className="text-xs">
                                {etf.etfClass}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Score PJ */}
                  <SectionRow label="Score Preço Justo" />
                  <MetricRow
                    label="Score PJ-ETF"
                    sublabel="0–100"
                    values={etfs.map((e) => e.etfScore)}
                    ranks={rankScore}
                    format={(v) => v !== null ? `${v}/100` : '—'}
                  />
                  <MetricRow
                    label="Score IA"
                    sublabel="análise quantitativa"
                    values={etfs.map((e) => e.aiAnalysisScore)}
                    ranks={rankAI}
                    format={(v) => v !== null ? `${v}/100` : '—'}
                  />

                  {/* Custo */}
                  <SectionRow label="Custo" />
                  <MetricRow
                    label="Taxa de Administração"
                    values={etfs.map((e) => e.netExpenseRatio)}
                    ranks={rankCusto}
                    format={fmtTaxa}
                  />

                  {/* Retorno */}
                  <SectionRow label="Retorno Histórico" />
                  <MetricRow
                    label="1 Mês"
                    values={etfs.map((e) => e.return1m)}
                    ranks={rankByScore(etfs, (e) => e.return1m, true)}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="3 Meses"
                    values={etfs.map((e) => e.return3m)}
                    ranks={rankByScore(etfs, (e) => e.return3m, true)}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="6 Meses"
                    values={etfs.map((e) => e.return6m)}
                    ranks={rankByScore(etfs, (e) => e.return6m, true)}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="1 Ano"
                    values={etfs.map((e) => e.return1y)}
                    ranks={rankReturn1y}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="3 Anos"
                    values={etfs.map((e) => e.return3y)}
                    ranks={rankReturn3y}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="5 Anos"
                    values={etfs.map((e) => e.return5y)}
                    ranks={rankReturn5y}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="Desde o Início"
                    values={etfs.map((e) => e.returnSinceInception)}
                    ranks={rankByScore(etfs, (e) => e.returnSinceInception, true)}
                    format={fmtPct}
                  />

                  {/* Liquidez & Patrimônio */}
                  <SectionRow label="Patrimônio & Liquidez" />
                  <MetricRow
                    label="Patrimônio Líquido"
                    values={etfs.map((e) => e.netAssets)}
                    ranks={rankAssets}
                    format={fmtBrl}
                  />
                  <MetricRow
                    label="Cotação"
                    values={etfs.map((e) => e.price)}
                    ranks={new Array(etfs.length).fill(-1)}
                    format={(v) => v !== null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'}
                  />

                  {/* Risco */}
                  <SectionRow label="Risco" />
                  <MetricRow
                    label="Volatilidade 12m"
                    values={etfs.map((e) => e.volatility12m)}
                    ranks={rankVol}
                    format={fmtPct}
                  />
                  <MetricRow
                    label="Concentração Top 5"
                    sublabel="% nas 5 maiores posições"
                    values={etfs.map((e) => e.holdingsConcentrationTop5)}
                    ranks={rankByScore(etfs, (e) => e.holdingsConcentrationTop5, false)}
                    format={(v) => v !== null ? `${(v * 100).toFixed(0)}%` : '—'}
                  />

                  {/* Info */}
                  <SectionRow label="Informações" />
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 text-sm font-medium text-muted-foreground sticky left-0 bg-background z-10">
                      Benchmark
                    </td>
                    {etfs.map((e) => (
                      <td key={e.ticker} className="py-3 px-4 text-center text-sm" style={{ minWidth: colWidth }}>
                        {e.benchmarkIndex ?? e.category ?? '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 text-sm font-medium text-muted-foreground sticky left-0 bg-background z-10">
                      Classe
                    </td>
                    {etfs.map((e) => (
                      <td key={e.ticker} className="py-3 px-4 text-center" style={{ minWidth: colWidth }}>
                        {e.etfClass ? (
                          <Badge variant="outline" className="text-xs">{e.etfClass}</Badge>
                        ) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm font-medium text-muted-foreground sticky left-0 bg-background z-10">
                      Fundo Espelho
                    </td>
                    {etfs.map((e) => (
                      <td key={e.ticker} className="py-3 px-4 text-center text-sm" style={{ minWidth: colWidth }}>
                        {e.aiConcentracaoPenaltyOverride ? (
                          <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">Quanto/Espelho</Badge>
                        ) : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Holdings side by side */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            Principais Posições
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${etfs.length}, 1fr)` }}>
            {etfs.map((etf) => (
              <Card key={etf.ticker}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                    {etf.ticker}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {etf.topHoldings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados</p>
                  ) : (
                    <div className="space-y-2">
                      {etf.topHoldings.map((h, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-medium truncate">{h.ticker ?? h.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {(h.weight * 100).toFixed(1)}%
                              </span>
                            </div>
                            {h.ticker && (
                              <div className="w-full bg-muted rounded-full h-1 mt-0.5">
                                <div
                                  className="bg-teal-500 h-1 rounded-full"
                                  style={{ width: `${Math.min(100, h.weight * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Summaries */}
        {etfs.some((e) => e.aiAnalysisSummary) && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" />
              Análise IA
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(etfs.length, 3)}, 1fr)` }}>
              {etfs
                .filter((e) => e.aiAnalysisSummary)
                .map((etf) => (
                  <Card key={etf.ticker}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                        {etf.ticker}
                        {etf.aiAnalysisScore && (
                          <Badge className="ml-auto bg-teal-600 text-white text-xs">
                            {etf.aiAnalysisScore}/100
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {etf.aiAnalysisSummary}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Links para páginas individuais */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ver análise completa de cada ETF</h2>
          <div className="flex flex-wrap gap-3">
            {etfs.map((etf) => (
              <Button key={etf.ticker} variant="outline" asChild>
                <Link href={`/etf/${etf.ticker.toLowerCase()}`}>
                  <CompanyLogo ticker={etf.ticker} companyName={etf.name} logoUrl={etf.logoUrl} size={24} />
                  {etf.ticker}
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Selector to change comparison */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Modificar comparação</h2>
          <EtfComparisonSelector initialTickers={etfs.map((e) => e.ticker)} />
        </div>
      </div>

      <Footer />
    </div>
  )
}
