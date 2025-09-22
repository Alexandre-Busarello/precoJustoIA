'use client'

import { useEffect, useState } from 'react'
import { usePaymentVerification } from '@/components/session-refresh-provider'
import { Badge } from '@/components/ui/badge'
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
      console.log('Usuário ainda não é Premium, iniciando verificação...')
      startVerification()
      
      // Verificar periodicamente se a sessão foi atualizada
      const checkInterval = setInterval(async () => {
        const updatedUser = await checkSession()
        if (updatedUser && updatedUser.subscriptionTier === 'PREMIUM') {
          console.log('Usuário agora é Premium!')
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
      <div className="mb-6">
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Ativando sua conta Premium...
        </Badge>
        <p className="text-sm text-gray-600 mt-2">
          Aguarde alguns segundos enquanto processamos seu pagamento.
        </p>
      </div>
    )
  }

  if (isPremium) {
    return (
      <div className="mb-6">
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Conta Premium Ativada
        </Badge>
        <p className="text-sm text-gray-600 mt-2">
          Sua conta Premium foi ativada com sucesso! Aproveite todos os recursos exclusivos.
        </p>
      </div>
    )
  }

  return null
}
