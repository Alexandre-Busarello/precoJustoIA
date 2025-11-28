import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NotificationsPageClient } from '@/components/notifications-page-client'

export const metadata: Metadata = {
  title: 'Notificações | Preço Justo AI',
  description: 'Visualize todas as suas notificações',
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/notificacoes')
  }

  return <NotificationsPageClient />
}

