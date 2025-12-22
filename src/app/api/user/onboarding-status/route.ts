import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { prisma } from '@/lib/prisma'
import { safeQueryWithParams } from '@/lib/prisma-wrapper'

/**
 * GET /api/user/onboarding-status
 * Retorna o status do onboarding do usuário atual
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado', shouldShowOnboarding: false },
        { status: 401 }
      )
    }

    // Buscar dados do onboarding do usuário
    const userData = await safeQueryWithParams(
      'user-onboarding-status',
      () => prisma.user.findUnique({
        where: { id: user.id },
        select: {
          name: true,
          lastOnboardingSeenAt: true,
          onboardingAcquisitionSource: true,
          onboardingExperienceLevel: true,
          onboardingInvestmentFocus: true,
        }
      }),
      { userId: user.id }
    ) as any

    if (!userData) {
      return NextResponse.json(
        { error: 'Usuário não encontrado', shouldShowOnboarding: false },
        { status: 404 }
      )
    }

    // Mostrar onboarding se lastOnboardingSeenAt é null
    const shouldShowOnboarding = userData.lastOnboardingSeenAt === null

    // Verificar quais perguntas foram puladas (null)
    const missingQuestions = []
    if (!userData.onboardingAcquisitionSource) {
      missingQuestions.push('acquisition')
    }
    if (!userData.onboardingExperienceLevel) {
      missingQuestions.push('experience')
    }
    if (!userData.onboardingInvestmentFocus) {
      missingQuestions.push('focus')
    }

    return NextResponse.json({
      shouldShowOnboarding,
      lastOnboardingSeenAt: userData.lastOnboardingSeenAt,
      name: userData.name,
      onboardingAcquisitionSource: userData.onboardingAcquisitionSource,
      onboardingExperienceLevel: userData.onboardingExperienceLevel,
      onboardingInvestmentFocus: userData.onboardingInvestmentFocus,
      missingQuestions, // Perguntas que foram puladas
      hasMissingQuestions: missingQuestions.length > 0, // Se tem perguntas faltando
    })
  } catch (error) {
    console.error('Erro ao buscar status do onboarding:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', shouldShowOnboarding: false },
      { status: 500 }
    )
  }
}

