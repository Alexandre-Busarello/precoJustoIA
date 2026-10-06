'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Clock, X, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { usePremiumStatus } from '@/hooks/use-premium-status'
import { useEmailVerificationNotice } from '@/components/email-verification-banner'
import { useCampaignNotice } from '@/components/dashboard-notification-banner'
import { useIbovProjectionNotice } from '@/components/dashboard-ibov-banner'

/** Conteúdo de um aviso inline. Cada fonte (e-mail, trial, campanha, IBOV) devolve este formato. */
export interface PageNoticeContent {
  /** Identifica a fonte (vai para `data-notice`, útil em testes). */
  id: string
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  action?: { label: string; href: string; external?: boolean }
  onDismiss?: () => void
}

/** Estado de uma fonte de aviso: `pending` enquanto ainda não sabemos se há aviso. */
export interface PageNoticeSource {
  pending: boolean
  notice: PageNoticeContent | null
}

/** Aviso inline neutro: borda fina, ícone discreto, uma ação e (opcional) dispensar. */
export function InlineNotice({ notice, className }: { notice: PageNoticeContent; className?: string }) {
  const Icon = notice.icon
  return (
    <div
      role="status"
      data-notice={notice.id}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card py-3 pl-4 text-sm',
        notice.onDismiss ? 'pr-1' : 'pr-4',
        className
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-foreground">{notice.title}</p>
          {notice.description && <div className="text-muted-foreground">{notice.description}</div>}
        </div>
        {notice.action && (
          <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
            {notice.action.external ? (
              <a href={notice.action.href} target="_blank" rel="noopener noreferrer">
                {notice.action.label}
              </a>
            ) : (
              <Link href={notice.action.href}>{notice.action.label}</Link>
            )}
          </Button>
        )}
      </div>
      {notice.onDismiss && (
        <button
          type="button"
          onClick={notice.onDismiss}
          aria-label="Dispensar aviso"
          className="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** Fim do teste Premium (o teste dura 1 dia): aparece só para quem está no teste. */
function useTrialNotice(): PageNoticeSource {
  const { isLoading, isTrialActive, subscriptionTier, trialEndsAt } = usePremiumStatus()
  if (isLoading) return { pending: true, notice: null }
  if (!isTrialActive || subscriptionTier !== 'FREE' || !trialEndsAt) return { pending: false, notice: null }
  return {
    pending: false,
    notice: {
      id: 'trial',
      icon: Clock,
      title: 'Seu teste Premium está ativo',
      description: `Termina em ${formatDate(trialEndsAt, { style: 'datetime' })}. Depois disso, a conta volta ao plano gratuito.`,
      action: { label: 'Ver planos', href: '/planos' },
    },
  }
}

/**
 * Slot único de avisos da página: mostra no máximo UM aviso, por prioridade
 * verificação de e-mail > fim do teste > campanha > estimativa do IBOV.
 * Uma fonte de prioridade menor só é consultada/exibida quando todas as anteriores já responderam sem aviso.
 */
export function PageNotice({ className }: { className?: string }) {
  const email = useEmailVerificationNotice()
  const trial = useTrialNotice()
  const higherResolved = (sources: PageNoticeSource[]) => sources.every((s) => !s.pending && !s.notice)

  const campaign = useCampaignNotice({ enabled: higherResolved([email, trial]) })
  const ibov = useIbovProjectionNotice({ enabled: higherResolved([email, trial, campaign]) })

  const ordered = [email, trial, campaign, ibov]
  for (const source of ordered) {
    if (source.pending) return null
    if (source.notice) return <InlineNotice notice={source.notice} className={className} />
  }
  return null
}
