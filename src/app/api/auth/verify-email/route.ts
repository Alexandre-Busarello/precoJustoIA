import { NextRequest, NextResponse } from "next/server"
import { verifyEmailToken } from "@/lib/email-verification-service"
import { startTrialAfterEmailVerification } from "@/lib/trial-service"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/verificar-email?error=token_required', request.url)
      )
    }

    // Verificar token
    const result = await verifyEmailToken(token)

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/verificar-email?error=${encodeURIComponent(result.error || 'invalid_token')}`, request.url)
      )
    }

    // Iniciar trial após verificação de email
    if (result.userId) {
      try {
        await startTrialAfterEmailVerification(result.userId)
      } catch (error) {
        console.error('Erro ao iniciar trial após verificação:', error)
        // Não falhar a verificação se houver erro ao iniciar trial
      }
    }

    // Redirecionar para página de sucesso
    return NextResponse.redirect(
      new URL('/verificar-email?success=true', request.url)
    )
  } catch (error) {
    console.error('Erro ao verificar email:', error)
    return NextResponse.redirect(
      new URL('/verificar-email?error=server_error', request.url)
    )
  }
}

