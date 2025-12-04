import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAdminUser } from '@/lib/user-service'
import { AdminQuizDetailsPageClient } from '@/components/admin-quiz-details-page-client'

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string }> }): Promise<Metadata> {
  return {
    title: 'Detalhes do Quiz | Admin | Preço Justo AI',
    description: 'Visualize respostas e estatísticas do quiz',
  }
}

export default async function AdminQuizDetailsPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/quizzes/${resolvedParams.campaignId}`)
  }

  // Verificar se é admin
  await requireAdminUser()

  return <AdminQuizDetailsPageClient campaignId={resolvedParams.campaignId} />
}

