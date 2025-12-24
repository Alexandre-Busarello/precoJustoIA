import { NextRequest, NextResponse } from "next/server"
import { verifyEmailToken } from "@/lib/email-verification-service"
import { startTrialAfterEmailVerification } from "@/lib/trial-service"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    // Obter returnUrl da query string ou do cookie
    const returnUrlFromQuery = searchParams.get('returnUrl')
    const returnUrlFromCookie = request.cookies.get('returnUrl')?.value
    const returnUrl = returnUrlFromQuery || returnUrlFromCookie || null

    if (!token) {
      const errorUrl = new URL('/verificar-email?error=token_required', request.url)
      if (returnUrl) {
        errorUrl.searchParams.set('returnUrl', returnUrl)
      }
      return NextResponse.redirect(errorUrl)
    }

    // Verificar token
    const result = await verifyEmailToken(token)

    if (!result.success) {
      const errorUrl = new URL(`/verificar-email?error=${encodeURIComponent(result.error || 'invalid_token')}`, request.url)
      if (returnUrl) {
        errorUrl.searchParams.set('returnUrl', returnUrl)
      }
      return NextResponse.redirect(errorUrl)
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

    // Redirecionar para página de sucesso, preservando returnUrl se fornecido
    const successUrl = new URL('/verificar-email?success=true', request.url)
    
    if (returnUrl) {
      successUrl.searchParams.set('returnUrl', returnUrl)
    }
    
    const response = NextResponse.redirect(successUrl)
    
    // Limpar cookie após uso se foi usado do cookie
    if (returnUrlFromCookie) {
      response.cookies.delete('returnUrl')
    }
    
    return response
  } catch (error) {
    console.error('Erro ao verificar email:', error)
    const errorUrl = new URL('/verificar-email?error=server_error', request.url)
    const returnUrl = request.nextUrl.searchParams.get('returnUrl')
    if (returnUrl) {
      errorUrl.searchParams.set('returnUrl', returnUrl)
    }
    return NextResponse.redirect(errorUrl)
  }
}

