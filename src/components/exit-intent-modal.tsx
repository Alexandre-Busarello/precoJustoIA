'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExitIntentModalProps {
  isOpen: boolean
  onClose: () => void
  page: string
}

type Reason = 'price_too_high' | 'missing_features' | 'just_browsing' | ''

export function ExitIntentModal({ isOpen, onClose, page }: ExitIntentModalProps) {
  const [reason, setReason] = useState<Reason>('')
  const [suggestedPrice, setSuggestedPrice] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPriceInput, setShowPriceInput] = useState(false)

  // Resetar estado quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setReason('')
      setSuggestedPrice('')
      setError(null)
      setShowPriceInput(false)
    }
  }, [isOpen])

  // Mostrar input de preço quando selecionar "price_too_high"
  useEffect(() => {
    setShowPriceInput(reason === 'price_too_high')
    if (reason !== 'price_too_high') {
      setSuggestedPrice('')
    }
  }, [reason])

  const handleSubmit = async () => {
    setError(null)

    // Validação
    if (!reason) {
      setError('Por favor, selecione uma opção')
      return
    }

    if (reason === 'price_too_high' && !suggestedPrice) {
      setError('Por favor, informe o valor sugerido')
      return
    }

    if (reason === 'price_too_high') {
      const priceValue = parseFloat(suggestedPrice.replace(/[^\d,]/g, '').replace(',', '.'))
      const priceInCents = Math.round(priceValue * 100)

      if (isNaN(priceValue) || priceValue <= 0) {
        setError('Por favor, informe um valor válido')
        return
      }

      if (priceInCents < 0 || priceInCents > 1000000) {
        setError('O valor deve estar entre R$ 0 e R$ 10.000')
        return
      }
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/v1/feedback/exit-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          suggested_price_in_cents:
            reason === 'price_too_high'
              ? Math.round(parseFloat(suggestedPrice.replace(/[^\d,]/g, '').replace(',', '.')) * 100)
              : null,
          page,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao enviar feedback')
      }

      // Sucesso - fechar modal
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatPriceInput = (value: string) => {
    // Remover tudo exceto números e vírgula
    const cleaned = value.replace(/[^\d,]/g, '')
    // Garantir apenas uma vírgula
    const parts = cleaned.split(',')
    if (parts.length > 2) {
      return parts[0] + ',' + parts.slice(1).join('')
    }
    return cleaned
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Opa, antes de ir...</DialogTitle>
          <DialogDescription>
            O que te impediu de assinar hoje?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setReason('price_too_high')}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                'hover:border-primary hover:bg-accent',
                reason === 'price_too_high'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 flex-shrink-0',
                    reason === 'price_too_high'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                >
                  {reason === 'price_too_high' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <Label className="cursor-pointer flex-1 font-normal">
                  O preço é muito alto
                </Label>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReason('missing_features')}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                'hover:border-primary hover:bg-accent',
                reason === 'missing_features'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 flex-shrink-0',
                    reason === 'missing_features'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                >
                  {reason === 'missing_features' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <Label className="cursor-pointer flex-1 font-normal">
                  Faltaram funcionalidades
                </Label>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReason('just_browsing')}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                'hover:border-primary hover:bg-accent',
                reason === 'just_browsing'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 flex-shrink-0',
                    reason === 'just_browsing'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  )}
                >
                  {reason === 'just_browsing' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <Label className="cursor-pointer flex-1 font-normal">
                  Só estava olhando
                </Label>
              </div>
            </button>
          </div>

          {showPriceInput && (
            <div className="space-y-2">
              <Label htmlFor="suggested_price">
                Entendido. Qual valor (para o plano anual) você consideraria justo?
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  id="suggested_price"
                  type="text"
                  placeholder="299,90"
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(formatPriceInput(e.target.value))}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o valor anual que você consideraria justo
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Fechar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSubmitting || !reason}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

