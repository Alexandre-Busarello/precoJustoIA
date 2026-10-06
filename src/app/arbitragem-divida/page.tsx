import { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Lock } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { DebtCalculator } from '@/components/debt-calculator'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Arbitragem de dívida: amortizar ou investir',
  description:
    'Simule, mês a mês, se compensa amortizar um financiamento antes do prazo ou manter o dinheiro investido. Compare as estratégias de amortização total e híbrida.',
  keywords: ['arbitragem dívida', 'amortizar dívida', 'investir vs amortizar', 'simulador dívida', 'calculadora financeira'],
  alternates: {
    canonical: '/arbitragem-divida',
  },
  openGraph: {
    title: 'Arbitragem de dívida: amortizar ou investir',
    description: 'Simule se compensa amortizar um financiamento antes do prazo ou manter o dinheiro investido.',
    type: 'website',
    url: '/arbitragem-divida',
  },
}

const concepts = [
  {
    title: 'Estratégia Sniper (100% amortização)',
    text: 'Toda a sobra do orçamento vai para quitar a dívida. Nada é investido enquanto houver saldo devedor; depois de quitar, prestação e sobra viram investimento.',
  },
  {
    title: 'Estratégia híbrida (valor fixo)',
    text: 'Um valor fixo é investido todo mês, mantendo o hábito de investir, e o restante da sobra amortiza a dívida.',
  },
  {
    title: 'Break-even',
    text: 'O mês em que o patrimônio investido passa o saldo devedor. A partir dele, seria possível vender os investimentos e quitar a dívida à vista.',
  },
]

const premiumSources = [
  { title: 'Carteira', text: 'Rentabilidade calculada a partir dos ativos que você já tem na carteira.' },
  { title: 'Rankings', text: 'Rentabilidade esperada dos ativos de um modelo, como Graham ou Fórmula Mágica.' },
  { title: 'Tickers', text: 'Rentabilidade calculada para os tickers que você escolher, com dados reais.' },
]

export default async function ArbitragemDividaPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session
  const isPremium = isLoggedIn ? (await getCurrentUser())?.isPremium || false : false

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: 'Calculadoras', href: '/calculadoras' }, { label: 'Arbitragem de dívida' }]}
        title="Arbitragem de dívida"
        description="Compare, mês a mês, amortizar a dívida antes do prazo com manter o dinheiro investido."
      />

      <DebtCalculator isPublic={!isLoggedIn} />

      {!isPremium && (
        <section className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">Rentabilidade com dados reais no Premium</h2>
              <p className="text-sm text-muted-foreground">
                No plano gratuito, a simulação usa uma taxa fixa. No Premium, a rentabilidade pode vir de:
              </p>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {premiumSources.map((item) => (
              <div key={item.title} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{item.title}</dt>
                <dd className="text-sm leading-6 text-muted-foreground">{item.text}</dd>
              </div>
            ))}
          </dl>
          <Button asChild size="sm" variant="outline">
            <Link href="/planos">Ver planos</Link>
          </Button>
        </section>
      )}

      <section className="space-y-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Como funciona</h2>
        <dl className="space-y-4">
          {concepts.map((item) => (
            <div key={item.title} className="space-y-1">
              <dt className="text-sm font-medium text-foreground">{item.title}</dt>
              <dd className="max-w-[68ch] text-sm leading-6 text-muted-foreground">{item.text}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          Simulação matemática com as premissas informadas. Não é recomendação de investimento.
        </p>
      </section>
    </div>
  )
}
