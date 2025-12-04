import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { QuizPageClient } from '@/components/quiz-page-client'

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string }> }): Promise<Metadata> {
  return {
    title: 'Responder Quiz',
    description: 'Responda ao quiz',
  }
}

export default async function QuizPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect(`/login?callbackUrl=/quiz/${resolvedParams.campaignId}`)
  }

  return <QuizPageClient campaignId={resolvedParams.campaignId} />
}

