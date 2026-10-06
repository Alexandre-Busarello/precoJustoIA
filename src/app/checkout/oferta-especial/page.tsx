import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SpecialOfferCheckout } from '@/components/special-offer-checkout'

export const metadata: Metadata = {
  title: 'Oferta especial Premium',
  description: 'Condição especial do plano Premium por tempo limitado.',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SpecialOfferCheckoutPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/checkout/oferta-especial')}`)
  }

  return <SpecialOfferCheckout />
}
