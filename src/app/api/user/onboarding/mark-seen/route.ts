import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'

/**
 * POST /api/user/onboarding/mark-seen
 * Marca que o usuário viu a modal de onboarding (atualiza lastOnboardingSeenAt)
 * Usado quando a modal aparece pela primeira vez, sem salvar dados ainda
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se já foi marcado antes (evitar atualizações desnecessárias)
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastOnboardingSeenAt: true }
    })

    // Se já foi marcado antes, não fazer nada (idempotente)
    if (userData?.lastOnboardingSeenAt !== null) {
      return NextResponse.json({
        success: true,
        message: 'Onboarding já foi visto anteriormente'
      })
    }

    // Marcar como visto (apenas lastOnboardingSeenAt, sem atualizar outros campos)
    await safeWrite(
      'mark-onboarding-seen',
      () => prisma.user.update({
        where: { id: user.id },
        data: {
          lastOnboardingSeenAt: new Date()
        }
      }),
      ['users']
    )

    return NextResponse.json({
      success: true,
      message: 'Onboarding marcado como visto'
    })
  } catch (error) {
    console.error('Erro ao marcar onboarding como visto:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

