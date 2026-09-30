'use client'

import Link from 'next/link'
import { CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AssetSubscriptionButton from '@/components/asset-subscription-button'
import { useEmailSubscription } from '@/components/email-capture-modal'

interface FollowAssetCardProps {
  ticker: string
  companyId: number
  /** Sessão resolvida no servidor (evita piscar entre os dois estados). */
  isLoggedIn: boolean
  /** id do card, alvo do botão "Acompanhar" do cabeçalho. */
  id?: string
  className?: string
}

function AnonymousFollowForm({ ticker }: { ticker: string }) {
  const { email, setEmail, status, error, submit } = useEmailSubscription(ticker)
  const inputId = `follow-email-${ticker.toLowerCase()}`

  if (status === 'success') {
    return (
      <div className="flex items-start gap-2 text-sm" role="status">
        <CheckCircle className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Inscrição recebida</p>
          <p className="text-muted-foreground">Confirme pelo link que enviamos para o seu e-mail.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
        Seu e-mail
      </Label>
      <Input
        id={inputId}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={status === 'loading'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-negative">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={status === 'loading' || !email.trim()}>
        {status === 'loading' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Enviando
          </>
        ) : (
          'Acompanhar'
        )}
      </Button>
      <p className="text-xs text-muted-foreground">Só e-mails sobre {ticker}. Cancele quando quiser.</p>
    </form>
  )
}

/**
 * Card inline "Acompanhar TICKER": e-mail direto para visitantes, inscrição e alerta de preço para logados.
 * Substitui o modal automático de captura de e-mail.
 */
export function FollowAssetCard({ ticker, companyId, isLoggedIn, id = 'acompanhar', className }: FollowAssetCardProps) {
  return (
    <aside
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-28 rounded-lg border border-border bg-card p-4 sm:p-5', className)}
    >
      <h2 id={`${id}-title`} className="text-sm font-medium text-foreground">
        Acompanhar {ticker}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Receba um e-mail quando houver mudanças relevantes nos fundamentos ou no preço de {ticker}.
      </p>
      <div className="mt-4">
        {isLoggedIn ? (
          <div className="flex flex-col items-start gap-2">
            <AssetSubscriptionButton ticker={ticker} companyId={companyId} variant="default" showLabel />
            <Link
              href={`/dashboard/monitoramentos-customizados/criar?ticker=${ticker}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
            >
              Criar alerta de preço
            </Link>
          </div>
        ) : (
          <AnonymousFollowForm ticker={ticker} />
        )}
      </div>
    </aside>
  )
}
