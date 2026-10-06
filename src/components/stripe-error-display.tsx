'use client'

import { AlertCircle, AlertTriangle, Clock, CreditCard, Plus, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  StripeErrorInfo,
  formatStripeError,
  shouldShowRetryOption,
  shouldShowNewCardOption,
} from '@/lib/stripe-error-handler'
import { cn } from '@/lib/utils'

interface StripeErrorDisplayProps {
  error: any
  onRetry?: () => void
  onNewCard?: () => void
  onContactSupport?: () => void
  loading?: boolean
}

const SEVERITY_CLASSES: Record<StripeErrorInfo['severity'], { box: string; icon: string }> = {
  error: { box: 'border-negative/30 bg-negative-subtle', icon: 'text-negative' },
  warning: { box: 'border-warning/30 bg-warning-subtle', icon: 'text-warning' },
  info: { box: 'border-border bg-surface', icon: 'text-muted-foreground' },
}

const ErrorIcon = ({ icon, className }: { icon: StripeErrorInfo['icon']; className?: string }) => {
  const iconProps = { className: cn('size-5', className), strokeWidth: 1.75, 'aria-hidden': true as const }

  switch (icon) {
    case 'card':
      return <CreditCard {...iconProps} />
    case 'clock':
      return <Clock {...iconProps} />
    case 'shield':
      return <Shield {...iconProps} />
    case 'warning':
      return <AlertTriangle {...iconProps} />
    case 'alert':
    default:
      return <AlertCircle {...iconProps} />
  }
}

/** Erro de pagamento em linha, com a ação sugerida (tentar de novo, outro cartão ou suporte). */
export function StripeErrorDisplay({ error, onRetry, onNewCard, onContactSupport, loading = false }: StripeErrorDisplayProps) {
  const errorInfo = formatStripeError(error)
  const showRetry = shouldShowRetryOption(errorInfo)
  const showNewCard = shouldShowNewCardOption(errorInfo)
  const severity = SEVERITY_CLASSES[errorInfo.severity] ?? SEVERITY_CLASSES.info

  return (
    <div role="alert" className={cn('rounded-lg border p-4', severity.box)}>
      <div className="flex items-start gap-3">
        <ErrorIcon icon={errorInfo.icon} className={cn('mt-0.5 shrink-0', severity.icon)} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{errorInfo.title}</h3>
            <p className="mt-1 text-sm text-foreground">{errorInfo.message}</p>
            <p className="mt-1 text-sm text-muted-foreground">{errorInfo.suggestion}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {showRetry && onRetry && (
              <Button onClick={onRetry} disabled={loading}>
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} strokeWidth={1.75} />
                Tentar novamente
              </Button>
            )}

            {showNewCard && onNewCard && (
              <Button onClick={onNewCard} disabled={loading} variant="outline">
                <Plus className="size-4" strokeWidth={1.75} />
                Usar outro cartão
              </Button>
            )}

            {!showRetry && !showNewCard && onContactSupport && (
              <Button onClick={onContactSupport} disabled={loading} variant="outline">
                Falar com o suporte
              </Button>
            )}
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Detalhes técnicos (só em desenvolvimento)</summary>
              <pre className="mt-2 overflow-auto rounded-md bg-muted p-2">{JSON.stringify(errorInfo.originalError, null, 2)}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

/** Erro durante o processamento do pagamento, em tela cheia dentro do formulário. */
export function PaymentProcessingError({
  error,
  onRetry,
  onCancel,
}: {
  error: any
  onRetry: () => void
  onCancel: () => void
}) {
  const errorInfo = formatStripeError(error)

  return (
    <div role="alert" className="py-6 text-center">
      <ErrorIcon icon={errorInfo.icon} className="mx-auto size-10 text-negative" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{errorInfo.title}</h3>
      <p className="mt-1 text-sm text-foreground">{errorInfo.message}</p>
      <p className="mt-1 text-sm text-muted-foreground">{errorInfo.suggestion}</p>

      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        {shouldShowRetryOption(errorInfo) && (
          <Button onClick={onRetry}>
            <RefreshCw className="size-4" strokeWidth={1.75} />
            Tentar novamente
          </Button>
        )}
        <Button onClick={onCancel} variant="outline">
          Cancelar
        </Button>
      </div>
    </div>
  )
}
