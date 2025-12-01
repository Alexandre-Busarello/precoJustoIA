import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DebtCalculator } from '@/components/debt-calculator'

export const metadata: Metadata = {
  title: 'Dashboard - Arbitragem de Dívida | Preço Justo AI',
  description: 'Gerencie suas dívidas e execute simulações de arbitragem',
  robots: 'noindex, nofollow'
}

export default async function ArbitragemDividaDashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/arbitragem-divida')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Dashboard - Arbitragem de Dívida
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas dívidas e execute simulações comparativas
          </p>
        </div>

        <DebtCalculator isPublic={false} />
      </div>
    </div>
  )
}

