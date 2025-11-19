import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'
import { recordIPRegistration } from '@/lib/ip-protection-service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/process-oauth
 * Processa OAuth após login para registrar IP de registro/login
 * Deve ser chamado após login OAuth bem-sucedido
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Capturar IP do request
    const ip = RateLimitMiddleware.getClientIP(request)

    // Verificar se é novo usuário (criado há menos de 5 minutos)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        createdAt: true,
        emailVerified: true
      }
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const timeDiff = now.getTime() - dbUser.createdAt.getTime()
    const minutesDiff = timeDiff / (1000 * 60)
    const isNewUser = minutesDiff < 5

    // Se é novo usuário, registrar IP de registro
    if (isNewUser) {
      await recordIPRegistration(ip, user.id)
      console.log(`[OAUTH] IP de registro registrado para novo usuário ${user.id}: ${ip}`)
    }

    // Sempre atualizar IP de login
    const { updateLastLoginIP } = await import('@/lib/ip-protection-service')
    await updateLastLoginIP(user.id, ip)
    console.log(`[OAUTH] IP de login atualizado para usuário ${user.id}: ${ip}`)

    return NextResponse.json({ 
      success: true,
      isNewUser,
      registrationIpRecorded: isNewUser
    })
  } catch (error) {
    console.error('Error processing OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

