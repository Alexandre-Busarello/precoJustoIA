import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { AdminNotificationsPageClient } from '@/components/admin-notifications-page-client'

export const metadata: Metadata = {
  title: 'Gerenciar Campanhas de Notificações | Admin | Preço Justo AI',
  description: 'Criar e gerenciar campanhas de notificações',
}

export default async function AdminNotificationsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/notifications')
  }

  // Verificar se é admin
  await requireAdminUser()

  return <AdminNotificationsPageClient />
}

