import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeWrite } from '@/lib/prisma-wrapper'
import { z } from 'zod'

const onboardingSchema = z.object({
  name: z.string().nullable().optional(),
  acquisitionSource: z.string().nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  investmentFocus: z.string().nullable().optional(),
})

/**
 * POST /api/user/onboarding
 * Salva as respostas do onboarding do usuário
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

    const body = await request.json()
    const validatedData = onboardingSchema.parse(body)
    const { name, acquisitionSource, experienceLevel, investmentFocus } = validatedData

    // Buscar dados atuais do usuário para preservar lastOnboardingSeenAt se já foi marcado
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastOnboardingSeenAt: true }
    })

    // Preparar dados para atualização
    // IMPORTANTE: Se lastOnboardingSeenAt já foi marcado (via mark-seen), preservar a data original
    // Caso contrário, atualizar com data atual
    const updateData: {
      lastOnboardingSeenAt?: Date
      name?: string | null
      onboardingAcquisitionSource?: string | null
      onboardingExperienceLevel?: string | null
      onboardingInvestmentFocus?: string | null
    } = {}

    // Só atualizar lastOnboardingSeenAt se ainda não foi marcado
    // Isso garante que a data de quando a modal apareceu seja preservada
    if (currentUser?.lastOnboardingSeenAt === null) {
      updateData.lastOnboardingSeenAt = new Date()
    }

    // Atualizar apenas os campos que foram fornecidos
    if (name !== undefined) {
      // Se name for uma string vazia ou null, manter null (não atualizar)
      // Se name tiver valor, trim e atualizar
      updateData.name = name && name.trim() ? name.trim() : null
    }
    if (acquisitionSource !== undefined) {
      updateData.onboardingAcquisitionSource = acquisitionSource
    }
    if (experienceLevel !== undefined) {
      updateData.onboardingExperienceLevel = experienceLevel
    }
    if (investmentFocus !== undefined) {
      updateData.onboardingInvestmentFocus = investmentFocus
    }

    await safeWrite(
      'update-user-onboarding',
      () => prisma.user.update({
        where: { id: user.id },
        data: updateData
      }),
      ['users']
    )

    return NextResponse.json({
      success: true,
      message: 'Dados do onboarding salvos com sucesso'
    })
  } catch (error) {
    console.error('Erro ao salvar dados do onboarding:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', errors: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

