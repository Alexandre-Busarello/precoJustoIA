import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BacktestLanding } from '@/app/backtest/backtest-landing'

const TITLE = 'Backtesting de carteiras de investimento'
const DESCRIPTION =
  'Simule o desempenho histórico de carteiras de ações da B3 com aportes mensais e rebalanceamento. Compare com CDI e Ibovespa e veja volatilidade, Sharpe e drawdown.'

// Página duplicada de /backtest: o conteúdo é o mesmo e o canonical aponta para /backtest.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
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
}

export default async function BacktestingCarteirasPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/backtest')

  return <BacktestLanding />
}
