import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/user-service'
import { loadAgendaData } from './agenda-data'
import { AgendaProventosClient } from './agenda-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agenda de proventos',
  description: 'Datas ex, pagamentos e valores dos proventos da sua carteira e do seu radar, com renda mensal estimada e exportação para o calendário.',
  robots: { index: false, follow: false },
}

export default async function AgendaProventosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/agenda-proventos')

  const data = await loadAgendaData(user.id)
  return <AgendaProventosClient data={data} />
}
