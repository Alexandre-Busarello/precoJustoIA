import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { ALLOCATION_REGISTER_RATE_LIMIT } from '@/lib/allocation/rate-limit'
import { simulateRequestSchema } from '@/lib/allocation/schema'
import { AllocationError, registerAllocationPurchases } from '@/lib/allocation/service'

/**
 * POST /api/allocation/register — Premium: refaz a simulação no servidor e grava o aporte e as compras como
 * transações PENDENTES na carteira (o usuário confirma em Sugestões). Nunca confirma sozinho.
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, ALLOCATION_REGISTER_RATE_LIMIT, async () => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Entre na sua conta para registrar as compras.' }, { status: 401 })
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }
    const parsed = simulateRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    try {
      const result = await registerAllocationPurchases(parsed.data, { userId: user.id, isPremium: user.isPremium })
      return NextResponse.json(result)
    } catch (error) {
      if (error instanceof AllocationError) return NextResponse.json({ error: error.message }, { status: error.status })
      console.error('[allocation/register] erro:', error)
      return NextResponse.json({ error: 'Não foi possível registrar as compras agora.' }, { status: 500 })
    }
  })
}
