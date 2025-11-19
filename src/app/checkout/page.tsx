import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { OptimizedCheckout } from '@/components/optimized-checkout'

export const metadata: Metadata = {
  title: 'Checkout Premium - Preço Justo AI',
  description: 'Assine o plano Premium e tenha acesso completo às análises avançadas de ações',
}

interface CheckoutPageProps {
  searchParams: { 
    plan?: 'monthly' | 'annual'
    redirect?: string
  }
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    // Construir URL de callback preservando todos os parâmetros
    const params = new URLSearchParams()
    params.set('callbackUrl', '/checkout')
    
    // Preservar parâmetros do checkout
    if (searchParams.plan) {
      params.append('plan', searchParams.plan)
    }
    if (searchParams.redirect) {
      params.append('redirect', searchParams.redirect)
    }
    
    // Se há parâmetros adicionais, incluir na callback URL
    const checkoutParams = new URLSearchParams()
    if (searchParams.plan) checkoutParams.set('plan', searchParams.plan)
    if (searchParams.redirect) checkoutParams.set('redirect', searchParams.redirect)
    
    const callbackUrl = checkoutParams.toString() 
      ? `/checkout?${checkoutParams.toString()}`
      : '/checkout'
    
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  const initialPlan = searchParams.plan || 'monthly'

  return <OptimizedCheckout initialPlan={initialPlan} />
}