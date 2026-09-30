'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { AlertCircle, Check, CheckCircle, ChevronDown, Clock, Copy, QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePaymentVerification } from '@/components/session-refresh-provider'
import { formatBRL } from '@/lib/format'

interface OptimizedPixPaymentProps {
  planType: 'monthly' | 'annual' | 'special'
  /** Valor a pagar em reais (já com desconto PIX quando houver). */
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

const PIX_TTL_SECONDS = 600

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Pagamento PIX. No celular o código copia-e-cola é a ação principal (não dá para escanear a própria tela);
 * o QR code fica recolhido em "Pagar com outro aparelho". A partir de 640 px o QR aparece ao lado do código.
 */
export function OptimizedPixPayment({ planType, price, onSuccess, onError }: OptimizedPixPaymentProps) {
  const { data: session } = useSession()
  const [pixData, setPixData] = useState<PixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'failed'>('pending')
  const [timeLeft, setTimeLeft] = useState(PIX_TTL_SECONDS)
  const { startVerification } = usePaymentVerification()
  // Intervalo de consulta do status; guardado para parar ao expirar, ao gerar outro código ou ao desmontar.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPaymentCheck = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  const isExpired = Boolean(pixData) && timeLeft <= 0 && paymentStatus === 'pending'

  useEffect(() => {
    // Para a consulta quando o código expira e ao desmontar.
    const clear = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (isExpired) clear()
    return clear
  }, [isExpired])

  useEffect(() => {
    if (pixData && timeLeft > 0 && paymentStatus === 'pending') {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [pixData, timeLeft, paymentStatus])

  const startPaymentCheck = (paymentId: string) => {
    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/payment/status/${paymentId}`)
        const data = await response.json()

        if (data.status === 'approved') {
          setPaymentStatus('approved')
          stopPaymentCheck()
          startVerification()
          setTimeout(onSuccess, 2000)
        } else if (data.status === 'cancelled' || data.status === 'rejected') {
          setPaymentStatus('failed')
          stopPaymentCheck()
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error)
      }
    }

    stopPaymentCheck()
    pollRef.current = setInterval(checkPayment, 10000)
  }

  const createPixPayment = async () => {
    if (!session?.user?.email) {
      onError('Usuário não autenticado')
      return
    }

    setLoading(true)
    try {
      const idempotencyKey = `pix-frontend-${session.user.email}-${planType}-${Date.now()}-${Math.random().toString(36).substring(7)}`

      const response = await fetch('/api/checkout/create-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
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

      if (!data.qr_code && !data.qr_code_base64) {
        throw new Error('O código PIX não foi gerado. Tente novamente.')
      }

      setPixData(data)
      setTimeLeft(PIX_TTL_SECONDS)
      startPaymentCheck(data.id)
    } catch (error) {
      console.error('Erro ao criar PIX:', error)
      onError(error instanceof Error ? error.message : 'Erro ao criar pagamento PIX')
    } finally {
      setLoading(false)
    }
  }

  const copyPixCode = async () => {
    if (!pixData?.qr_code) return
    try {
      await navigator.clipboard.writeText(pixData.qr_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (error) {
      console.error('Erro ao copiar:', error)
    }
  }

  if (!pixData) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Valor a pagar</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{formatBRL(price)}</p>
          {planType !== 'special' && (
            <p className="mt-1 text-sm text-muted-foreground">Com 15% de desconto do PIX já aplicado</p>
          )}
        </div>
        <Button onClick={createPixPayment} disabled={loading} className="h-12 w-full sm:w-auto md:h-10">
          {loading ? (
            <>
              <RefreshCw className="size-4 animate-spin" strokeWidth={1.75} />
              Gerando código PIX
            </>
          ) : (
            <>
              <QrCode className="size-4" strokeWidth={1.75} />
              Gerar código PIX
            </>
          )}
        </Button>
        <p className="text-sm text-muted-foreground">A aprovação é imediata e sua conta é ativada automaticamente.</p>
      </div>
    )
  }

  if (paymentStatus === 'approved') {
    return (
      <div role="status" className="py-6 text-center">
        <CheckCircle className="mx-auto size-10 text-positive" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Pagamento aprovado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Sua conta Premium foi ativada. Redirecionando.</p>
      </div>
    )
  }

  if (paymentStatus === 'failed') {
    return (
      <div role="alert" className="py-6 text-center">
        <AlertCircle className="mx-auto size-10 text-negative" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Pagamento não realizado</h3>
        <p className="mt-1 text-sm text-muted-foreground">O pagamento foi cancelado ou recusado pelo banco.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div role="alert" className="py-6 text-center">
        <Clock className="mx-auto size-10 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Código PIX expirado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O código vale por 10 minutos. Se você já pagou, a ativação chega em instantes. Se não, gere um novo código.
        </p>
        <Button
          onClick={() => {
            setPixData(null)
            setCopied(false)
            setTimeLeft(PIX_TTL_SECONDS)
          }}
          variant="outline"
          className="mt-4 h-12 w-full sm:w-auto md:h-10"
        >
          <RefreshCw className="size-4" strokeWidth={1.75} />
          Gerar novo código
        </Button>
      </div>
    )
  }

  const qrImage = pixData.qr_code_base64 ? (
    <Image
      src={`data:image/png;base64,${pixData.qr_code_base64}`}
      alt="QR code do PIX"
      width={200}
      height={200}
      unoptimized
      className="size-[200px] rounded-md border border-border"
    />
  ) : null

  const copyButton = (className: string, variant: 'default' | 'outline' = 'default') => (
    <Button onClick={copyPixCode} variant={variant} className={className} aria-live="polite">
      {copied ? (
        <>
          <Check className="size-4" strokeWidth={1.75} />
          Copiado
        </>
      ) : (
        <>
          <Copy className="size-4" strokeWidth={1.75} />
          Copiar código PIX
        </>
      )}
    </Button>
  )

  return (
    <div className="space-y-5">
      {/* Celular: copia e cola primeiro */}
      <div className="space-y-3 sm:hidden">
        <p className="text-sm font-medium text-foreground">Cole no app do seu banco</p>
        {pixData.qr_code && copyButton('h-12 w-full')}
        <p className="text-sm text-muted-foreground">
          No app, escolha PIX copia e cola e confirme {formatBRL(price)}.
        </p>
        {qrImage && (
          <details className="group rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              Pagar com outro aparelho
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="flex justify-center px-3 pb-4">{qrImage}</div>
          </details>
        )}
      </div>

      {/* A partir de 640 px: QR code ao lado do código */}
      <div className="hidden gap-6 sm:flex sm:items-start">
        {qrImage && <div className="shrink-0">{qrImage}</div>}
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-base font-semibold text-foreground">Escaneie o QR code no app do seu banco</h3>
          <p className="text-sm text-muted-foreground">
            Ou copie o código e use a opção PIX copia e cola. Valor: <span className="tabular-nums">{formatBRL(price)}</span>.
          </p>
          {pixData.qr_code && (
            <>
              <p className="rounded-md bg-muted p-2 font-mono text-xs break-all text-muted-foreground">
                {pixData.qr_code.substring(0, 60)}…
              </p>
              {copyButton('', 'outline')}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <span role="status" className="inline-flex items-center gap-2">
          <RefreshCw className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          Aguardando a confirmação do pagamento
        </span>
        <Badge variant="neutral" className="tabular-nums">
          <Clock strokeWidth={1.75} aria-hidden="true" />
          Expira em {formatTime(Math.max(timeLeft, 0))}
        </Badge>
      </div>
    </div>
  )
}
