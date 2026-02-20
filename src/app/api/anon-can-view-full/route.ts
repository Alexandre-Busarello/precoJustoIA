import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkUsage } from '@/lib/usage-based-pricing-service'
import { RateLimitMiddleware } from '@/lib/rate-limit-middleware'

/**
 * GET /api/anon-can-view-full
 * Verifica se usuário anônimo tem direito a visualização completa (2 usos por IP).
 * Usado pelo use-premium-status como fonte da verdade para anônimos.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (session?.user?.id) {
      return NextResponse.json({ canViewFullContent: true })
    }

    // Anônimo: verificar limite de 2 usos por IP

    const ip = RateLimitMiddleware.getClientIP(request)
    const result = await checkUsage({
      userId: null,
      ip,
      feature: 'anon_full_view',
      resourceId: 'check',
    })

    return NextResponse.json({
      canViewFullContent: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
    })
  } catch (error) {
    console.error('[anon-can-view-full] Erro:', error)
    return NextResponse.json({ canViewFullContent: false })
  }
}
