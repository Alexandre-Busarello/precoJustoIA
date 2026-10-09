import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-service'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { ALLOCATION_RATE_LIMIT } from '@/lib/allocation/rate-limit'
import { simulateRequestSchema } from '@/lib/allocation/schema'
import { AllocationError, simulateAllocation } from '@/lib/allocation/service'

export const maxDuration = 60

/**
 * POST /api/allocation/simulate — distribuição simulada de um aporte (determinística, sem IA).
 * Visitantes: até 3 tickers e o modelo gratuito (Graham). Plano gratuito: o mesmo, mais a própria carteira. Acima do
 * limite de tickers, ou com radar ou "Todo o mercado", a resposta vem com `locked` e uma prévia sem ativos nem valores.
 * Premium: tudo liberado.
 */
export async function POST(request: NextRequest) {
  return withRateLimit(request, ALLOCATION_RATE_LIMIT, async () => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
    }
    const parsed = simulateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', issues: parsed.error.issues.map((i) => i.message) }, { status: 400 })
    }
    try {
      const user = await getCurrentUser()
      const response = await simulateAllocation(parsed.data, { userId: user?.id ?? null, isPremium: !!user?.isPremium })
      return NextResponse.json(response)
    } catch (error) {
      if (error instanceof AllocationError) return NextResponse.json({ error: error.message }, { status: error.status })
      console.error('[allocation/simulate] erro:', error)
      return NextResponse.json({ error: 'Não foi possível calcular a distribuição agora.' }, { status: 500 })
    }
  })
}
