import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const partner = await prisma.partner.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, lpUrl: true, checkoutUrl: true },
  })

  if (!partner) {
    return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 })
  }

  return NextResponse.json(partner)
}
