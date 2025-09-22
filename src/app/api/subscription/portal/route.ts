import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerPortal } from '@/lib/subscription-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { returnUrl } = await request.json()

    if (!returnUrl) {
      return NextResponse.json(
        { error: 'URL de retorno é obrigatória' },
        { status: 400 }
      )
    }

    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Usuário não possui conta no Stripe' },
        { status: 400 }
      )
    }

    // Criar sessão do portal do cliente
    const portalUrl = await createCustomerPortal(user.id, returnUrl)

    return NextResponse.json({
      success: true,
      url: portalUrl,
    })
  } catch (error) {
    console.error('Erro ao criar portal do cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
