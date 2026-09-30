import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { OptimizedCheckout } from '@/components/optimized-checkout'

export const metadata: Metadata = {
  title: 'Assinar o Premium',
  description: 'Assine o plano Premium e tenha acesso aos 8 modelos de valuation, à síntese com IA e ao uso ilimitado das ferramentas.',
  robots: {
    index: false,
    follow: false,
  },
}

interface CheckoutPageProps {
  searchParams: Promise<{
    plan?: string
    redirect?: string
    email?: string
  }>
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams
  const plan = params.plan === 'monthly' || params.plan === 'annual' ? params.plan : undefined
  const session = await getServerSession(authOptions)

  if (!session) {
    const checkoutParams = new URLSearchParams()
    if (plan) checkoutParams.set('plan', plan)
    if (params.redirect) checkoutParams.set('redirect', params.redirect)

    const callbackUrl = checkoutParams.toString()
      ? `/checkout?${checkoutParams.toString()}`
      : '/checkout'

    redirect(`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  // Usuário logado com parceiro vinculado → redirecionar direto para o checkout do parceiro.
  // Busca direta no banco para garantir consistência independente do estado do JWT.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      partnerId: true,
      partner: { select: { checkoutUrl: true } },
    },
  })

  if (dbUser?.partner?.checkoutUrl) {
    const url = new URL(dbUser.partner.checkoutUrl)
    if (session.user.email) url.searchParams.set('email', session.user.email)
    redirect(url.toString())
  }

  return <OptimizedCheckout initialPlan={plan} />
}
