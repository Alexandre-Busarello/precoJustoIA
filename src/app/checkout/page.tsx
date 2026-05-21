import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { OptimizedCheckout } from '@/components/optimized-checkout'

export const metadata: Metadata = {
  title: 'Checkout Premium - Preço Justo AI',
  description: 'Assine o plano Premium e tenha acesso completo às análises avançadas de ações',
}

interface CheckoutPageProps {
  searchParams: {
    plan?: 'monthly' | 'annual'
    redirect?: string
    email?: string
  }
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    const checkoutParams = new URLSearchParams()
    if (searchParams.plan) checkoutParams.set('plan', searchParams.plan)
    if (searchParams.redirect) checkoutParams.set('redirect', searchParams.redirect)

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

  const initialPlan = searchParams.plan || 'monthly'

  return <OptimizedCheckout initialPlan={initialPlan} />
}