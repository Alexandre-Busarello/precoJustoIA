import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { OndeAportarClient, type OndeAportarInitial, type PortfolioOption, type UniverseKind } from '@/components/allocation/onde-aportar-client'
import { getCurrentUser } from '@/lib/user-service'
import { PortfolioService } from '@/lib/portfolio-service'
import { prisma } from '@/lib/prisma'
import { ALLOCATION_PRESETS, MAX_AMOUNT, MIN_AMOUNT } from '@/lib/allocation/constants'
import type { AllocationPresetId } from '@/lib/allocation/types'
import { COVERED_ASSETS_LABEL } from '@/lib/site-constants'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Onde aportar: distribuição simulada do seu aporte',
  description: `Informe quanto vai aportar e entre quais ativos: a calculadora distribui o valor em quantidades inteiras segundo o desconto em relação ao preço justo, a qualidade e os seus pesos-alvo, com o motivo de cada escolha. Cobre ${COVERED_ASSETS_LABEL} da B3.`,
  alternates: { canonical: '/onde-aportar' },
  openGraph: {
    title: 'Onde aportar',
    description: 'Distribuição simulada do seu aporte segundo os critérios que você escolheu.',
    type: 'website',
    url: 'https://precojusto.ai/onde-aportar',
  },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseInitial(params: Record<string, string | string[] | undefined>, portfolios: PortfolioOption[]): OndeAportarInitial {
  const rawAmount = Number(first(params.valor)?.replace(',', '.'))
  const amount = Number.isFinite(rawAmount) && rawAmount >= MIN_AMOUNT && rawAmount <= MAX_AMOUNT ? rawAmount : undefined
  const carteira = first(params.carteira)
  const universo = first(params.universo)
  const tickers = (first(params.tickers) ?? '')
    .split(/[\s,;]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9]{4,7}$/.test(t))
    .slice(0, 10)
  let universe: UniverseKind | undefined
  let portfolioId: string | undefined
  if (carteira && portfolios.some((p) => p.id === carteira)) {
    universe = 'portfolio'
    portfolioId = carteira
  } else if (universo === 'radar') universe = 'radar'
  else if (universo === 'mercado') universe = 'market'
  else if (tickers.length > 0) universe = 'tickers'
  const criterio = first(params.criterio)
  const preset = ALLOCATION_PRESETS.some((p) => p.id === criterio) ? (criterio as AllocationPresetId) : undefined
  return { amount, universe, portfolioId, tickers, preset, autoRun: first(params.calcular) === '1' }
}

export default async function OndeAportarPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()])
  let portfolios: PortfolioOption[] = []
  let radarCount = 0
  if (user) {
    const [list, radar] = await Promise.all([
      PortfolioService.getUserPortfolios(user.id),
      prisma.radarConfig.findUnique({ where: { userId: user.id }, select: { tickers: true } }),
    ])
    portfolios = list.map((p) => ({ id: p.id, name: p.name, hasTargets: p.assets.some((a) => Number(a.targetAllocation) > 0) }))
    radarCount = Array.isArray(radar?.tickers) ? radar.tickers.length : 0
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader title="Onde aportar" description="Distribuição simulada do seu aporte segundo os critérios que você escolheu." />
      <OndeAportarClient
        isLoggedIn={!!user}
        isPremium={!!user?.isPremium}
        portfolios={portfolios}
        radarCount={radarCount}
        initial={parseInitial(params, portfolios)}
      />
    </div>
  )
}
