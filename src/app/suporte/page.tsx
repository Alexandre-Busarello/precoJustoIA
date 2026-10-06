import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import SupportCenter from '@/components/support-center'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Suporte',
  description: 'Central de suporte para assinantes Premium: abra chamados, acompanhe o status e converse com a equipe.',
  robots: { index: false, follow: false },
}

const PREMIUM_SUPPORT_ITEMS = [
  {
    title: 'Chamados organizados',
    description: 'Abra chamados por categoria e acompanhe o status e o histórico de cada um.',
  },
  {
    title: 'Prazo de resposta',
    description: 'Até 5 dias úteis, com média de 2 dias. Chamados sem resposta há mais de 48 horas ganham prioridade.',
  },
  {
    title: 'Dúvidas de uso e problemas técnicos',
    description: 'Ajuda para entender as ferramentas, reportar erros e sugerir melhorias.',
  },
]

export default async function SupportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login?callbackUrl=/suporte')

  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/suporte')

  if (user.isPremium) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:py-8">
        <PageHeader
          title="Suporte"
          description="Resposta em até 5 dias úteis (média de 2 dias). Chamados sem resposta há mais de 48 horas ganham prioridade."
        />
        <SupportCenter />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:py-8">
      <PageHeader
        title="Suporte"
        description="A central de chamados faz parte do plano Premium."
        actions={
          <Button asChild>
            <Link href="/planos">Ver planos</Link>
          </Button>
        }
      />

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {PREMIUM_SUPPORT_ITEMS.map((item) => (
          <li key={item.title} className="space-y-1 p-4 sm:px-5">
            <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">
        Dúvidas sobre a conta ou o plano gratuito? Use a página de{' '}
        <Link href="/contato" className="font-medium text-brand underline-offset-4 hover:underline">
          contato
        </Link>
        .
      </p>
    </div>
  )
}
