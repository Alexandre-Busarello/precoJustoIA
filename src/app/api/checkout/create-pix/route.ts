import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPixPayment } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário está autenticado
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const { planType, userEmail, userName } = await request.json()

    if (!planType || !['monthly', 'annual'].includes(planType)) {
      return NextResponse.json(
        { error: 'Tipo de plano inválido' },
        { status: 400 }
      )
    }

    // Buscar dados do usuário no banco
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o usuário já tem uma assinatura ativa
    if (user.subscriptionTier === 'PREMIUM' && user.premiumExpiresAt && user.premiumExpiresAt > new Date()) {
      return NextResponse.json(
        { error: 'Usuário já possui uma assinatura ativa' },
        { status: 400 }
      )
    }

    // Gerar chave de idempotência única
    const idempotencyKey = `pix-${user.id}-${planType}-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // Criar pagamento PIX direto no MercadoPago
    const pixPayment = await createPixPayment({
      planType: planType as 'monthly' | 'annual',
      userId: user.id,
      userEmail: userEmail || user.email,
      userName: userName || user.name || undefined,
      idempotencyKey,
    })

    return NextResponse.json({
      id: pixPayment.id,
      status: pixPayment.status,
      qr_code: pixPayment.qr_code,
      qr_code_base64: pixPayment.qr_code_base64,
      ticket_url: pixPayment.ticket_url,
    })
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
