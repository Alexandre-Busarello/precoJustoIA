import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { resendVerificationEmail } from "@/lib/email-verification-service"
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit-middleware"

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    {
      ...RATE_LIMIT_CONFIGS.API_GENERAL,
      endpoint: 'resend-verification',
      window1Min: 3, // Máximo 3 tentativas por minuto
      window1Hour: 10, // Máximo 10 tentativas por hora
    },
    async () => {
      try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
          return NextResponse.json(
            { message: "Não autenticado" },
            { status: 401 }
          )
        }

        const result = await resendVerificationEmail(session.user.id)

        if (!result.success) {
          return NextResponse.json(
            { message: result.error || "Erro ao reenviar email" },
            { status: 400 }
          )
        }

        return NextResponse.json(
          { 
            message: result.message || "Email de verificação enviado com sucesso!" 
          },
          { status: 200 }
        )
      } catch (error) {
        console.error("Erro ao reenviar email de verificação:", error)
        return NextResponse.json(
          { message: "Erro interno do servidor" },
          { status: 500 }
        )
      }
    }
  )
}

