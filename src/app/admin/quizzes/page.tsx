import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { AdminQuizzesPageClient } from '@/components/admin-quizzes-page-client'

export const metadata: Metadata = {
  title: 'Gerenciar Quizzes | Admin | Preço Justo AI',
  description: 'Visualize e acompanhe respostas dos quizzes',
}

export default async function AdminQuizzesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/quizzes')
  }

  // Verificar se é admin
  await requireAdminUser()

  return <AdminQuizzesPageClient />
}

