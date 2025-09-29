'use client'

import { 
  AlertCircle, 
  CreditCard, 
  Clock, 
  Shield, 
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  StripeErrorInfo, 
  formatStripeError, 
  shouldShowRetryOption, 
  shouldShowNewCardOption,
  getSeverityColor 
} from '@/lib/stripe-error-handler'

interface StripeErrorDisplayProps {
  error: any
  onRetry?: () => void
  onNewCard?: () => void
  onContactSupport?: () => void
  loading?: boolean
}

const ErrorIcon = ({ icon, className }: { icon: StripeErrorInfo['icon'], className?: string }) => {
  const iconProps = { className: className || "w-6 h-6" }
  
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

export function StripeErrorDisplay({ 
  error, 
  onRetry, 
  onNewCard, 
  onContactSupport,
  loading = false 
}: StripeErrorDisplayProps) {
  const errorInfo = formatStripeError(error)
  const showRetry = shouldShowRetryOption(errorInfo)
  const showNewCard = shouldShowNewCardOption(errorInfo)
  const colorClasses = getSeverityColor(errorInfo.severity)

  return (
    <Card className={`border-2 ${colorClasses}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`p-2 rounded-full ${colorClasses}`}>
            <ErrorIcon icon={errorInfo.icon} className="w-6 h-6" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-lg mb-1">
                {errorInfo.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                {errorInfo.message}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {errorInfo.suggestion}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {showRetry && onRetry && (
                <Button
                  onClick={onRetry}
                  disabled={loading}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Tentar Novamente
                </Button>
              )}

              {showNewCard && onNewCard && (
                <Button
                  onClick={onNewCard}
                  disabled={loading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Usar Outro Cartão
                </Button>
              )}

              {(!showRetry && !showNewCard) && onContactSupport && (
                <Button
                  onClick={onContactSupport}
                  disabled={loading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Falar com Suporte
                </Button>
              )}
            </div>

            {/* Informações técnicas para debug (apenas em desenvolvimento) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  Detalhes técnicos (dev only)
                </summary>
                <pre className="text-xs text-gray-400 mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                  {JSON.stringify(errorInfo.originalError, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente específico para erros durante o processamento
export function PaymentProcessingError({ 
  error, 
  onRetry, 
  onCancel 
}: { 
  error: any
  onRetry: () => void
  onCancel: () => void 
}) {
  const errorInfo = formatStripeError(error)

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <ErrorIcon icon={errorInfo.icon} className="w-10 h-10 text-red-600" />
      </div>
      
      <h3 className="text-xl font-semibold text-red-600 mb-2">
        {errorInfo.title}
      </h3>
      
      <p className="text-gray-600 dark:text-gray-300 mb-2">
        {errorInfo.message}
      </p>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {errorInfo.suggestion}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {shouldShowRetryOption(errorInfo) && (
          <Button onClick={onRetry} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </Button>
        )}
        
        <Button onClick={onCancel} variant="outline">
          Cancelar
        </Button>
      </div>
    </div>
  )
}
