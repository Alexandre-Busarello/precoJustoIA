'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  QrCode, 
  Copy, 
  CheckCircle,
  Loader2,
  Clock,
  Smartphone
} from "lucide-react"
import Image from 'next/image'

interface PixPaymentProps {
  planType: 'monthly' | 'annual'
  planName: string
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

export function PixPayment({ planType, planName, price, onSuccess, onError }: PixPaymentProps) {
  const [pixData, setPixData] = useState<PixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  const createPixPayment = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/checkout/create-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planType }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao criar pagamento PIX')
      }

      const data = await response.json()
      setPixData(data)
      
      // Iniciar verificação automática do pagamento
      startPaymentCheck(data.id)
    } catch (error) {
      console.error('Erro ao criar PIX:', error)
      onError(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX')
    } finally {
      setLoading(false)
    }
  }

  const startPaymentCheck = (paymentId: string) => {
    const checkInterval = setInterval(async () => {
      try {
        setChecking(true)
        const response = await fetch(`/api/payment/status/${paymentId}`)
        
        if (response.ok) {
          const { status } = await response.json()
          
          if (status === 'approved') {
            clearInterval(checkInterval)
            onSuccess()
          } else if (status === 'rejected' || status === 'cancelled') {
            clearInterval(checkInterval)
            onError('Pagamento foi rejeitado ou cancelado')
          }
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error)
      } finally {
        setChecking(false)
      }
    }, 3000) // Verificar a cada 3 segundos

    // Parar verificação após 10 minutos
    setTimeout(() => {
      clearInterval(checkInterval)
    }, 600000)
  }

  const copyPixCode = async () => {
    if (pixData?.qr_code) {
      try {
        await navigator.clipboard.writeText(pixData.qr_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Erro ao copiar código PIX:', error)
      }
    }
  }

  if (!pixData) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-8 h-8 text-green-600" />
          </div>
          
          <h3 className="text-xl font-bold mb-4">Pagamento via PIX</h3>
          <p className="text-muted-foreground mb-6">
            Gere seu código PIX para pagamento instantâneo
          </p>
          
          <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="font-medium">{planName}</span>
              <span className="text-xl font-bold text-green-600">
                R$ {price.toFixed(2)}
              </span>
            </div>
          </div>

          <Button 
            onClick={createPixPayment}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Gerando PIX...
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 mr-2" />
                Gerar Código PIX
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
      <CardContent className="p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <QrCode className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-bold">PIX Gerado com Sucesso!</h3>
          </div>
          
          {checking && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-4">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        {pixData.qr_code_base64 && (
          <div className="bg-white rounded-lg p-4 mb-6 text-center">
            <Image
              src={`data:image/png;base64,${pixData.qr_code_base64}`}
              alt="QR Code PIX"
              width={200}
              height={200}
              className="mx-auto mb-4"
            />
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code com seu banco ou app de pagamento
            </p>
          </div>
        )}

        {/* Código PIX para copiar */}
        {pixData.qr_code && (
          <div className="space-y-4">
            <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Código PIX:</span>
                <Button
                  onClick={copyPixCode}
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs font-mono break-all">
                {pixData.qr_code}
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ou copie o código acima e cole no seu app de pagamento
              </p>
              
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2">⏱️ Instruções:</h4>
                <ol className="text-sm text-left space-y-1">
                  <li>1. Abra seu app do banco ou carteira digital</li>
                  <li>2. Escolha a opção PIX</li>
                  <li>3. Escaneie o QR Code ou cole o código</li>
                  <li>4. Confirme o pagamento de R$ {price.toFixed(2)}</li>
                  <li>5. Sua conta será ativada automaticamente</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
