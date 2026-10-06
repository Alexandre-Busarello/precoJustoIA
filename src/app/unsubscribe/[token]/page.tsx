import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Cancelar inscrição',
  description: 'Cancelamento de alertas por e-mail do Preço Justo AI.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ token: string }>
}

function ResultCard({
  status,
  title,
  children,
  actions,
}: {
  status: 'success' | 'error'
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  const Icon = status === 'success' ? CheckCircle2 : XCircle
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center sm:p-8">
        <Icon
          className={status === 'success' ? 'mx-auto size-6 text-positive' : 'mx-auto size-6 text-muted-foreground'}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
        <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">{actions}</div>
      </section>
    </div>
  )
}

const homeButton = (variant: 'default' | 'outline') => (
  <Button asChild variant={variant}>
    <Link href="/">Página inicial</Link>
  </Button>
)

export default async function UnsubscribePage({ params }: PageProps) {
  const { token } = await params

  if (!token || token.length < 10) notFound()

  try {
    const subscription = await safeQueryWithParams(
      'subscription-by-unsubscribe-token',
      () =>
        prisma.userAssetSubscription.findFirst({
          where: { unsubscribeToken: token },
          include: { company: { select: { ticker: true, name: true } } },
        }),
      { token }
    )

    if (!subscription) {
      return (
        <ResultCard status="error" title="Link inválido" actions={homeButton('default')}>
          <p>Este link de cancelamento não é válido ou já foi usado.</p>
        </ResultCard>
      )
    }

    await safeWrite(
      'delete-subscription-by-token',
      () => prisma.userAssetSubscription.deleteMany({ where: { unsubscribeToken: token } }),
      ['user_asset_subscriptions']
    )

    const ticker = subscription.company.ticker
    const companyName = subscription.company.name || ticker

    return (
      <ResultCard
        status="success"
        title="Inscrição cancelada"
        actions={
          <>
            <Button asChild>
              <Link href={`/acao/${ticker.toLowerCase()}`}>Ver análise de {ticker}</Link>
            </Button>
            {homeButton('outline')}
          </>
        }
      >
        <p>
          Você não receberá mais e-mails sobre <span className="font-medium text-foreground">{ticker}</span> ({companyName}).
        </p>
        <p>Para voltar a acompanhar, inscreva-se de novo na página do ativo.</p>
      </ResultCard>
    )
  } catch (error) {
    console.error('Erro ao processar descadastro:', error)
    return (
      <ResultCard status="error" title="Não foi possível cancelar" actions={homeButton('default')}>
        <p>Ocorreu um erro ao processar o cancelamento. Tente novamente mais tarde.</p>
      </ResultCard>
    )
  }
}
