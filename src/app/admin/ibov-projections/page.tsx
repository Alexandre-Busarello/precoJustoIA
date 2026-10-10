/**
 * Página Admin: faixas estatísticas do Ibovespa
 */

import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/user-service'
import { IbovProjectionsManager } from '@/components/admin/ibov-projections-manager'

export const metadata: Metadata = {
  title: 'Admin: projeções do Ibovespa',
  description: 'Estado das faixas estatísticas do Ibovespa e registros diários',
  robots: { index: false, follow: false },
}

export default async function AdminIbovProjectionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/admin/ibov-projections')
  }

  const user = await requireAdminUser()

  if (!user) {
    redirect('/?error=access-denied')
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8">
      <div className="container mx-auto max-w-6xl px-4">
        <IbovProjectionsManager />
      </div>
    </div>
  )
}
