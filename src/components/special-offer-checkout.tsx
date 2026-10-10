'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Check, CreditCard, Loader2, Smartphone, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { OptimizedPixPayment } from './optimized-pix-payment'
import { OptimizedCardPayment } from './optimized-card-payment'
import { PREMIUM_FEATURES } from './landing-pricing-section'
import { usePricing } from '@/hooks/use-pricing'
import { formatPrice } from '@/lib/price-utils'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatTimeUntilExpiration, getTimeUntilExpiration } from '@/lib/offer-utils'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import Link from 'next/link'

type PaymentMethod = 'pix' | 'card'

export function SpecialOfferCheckout() {
  const { status } = useSession()
  const router = useRouter()
  const { special, monthly, annual, isLoading: isLoadingPricing } = usePricing()
  const { isPremium } = usePremiumStatus()
  
  // Calcular desconto comparando com oferta anual
  const calculateDiscount = () => {
    if (!special || !annual) return null
    
    const annualPrice = annual.price_in_cents
    const specialPrice = special.price_in_cents
    const discountAmount = annualPrice - specialPrice
    
    if (discountAmount <= 0) return null
    
    return {
      amount: discountAmount,
      formatted: formatPrice(discountAmount),
      percentage: Math.round((discountAmount / annualPrice) * 100)
    }
  }
  
  const discount = calculateDiscount()
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null)

  // Atualizar timer a cada minuto
  useEffect(() => {
    if (!special || !special.expires_at) return

    const updateTimer = () => {
      const time = getTimeUntilExpiration({ expires_at: special.expires_at ? new Date(special.expires_at) : null })
      setTimeRemaining(time)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000) // Atualizar a cada minuto

    return () => clearInterval(interval)
  }, [special])

  const isExpired = special?.is_expired || false
  const hasStripePriceId = !!special?.stripe_price_id

  // Obter dados da oferta especial
  const getSpecialOfferData = () => {
    if (!special) {
      return null
    }

    const durationDays = special.premium_duration_days || 365
    const durationMonths = Math.floor(durationDays / 30)
    const durationYears = Math.floor(durationDays / 365)

    let durationText = ''
    if (durationYears > 0) {
      durationText = `${durationYears} ${durationYears === 1 ? 'ano' : 'anos'}`
    } else if (durationMonths > 0) {
      durationText = `${durationMonths} ${durationMonths === 1 ? 'mês' : 'meses'}`
    } else {
      durationText = `${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}`
    }

    return {
      name: 'Premium, oferta especial',
      price: special.price_in_cents / 100,
      period: durationText,
      description: `Acesso Premium por ${durationText}`,
      features: [...PREMIUM_FEATURES, `${durationText} de acesso Premium`],
      offerId: special.id,
      expiresAt: special.expires_at,
      isExpired,
      hasStripePriceId,
    }
  }

  const offerData = getSpecialOfferData()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/checkout/oferta-especial')
    }
  }, [status, router])

  // Se não há oferta especial, redirecionar para checkout normal
  useEffect(() => {
    if (!isLoadingPricing && !special) {
      router.push('/checkout')
    }
  }, [special, isLoadingPricing, router])

  const handleMethodSelect = (method: PaymentMethod) => {
    if (isExpired) return
    if (method === 'card' && !hasStripePriceId) return
    setSelectedMethod(method)
    setShowPayment(true)
  }

  const handlePaymentSuccess = () => {
    router.push('/checkout/success')
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    setIsProcessing(false)
    toast.error('Pagamento recusado', {
      description: error || 'Verifique os dados do cartão ou tente outro método.'
    })
  }

  if (status === 'loading' || isLoadingPricing || status === 'unauthenticated') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          {status === 'unauthenticated' ? 'Redirecionando para o login' : 'Carregando a oferta'}
        </p>
      </div>
    )
  }

  if (!offerData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-foreground">Oferta especial indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">Esta condição não está mais ativa. Veja os planos disponíveis.</p>
          <Button className="mt-4" asChild>
            <Link href="/planos">Ver planos</Link>
          </Button>
        </div>
      </div>
    )
  }

  const premiumNotice = isPremium && (
    <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
      Você já tem Premium ativo. Os {offerData.period} desta oferta são somados ao seu período atual.
    </p>
  )

  return (
    <div className="bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Oferta especial Premium</h1>
            {!isExpired && timeRemaining && (
              <Badge variant="warning" className="tabular-nums">
                <Timer strokeWidth={1.75} aria-hidden="true" />
                Termina em {formatTimeUntilExpiration(timeRemaining)}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {discount
              ? `${discount.formatted} a menos que o plano anual (${discount.percentage}% de desconto).`
              : 'Condição especial por tempo limitado.'}
          </p>
        </header>

        {!showPayment ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className={cn('rounded-lg bg-card p-4 sm:p-6', isExpired ? 'border border-border opacity-75' : 'border-2 border-brand')}>
                <h2 className="text-base font-semibold text-foreground">{offerData.name}</h2>
                <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                  {formatBRL(offerData.price)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{offerData.description} · pagamento único</p>

                {isExpired ? (
                  <p className="mt-4 rounded-lg border border-border bg-warning-subtle p-3 text-sm text-foreground">
                    Esta oferta terminou. Os planos regulares estão abaixo.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3 lg:hidden">
                    {premiumNotice}
                    <Button className="h-12 w-full" onClick={() => handleMethodSelect('pix')} disabled={isProcessing}>
                      <Smartphone className="size-4" strokeWidth={1.75} />
                      Pagar com PIX
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                <h2 className="text-base font-semibold text-foreground">O que está incluído</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {offerData.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!isExpired && (
              <aside className="h-fit space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6 lg:sticky lg:top-4">
                <h2 className="text-base font-semibold text-foreground">Forma de pagamento</h2>
                <div className="hidden lg:block">{premiumNotice}</div>
                <Button className="w-full" onClick={() => handleMethodSelect('pix')} disabled={isProcessing}>
                  <Smartphone className="size-4" strokeWidth={1.75} />
                  Pagar com PIX
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleMethodSelect('card')}
                  disabled={isProcessing || !hasStripePriceId}
                >
                  <CreditCard className="size-4" strokeWidth={1.75} />
                  Pagar com cartão
                </Button>
                {!hasStripePriceId && <p className="text-xs text-muted-foreground">Esta oferta aceita somente PIX.</p>}
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Pagamento seguro · Ativação imediata · Reembolso em até 7 dias
                </p>
              </aside>
            )}

            {isExpired && (monthly || annual) && (
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
                {monthly && (
                  <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
                    <h3 className="text-base font-semibold text-foreground">Premium mensal</h3>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tabular-nums text-foreground">{formatBRL(monthly.price_in_cents / 100)}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </p>
                    <Button variant="outline" className="mt-4 w-full" asChild>
                      <Link href="/checkout?plan=monthly">Escolher o mensal</Link>
                    </Button>
                  </div>
                )}
                {annual && (
                  <div className="rounded-lg border-2 border-brand bg-card p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground">Premium anual</h3>
                      <Badge variant="brand">Recomendado</Badge>
                    </div>
                    <p className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tabular-nums text-foreground">{formatBRL(annual.price_in_cents / 100)}</span>
                      <span className="text-sm text-muted-foreground">/ano</span>
                    </p>
                    <Button className="mt-4 w-full" asChild>
                      <Link href="/checkout?plan=annual">Escolher o anual</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-6 lg:col-span-2">
              <div className="mb-4 hidden items-center justify-between sm:flex">
                <h2 className="text-base font-semibold text-foreground">
                  {selectedMethod === 'pix' ? 'Pague com PIX' : 'Pague com cartão'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowPayment(false)}>
                  <ArrowLeft className="size-4" strokeWidth={1.75} />
                  Voltar
                </Button>
              </div>

              {selectedMethod === 'pix' ? (
                <OptimizedPixPayment
                  planType="special"
                  price={offerData.price}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              ) : (
                <OptimizedCardPayment
                  planType="special"
                  price={offerData.price}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              )}

              <Button variant="ghost" className="mt-4 w-full sm:hidden" onClick={() => setShowPayment(false)}>
                <ArrowLeft className="size-4" strokeWidth={1.75} />
                Voltar
              </Button>
            </div>

            <aside className="h-fit rounded-lg border border-border bg-card p-4 sm:p-6 lg:sticky lg:top-4">
              <h2 className="text-base font-semibold text-foreground">Resumo do pedido</h2>
              <dl className="mt-4 space-y-2 text-sm tabular-nums">
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground">{offerData.name}</dt>
                  <dd className="text-foreground">{formatBRL(offerData.price)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <dt>Acesso Premium</dt>
                  <dd>{offerData.period}</dd>
                </div>
              </dl>
              <Separator className="my-4" />
              <div className="flex justify-between text-base font-semibold tabular-nums text-foreground">
                <span>Total</span>
                <span>{formatBRL(offerData.price)}</span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Ativação imediata após a confirmação · Reembolso em até 7 dias</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
