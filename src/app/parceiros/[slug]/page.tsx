import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PartnerLpClient } from '@/components/parceiros/partner-lp-client'
import { ClubeDividendosLP } from '@/components/parceiros/clube-dos-dividendos'
import { LP_META } from '@/components/parceiros/clube-dos-dividendos/lp-data'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params

  if (slug === 'clube-dos-dividendos') {
    return {
      title: LP_META.title,
      description: LP_META.description,
      alternates: {
        canonical: LP_META.canonical,
      },
      openGraph: {
        title: LP_META.ogTitle,
        description: LP_META.ogDescription,
        url: `https://precojusto.ai${LP_META.canonical}`,
        type: 'website',
      },
    }
  }

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

  if (slug === 'clube-dos-dividendos') {
    return (
      <ClubeDividendosLP
        partnerId={partner.id}
        partnerCheckoutUrl={partner.checkoutUrl ?? ''}
      />
    )
  }

  return (
    <PartnerLpClient
      partnerId={partner.id}
      partnerName={partner.name}
      partnerCheckoutUrl={partner.checkoutUrl ?? ''}
    />
  )
}
