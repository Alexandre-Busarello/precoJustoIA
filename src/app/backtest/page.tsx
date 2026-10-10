import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { PageHeader } from '@/components/page-header'
import { BacktestPageClient } from '@/components/backtest-page-client'
import { BacktestShowcaseSection } from '@/components/backtest-showcase/showcase-section'
import { BacktestLanding } from './backtest-landing'
import { BacktestUpgradeCard } from './backtest-upgrade-card'

const TITLE = 'Backtest de carteira de ações da B3'
const DESCRIPTION =
  'Simule o desempenho histórico de carteiras de ações da B3 com aportes mensais e rebalanceamento. Compare com CDI e Ibovespa e veja volatilidade, Sharpe e drawdown.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords:
    'backtest carteira ações, simular carteira B3, backtest histórico ações, simulação de aportes mensais, rebalanceamento de carteira, drawdown, índice de Sharpe',
  alternates: { canonical: '/backtest' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: '/backtest',
    siteName: 'Preço Justo AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

/** Mês corrente no fuso de Brasília ({ year, month 0–11 }): servidor e navegador montam a mesma carteira de exemplo. */
function currentMonthInBrazil() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1
  return { year, month }
}

function ToolFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando backtest" />
    </div>
  )
}

/**
 * Visitante: landing pública (200, indexável). Logado sem Premium: card de upgrade. Premium: ferramenta e, na
 * ferramenta vazia (sem configuração na URL), a vitrine com "Abrir no backtest".
 */
export default async function BacktestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <BacktestLanding />

  const user = await getCurrentUser()
  const params = await searchParams
  const freshTool = !!user?.isPremium && !params.configId && !params.view

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6">
        <PageHeader
          title="Backtest de carteira"
          description="Simule o desempenho histórico de uma carteira de ações da B3 com aportes e rebalanceamento."
          className="mb-6"
        />
        {user?.isPremium ? (
          <Suspense fallback={<ToolFallback />}>
            <BacktestPageClient exampleMonth={currentMonthInBrazil()} />
          </Suspense>
        ) : (
          <BacktestUpgradeCard />
        )}
      </div>
      {freshTool && (
        <Suspense fallback={null}>
          <BacktestShowcaseSection viewer="premium" className="border-t border-b-0" />
        </Suspense>
      )}
    </div>
  )
}
