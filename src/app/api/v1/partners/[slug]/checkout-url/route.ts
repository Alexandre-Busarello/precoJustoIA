import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: partnerId } = await params
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { checkoutUrl: true },
  })

  if (!partner) {
    return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ checkoutUrl: partner.checkoutUrl })
}
