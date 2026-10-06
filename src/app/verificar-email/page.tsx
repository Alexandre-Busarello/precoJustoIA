"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { invalidateEmailVerifiedCache } from "@/hooks/use-user-data"
import { GoogleAdsConversionPixel } from "@/components/google-ads-conversion-pixel"
import { AuthFallback, AuthShell } from "../login/auth-ui"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const queryClient = useQueryClient()
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const [resendError, setResendError] = useState("")

  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const returnUrl = searchParams.get('returnUrl')

  useEffect(() => {
    // Se verificação foi bem-sucedida, invalidar cache de email verification
    if (success === 'true') {
      invalidateEmailVerifiedCache(queryClient)
    }
  }, [success, queryClient])

  useEffect(() => {
    // Se verificação foi bem-sucedida e usuário está logado, redirecionar após 3 segundos
    // NÃO adicionar ?new_user=true aqui porque o pixel já foi disparado quando o usuário
    // chegou em /verificar-email?new_user=true após o cadastro (evita duplicação)
    if (success === 'true' && status === 'authenticated') {
      const timer = setTimeout(() => {
        // Redirecionar para returnUrl se fornecido, senão para dashboard
        const redirectUrl = returnUrl || '/dashboard'
        router.push(redirectUrl)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, status, router, returnUrl])

  const handleResend = async () => {
    setIsResending(true)
    setResendMessage("")
    setResendError("")

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage(data.message || "E-mail de verificação reenviado.")
      } else {
        setResendError(data.message || "Não foi possível reenviar o e-mail.")
      }
    } catch {
      setResendError("Não foi possível reenviar o e-mail. Tente novamente mais tarde.")
    } finally {
      setIsResending(false)
    }
  }

  const errorMessage =
    error === 'token_required'
      ? 'O link não trouxe o código de verificação.'
      : error === 'invalid_token'
        ? 'O link é inválido ou expirou. Peça um novo link abaixo.'
        : error === 'server_error'
          ? 'Erro no servidor. Tente novamente mais tarde.'
          : 'Não foi possível verificar o e-mail.'

  const continueHref = returnUrl || '/dashboard'

  return (
    <>
      {/* Pixel de conversão de quem chega após o cadastro por e-mail (antes da validação, para não perder a sessão). */}
      <GoogleAdsConversionPixel />
      {success === 'true' ? (
        <AuthShell
          title="E-mail verificado"
          description={
            status === 'authenticated'
              ? 'Seu dia de Premium grátis já começou. Redirecionando…'
              : 'Seu dia de Premium grátis já começou. Entre na sua conta para continuar.'
          }
        >
          <Button asChild className="w-full">
            {status === 'unauthenticated' ? (
              <Link href={`/login?callbackUrl=${encodeURIComponent(continueHref)}`}>Entrar</Link>
            ) : (
              <Link href={continueHref}>{returnUrl ? 'Continuar' : 'Ir para o painel'}</Link>
            )}
          </Button>
        </AuthShell>
      ) : (
        <AuthShell
          title={error ? 'Não foi possível verificar' : 'Verifique seu e-mail'}
          description={
            error
              ? errorMessage
              : 'Enviamos um link de verificação. Ao confirmar, seu dia de Premium grátis começa.'
          }
          footer={
            <Link href="/" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline sm:min-h-0">
              Voltar para o início
            </Link>
          }
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            <li>O link vale por 24 horas.</li>
            <li>Não chegou? Veja a pasta de spam.</li>
            <li>Você já pode usar os recursos gratuitos enquanto isso.</li>
          </ul>

          {status === 'authenticated' && (
            <div className="space-y-3">
              {!error && (
                <Button asChild className="w-full">
                  <Link href="/dashboard">Continuar para o painel</Link>
                </Button>
              )}
              <Button onClick={handleResend} disabled={isResending} className="w-full" variant="outline">
                {isResending && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                {isResending ? 'Enviando…' : 'Reenviar e-mail de verificação'}
              </Button>
              {resendMessage && (
                <p className="text-center text-sm text-positive" role="status">
                  {resendMessage}
                </p>
              )}
              {resendError && (
                <p className="text-center text-sm text-negative" role="alert">
                  {resendError}
                </p>
              )}
            </div>
          )}

          {status === 'unauthenticated' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Entre na sua conta para reenviar o e-mail de verificação.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Entrar</Link>
              </Button>
            </div>
          )}
        </AuthShell>
      )}
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
