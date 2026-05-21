import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PartnerLpClient } from '@/components/parceiros/partner-lp-client'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const partner = await prisma.partner.findUnique({
    where: { slug },
    select: { name: true },
  })
  return { title: partner ? `${partner.name} × Preço Justo AI` : 'Parceiro' }
}

export default async function PartnerLandingPage({ params }: Props) {
  const { slug } = await params
  const partner = await prisma.partner.findUnique({
    where: { slug },
    select: { id: true, name: true, checkoutUrl: true },
  })

  if (!partner) {
    notFound()
  }

  return (
    <PartnerLpClient
      partnerId={partner.id}
      partnerName={partner.name}
      partnerCheckoutUrl={partner.checkoutUrl}
    />
  )
}
