import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/user-service'
import AdminTicketDashboard from '@/components/admin-ticket-dashboard'

export const metadata: Metadata = {
  title: 'Painel Administrativo - Tickets | Preço Justo AI',
  description: 'Painel administrativo para gerenciamento de tickets de suporte.',
}

export default async function AdminTicketsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/admin/tickets')
  }

  // Verificar se o usuário é admin - ÚNICA FONTE DA VERDADE
  const user = await requireAdminUser()

  if (!user) {
    console.log('❌ Acesso negado - usuário não é admin')
    redirect('/?error=access-denied')
  }

  console.log('✅ Acesso admin autorizado para:', user.email)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-4 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Painel Administrativo - Tickets
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Gerencie todos os tickets de suporte da plataforma
            </p>
          </div>

          <AdminTicketDashboard />
        </div>
      </div>
    </div>
  )
}
