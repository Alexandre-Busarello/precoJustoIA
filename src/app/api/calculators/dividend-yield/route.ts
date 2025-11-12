import { NextRequest, NextResponse } from "next/server"
import { calculateDividendYield } from "@/lib/dividend-yield-calculator"
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit-middleware"

/**
 * API para calcular dividend yield e projeção de renda
 * 
 * POST /api/calculators/dividend-yield
 * Body: { ticker: string, investmentAmount: number }
 */
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    RATE_LIMIT_CONFIGS.REGISTER, // Usar mesmo rate limit de registro
    async () => {
      try {
        const body = await request.json()
        const { ticker, investmentAmount } = body

        // Validações
        if (!ticker || typeof ticker !== "string") {
          return NextResponse.json(
            { success: false, error: "Ticker é obrigatório" },
            { status: 400 }
          )
        }

        if (!investmentAmount || typeof investmentAmount !== "number" || investmentAmount <= 0) {
          return NextResponse.json(
            { success: false, error: "Valor investido deve ser um número positivo" },
            { status: 400 }
          )
        }

        // Normalizar ticker
        const normalizedTicker = ticker.toUpperCase().trim()

        // Calcular dividend yield
        const result = await calculateDividendYield(normalizedTicker, investmentAmount)

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          )
        }

        // Retornar resultado básico (sempre visível)
        return NextResponse.json({
          success: true,
          data: result.data,
          hasFullReport: false, // Flag para indicar que relatório completo requer cadastro
        })
      } catch (error) {
        console.error("Erro ao calcular dividend yield:", error)
        return NextResponse.json(
          {
            success: false,
            error: "Erro ao processar cálculo. Tente novamente.",
          },
          { status: 500 }
        )
      }
    }
  )
}

