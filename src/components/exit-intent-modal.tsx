'use client'

import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ExitIntentModalProps {
  isOpen: boolean
  onClose: () => void
  page: string
}

type Reason = 'price_too_high' | 'missing_features' | 'just_browsing'

const OPTIONS: Array<{ value: Reason; label: string }> = [
  { value: 'price_too_high', label: 'O preço está alto' },
  { value: 'missing_features', label: 'Faltaram funcionalidades' },
  { value: 'just_browsing', label: 'Só estava olhando' },
]

function parsePrice(value: string): number {
  return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.'))
}

function formatPriceInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '')
  const parts = cleaned.split(',')
  return parts.length > 2 ? `${parts[0]},${parts.slice(1).join('')}` : cleaned
}

/**
 * Pesquisa de saída em card não bloqueante (canto inferior direito, sem overlay).
 * Um clique responde; "preço alto" pede o valor sugerido antes de enviar. Esc ou X fecham.
 */
export function ExitIntentModal({ isOpen, onClose, page }: ExitIntentModalProps) {
  const titleId = useId()
  const [reason, setReason] = useState<Reason | null>(null)
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setReason(null)
    setSuggestedPrice('')
    setError(null)
    setDone(false)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
  }, [done, onClose])

  const submit = async (value: Reason, price?: string) => {
    setError(null)
    let priceInCents: number | null = null
    if (value === 'price_too_high') {
      const parsed = parsePrice(price ?? '')
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Informe um valor válido')
        return
      }
      priceInCents = Math.round(parsed * 100)
      if (priceInCents > 1000000) {
        setError('O valor deve estar entre R$ 0 e R$ 10.000')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/v1/feedback/exit-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: value, suggested_price_in_cents: priceInCents, page }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao enviar a resposta')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a resposta')
    } finally {
      setIsSubmitting(false)
    }
  }

  const choose = (value: Reason) => {
    setReason(value)
    if (value !== 'price_too_high') void submit(value)
  }

  if (!isOpen) return null

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed right-6 bottom-6 z-40 w-[22rem] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-md"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>

      {done ? (
        <p id={titleId} className="pr-8 text-sm font-medium" role="status">
          Obrigado pelo retorno.
        </p>
      ) : (
        <>
          <h2 id={titleId} className="pr-8 text-sm font-semibold">
            Antes de sair: o que faltou para assinar hoje?
          </h2>
          <div className="mt-3 grid gap-2">
            {OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                aria-pressed={reason === option.value}
                onClick={() => choose(option.value)}
                className="justify-start aria-pressed:border-brand aria-pressed:bg-brand-subtle"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {reason === 'price_too_high' && (
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                void submit('price_too_high', suggestedPrice)
              }}
            >
              <Label htmlFor="exit-intent-price" className="text-xs font-normal text-muted-foreground">
                Qual valor anual você consideraria justo?
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  id="exit-intent-price"
                  inputMode="decimal"
                  placeholder="299,90"
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(formatPriceInput(e.target.value))}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" size="sm" disabled={isSubmitting || !suggestedPrice}>
                  Enviar
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p className="mt-2 text-xs text-negative" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}
