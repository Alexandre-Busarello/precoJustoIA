"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { CheckCircle2, XCircle, Mail, Loader2 } from "lucide-react"
import Link from "next/link"
import { invalidateEmailVerifiedCache } from "@/hooks/use-user-data"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const [resendError, setResendError] = useState("")

  const success = searchParams.get('success')
  const error = searchParams.get('error')

  useEffect(() => {
    // Se verificação foi bem-sucedida, invalidar cache de email verification
    if (success === 'true') {
      invalidateEmailVerifiedCache(queryClient)
    }
  }, [success, queryClient])

  useEffect(() => {
    // Se verificação foi bem-sucedida e usuário está logado, redirecionar após 3 segundos
    if (success === 'true' && status === 'authenticated') {
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [success, status, router])

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
        setResendMessage(data.message || "Email de verificação reenviado com sucesso!")
      } else {
        setResendError(data.message || "Erro ao reenviar email")
      }
    } catch (error) {
      setResendError("Erro ao reenviar email. Tente novamente mais tarde.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          {success === 'true' ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl text-green-600">Email Verificado!</CardTitle>
              <CardDescription>
                Sua conta foi verificada com sucesso. Você será redirecionado em instantes...
              </CardDescription>
            </>
          ) : error ? (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <CardTitle className="text-2xl text-red-600">Erro na Verificação</CardTitle>
              <CardDescription className="text-red-500">
                {error === 'token_required' && 'Token de verificação não fornecido.'}
                {error === 'invalid_token' && 'Token inválido ou expirado. Solicite um novo link de verificação.'}
                {error === 'server_error' && 'Erro no servidor. Tente novamente mais tarde.'}
                {!['token_required', 'invalid_token', 'server_error'].includes(error) && 'Erro ao verificar email.'}
              </CardDescription>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Mail className="h-16 w-16 text-blue-500" />
              </div>
              <CardTitle className="text-2xl">Verifique seu Email</CardTitle>
              <CardDescription>
                Enviamos um link de verificação para seu email. Clique no link para ativar sua conta e iniciar seu período de trial de 7 dias.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {success !== 'true' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-semibold mb-2">
                  ⚠️ Importante: Seu trial de 7 dias só será ativado após verificar o email
                </p>
                <p className="text-sm text-blue-700 mb-2">
                  Você pode usar a plataforma normalmente, mas para ativar todas as funcionalidades Premium e iniciar seu período de trial, é necessário verificar seu email.
                </p>
                <p className="text-sm text-blue-800 font-semibold mt-3 mb-2">
                  Não recebeu o email?
                </p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Verifique sua pasta de spam/lixo eletrônico</li>
                  <li>O link expira em 24 horas</li>
                  <li>Certifique-se de usar o mesmo email do cadastro</li>
                </ul>
              </div>

              {status === 'authenticated' && (
                <div className="space-y-2">
                  <Button
                    onClick={handleResend}
                    disabled={isResending}
                    className="w-full"
                    variant="outline"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Reenviar Email de Verificação
                      </>
                    )}
                  </Button>

                  {resendMessage && (
                    <p className="text-sm text-green-600 text-center">{resendMessage}</p>
                  )}

                  {resendError && (
                    <p className="text-sm text-red-600 text-center">{resendError}</p>
                  )}
                </div>
              )}

              {status === 'unauthenticated' && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600">
                    Faça login para reenviar o email de verificação.
                  </p>
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      Fazer Login
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}

          {success === 'true' && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Seu período de trial de 7 dias foi iniciado automaticamente!
              </p>
              <Link href="/dashboard">
                <Button className="w-full">
                  Ir para Dashboard
                </Button>
              </Link>
            </div>
          )}

          {status === 'authenticated' && success !== 'true' && !error && (
            <div className="text-center space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-semibold mb-2">
                  Você já está logado!
                </p>
                <p className="text-sm text-yellow-700">
                  Você pode usar a plataforma normalmente. Para ativar seu período de trial de 7 dias e todas as funcionalidades Premium, verifique seu email clicando no link que enviamos.
                </p>
              </div>
              <Link href="/dashboard">
                <Button className="w-full">
                  Continuar para Dashboard
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            Voltar para página inicial
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

