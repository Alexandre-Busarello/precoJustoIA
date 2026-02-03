/**
 * Página Admin: Gerenciar Projeções IBOV
 */

import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/user-service'
import { IbovProjectionsManager } from '@/components/admin/ibov-projections-manager'

export const metadata: Metadata = {
  title: 'Gerenciar Projeções IBOV - Admin',
  description: 'Gerencie e recrie projeções do IBOVESPA',
}

export default async function AdminIbovProjectionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/admin/ibov-projections')
  }

  // Verificar se o usuário é admin
  const user = await requireAdminUser()

  if (!user) {
    redirect('/?error=access-denied')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-4 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <IbovProjectionsManager />
        </div>
      </div>
    </div>
  )
}

