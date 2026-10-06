import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { QuizPageClient } from '@/components/quiz-page-client'

export const metadata: Metadata = {
  title: 'Responder quiz',
  description: 'Responda ao quiz da equipe Preço Justo AI.',
  robots: { index: false, follow: false },
}

export default async function QuizPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/login?callbackUrl=/quiz/${campaignId}`)
  }

  return <QuizPageClient campaignId={campaignId} />
}
