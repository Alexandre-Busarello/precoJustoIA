'use client'

import { useEffect, useState } from 'react'
import { usePaymentVerification } from '@/components/session-refresh-provider'
import { CheckCircle, RefreshCw } from 'lucide-react'

interface PaymentSuccessHandlerProps {
  isPremium: boolean
}

export function PaymentSuccessHandler({ isPremium: initialIsPremium }: PaymentSuccessHandlerProps) {
  const { startVerification, checkSession } = usePaymentVerification()
  const [isPremium, setIsPremium] = useState(initialIsPremium)
  const [isChecking, setIsChecking] = useState(!initialIsPremium)

  useEffect(() => {
    // Se o usuário ainda não é Premium, iniciar verificação
    if (!initialIsPremium) {
      startVerification()
      
      // Verificar periodicamente se a sessão foi atualizada
      const checkInterval = setInterval(async () => {
        const updatedUser = await checkSession()
        if (updatedUser && updatedUser.subscriptionTier === 'PREMIUM') {
          setIsPremium(true)
          setIsChecking(false)
          clearInterval(checkInterval)
        }
      }, 2000)

      // Parar verificação após 2 minutos
      const timeout = setTimeout(() => {
        setIsChecking(false)
        clearInterval(checkInterval)
      }, 120000)

      return () => {
        clearInterval(checkInterval)
        clearTimeout(timeout)
      }
    }
  }, [initialIsPremium, startVerification, checkSession])

  if (isChecking && !isPremium) {
    return (
      <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <RefreshCw className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        Ativando sua conta Premium. Isso leva alguns segundos.
      </p>
    )
  }

  if (isPremium) {
    return (
      <p role="status" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
        <CheckCircle className="size-4 text-positive" strokeWidth={1.75} aria-hidden="true" />
        Conta Premium ativada
      </p>
    )
  }

  return null
}
