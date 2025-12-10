import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SpecialOfferCheckout } from '@/components/special-offer-checkout'

export const metadata: Metadata = {
  title: 'Oferta Especial Premium - Preço Justo AI',
  description: 'Aproveite nossa oferta especial e tenha acesso completo às análises avançadas de ações',
}

export default async function SpecialOfferCheckoutPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/checkout/oferta-especial')}`)
  }

  return <SpecialOfferCheckout />
}

