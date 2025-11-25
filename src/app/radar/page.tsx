import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RadarPageContent } from '@/components/radar-page-content'

export default async function RadarPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/radar')
  }

  return <RadarPageContent />
}

