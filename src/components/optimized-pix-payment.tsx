'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  QrCode, 
  Copy, 
  CheckCircle, 
  Clock,
  Smartphone,
  RefreshCw,
  AlertCircle,
  Zap
} from 'lucide-react'
import Image from 'next/image'
import { usePaymentVerification } from '@/components/session-refresh-provider'

interface OptimizedPixPaymentProps {
  planType: 'monthly' | 'annual'
  price: number
  onSuccess: () => void
  onError: (error: string) => void
}

interface PixData {
  id: string
  status: string
  status_detail?: string
  qr_code?: string
  qr_code_base64?: string
  ticket_url?: string
}

export function OptimizedPixPayment({ 
  planType, 
  price, 
  onSuccess, 
  onError 
}: OptimizedPixPaymentProps) {
  const { data: session } = useSession()
  const [pixData, setPixData] = useState<PixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'approved' | 'failed'>('pending')
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutos
  const { startVerification } = usePaymentVerification()

  // Timer countdown
  useEffect(() => {
    if (pixData && timeLeft > 0 && paymentStatus === 'pending') {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [pixData, timeLeft, paymentStatus])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const createPixPayment = async () => {
    if (!session?.user?.email) {
      onError('Usuário não autenticado')
      return
    }

    setLoading(true)
    try {
      // Gerar chave de idempotência única no frontend
      const idempotencyKey = `pix-frontend-${session.user.email}-${planType}-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      const response = await fetch('/api/checkout/create-pix', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          planType,
          userEmail: session.user.email,
          userName: session.user.name,
          idempotencyKey,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Erro na resposta da API:', error)
        throw new Error(error.error || error.message || 'Erro ao criar pagamento PIX')
      }

      const data = await response.json()
      console.log('Dados do PIX recebidos:', data)
      
      if (!data.qr_code && !data.qr_code_base64) {
        throw new Error('QR Code não foi gerado pelo MercadoPago')
      }
      
      setPixData(data)
      startPaymentCheck(data.id)
    } catch (error) {
      console.error('Erro ao criar PIX:', error)
      onError(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX')
    } finally {
      setLoading(false)
    }
  }

  const startPaymentCheck = (paymentId: string) => {
    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/payment/status/${paymentId}`)
        const data = await response.json()
        
        if (data.status === 'approved') {
          setPaymentStatus('approved')
          
          // Iniciar verificação de pagamento para atualizar sessão
          startVerification()
          
          setTimeout(onSuccess, 2000)
        } else if (data.status === 'cancelled' || data.status === 'rejected') {
          setPaymentStatus('failed')
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error)
      }
    }

    // Verificar a cada 10 segundos
    const interval = setInterval(checkPayment, 10000)
    
    // Parar após 10 minutos
    setTimeout(() => clearInterval(interval), 600000)
  }

  const copyPixCode = async () => {
    if (pixData?.qr_code) {
      try {
        await navigator.clipboard.writeText(pixData.qr_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Erro ao copiar:', error)
      }
    }
  }

  if (!pixData) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Smartphone className="w-10 h-10 text-green-600" />
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Pagamento via PIX</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Aprovação instantânea e segura
        </p>
        <div className="mb-6">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 inline-flex items-center">
            <Zap className="w-3 h-3 mr-1" />
            5% de desconto aplicado
          </Badge>
        </div>

        <Button 
          onClick={createPixPayment}
          disabled={loading}
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white px-8"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Gerando PIX...
            </>
          ) : (
            <>
              <QrCode className="w-4 h-4 mr-2" />
              Gerar PIX
            </>
          )}
        </Button>
      </div>
    )
  }

  if (paymentStatus === 'approved') {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-green-600 mb-2">
          Pagamento Aprovado!
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Sua conta Premium foi ativada com sucesso
        </p>
      </div>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-red-600 mb-2">
          Pagamento não realizado
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          O pagamento foi cancelado ou rejeitado
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center">
        <Badge variant="secondary" className="mb-2">
          <Clock className="w-3 h-3 mr-1" />
          Expira em {formatTime(timeLeft)}
        </Badge>
        <h3 className="text-lg font-semibold">Escaneie o QR Code</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Use o app do seu banco ou carteira digital
        </p>
      </div>

      {/* QR Code */}
      {pixData.qr_code_base64 && (
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-6 text-center">
            <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
              <Image
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                width={200}
                height={200}
                className="mx-auto"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIX Code */}
      {pixData.qr_code && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-3">
                <p className="text-xs text-gray-500 mb-1">Código PIX</p>
                <p className="text-sm font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                  {pixData.qr_code.substring(0, 50)}...
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={copyPixCode}
                className={copied ? 'bg-green-50 border-green-300' : ''}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Como pagar:
        </h4>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>1. Abra o app do seu banco</li>
          <li>2. Escaneie o QR Code ou cole o código PIX</li>
          <li>3. Confirme o pagamento de R$ {price}</li>
          <li>4. Sua conta será ativada automaticamente</li>
        </ol>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Aguardando confirmação do pagamento...</span>
      </div>
    </div>
  )
}

