"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, X } from "lucide-react"
import Link from "next/link"

export function EmailVerificationBanner() {
  const { data: session, status } = useSession()
  const [isDismissed, setIsDismissed] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificar se o banner foi dispensado (localStorage)
    const dismissed = localStorage.getItem('email-verification-banner-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
      setIsLoading(false)
      return
    }

    // Verificar status de verificação de email apenas se usuário está autenticado
    if (status === 'authenticated' && session?.user?.id) {
      fetch('/api/user/email-verified')
        .then(res => res.json())
        .then(data => {
          setEmailVerified(data.verified === true)
          setIsLoading(false)
        })
        .catch(() => {
          // Em caso de erro, não mostrar o banner (evitar falsos positivos)
          setEmailVerified(true)
          setIsLoading(false)
        })
    } else if (status === 'unauthenticated') {
      setIsLoading(false)
    }
  }, [session, status])

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('email-verification-banner-dismissed', 'true')
  }

  // Não mostrar se:
  // - Não está autenticado
  // - Foi dispensado
  // - Email já está verificado
  // - Ainda está carregando
  if (status !== 'authenticated' || !session || isDismissed || emailVerified === true || isLoading) {
    return null
  }

  // Se email não está verificado, mostrar banner
  if (emailVerified === false) {
    return (
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 relative mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardContent className="p-4 pr-10">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Verifique seu email para ativar seu trial de 7 dias
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Seu período de trial Premium só será ativado após verificar seu email. Você pode usar a plataforma normalmente, mas algumas funcionalidades Premium estarão limitadas.
              </p>
              <Link href="/verificar-email">
                <Button size="sm" variant="outline" className="text-xs">
                  Verificar Email
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

