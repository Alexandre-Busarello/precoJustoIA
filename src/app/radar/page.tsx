import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RadarPageContent } from '@/components/radar-page-content'

export const metadata: Metadata = {
  title: 'Radar de oportunidades',
  description: 'Acompanhe score, estratégias, upside, posição técnica e sentimento dos seus ativos em uma única tabela.',
}

export default async function RadarPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/radar')
  }

  return <RadarPageContent />
}
