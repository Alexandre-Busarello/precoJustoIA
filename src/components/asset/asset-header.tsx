import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatDate, formatDeltaPct, formatNumber } from '@/lib/format'
import { valuationStatus, valuationStatusLabel } from '@/lib/valuation-metrics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Stat } from '@/components/ui/stat'
import { CompanyLogo } from '@/components/company-logo'

export interface AssetHeaderAction {
  label: string
  icon?: LucideIcon
  href?: string
  onClick?: () => void
}

export interface AssetHeaderBadge {
  label: string
  variant?: 'neutral' | 'positive' | 'negative' | 'warning' | 'brand'
}

export interface AssetHeaderProps {
  ticker: string
  name: string
  /** Linha abaixo do nome (ex.: "Petróleo e gás · Ação ON"). */
  subtitle?: string
  logoUrl?: string | null
  price: number | null
  /** Variação do dia como fração (0,012 = +1,2%). */
  dayChange?: number | null
  fairValue?: number | null
  /** Rótulo do valor de referência; padrão "Preço justo" (ex.: "Preço-teto" em FIIs). */
  fairValueTitle?: string
  /** Modelo do preço justo (ex.: "Graham"). */
  fairValueLabel?: string
  /** Seletor de modelo, renderizado abaixo do preço justo. */
  fairValueSlot?: React.ReactNode
  /** Margem de segurança como fração (use marginOfSafety de @/lib/valuation-metrics). */
  marginOfSafety?: number | null
  score?: { value: number | null; label?: string } | null
  updatedAt?: Date | string | null
  actions?: AssetHeaderAction[]
  /** No máximo 2 badges; os demais são ignorados. */
  badges?: AssetHeaderBadge[]
  locked?: { fairValue?: boolean; score?: boolean; cta?: { label: string; href: string } }
  className?: string
}

function ActionButton({ action, compact }: { action: AssetHeaderAction; compact?: boolean }) {
  const Icon = action.icon
  const content = (
    <>
      {Icon && <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
      {action.label}
    </>
  )
  const className = cn(compact && 'shrink-0')
  if (action.href) {
    return (
      <Button variant="outline" size="sm" asChild className={className}>
        <Link href={action.href}>{content}</Link>
      </Button>
    )
  }
  return (
    <Button variant="outline" size="sm" type="button" onClick={action.onClick} className={className}>
      {content}
    </Button>
  )
}

/**
 * Cabeçalho único das páginas de ativo (ação, FII, ETF, BDR).
 * Linha 1: logo 40 px + ticker (nunca trunca) + nome. Linha 2: Preço · Preço justo · Margem · Score
 * (2 × 2 no mobile, 4 colunas no desktop). Preço sempre em text-foreground; cor só na variação/margem.
 */
export function AssetHeader({
  ticker,
  name,
  subtitle,
  logoUrl,
  price,
  dayChange,
  fairValue,
  fairValueTitle,
  fairValueLabel,
  fairValueSlot,
  marginOfSafety,
  score,
  updatedAt,
  actions = [],
  badges = [],
  locked,
  className,
}: AssetHeaderProps) {
  const visibleBadges = badges.slice(0, 2)
  const fairLocked = Boolean(locked?.fairValue)
  const scoreLocked = Boolean(locked?.score)
  const hasMargin = typeof marginOfSafety === 'number' && Number.isFinite(marginOfSafety)
  // Dentro da faixa estimada (±5%) a margem fica neutra; a cor só aparece fora dela.
  const status = hasMargin ? valuationStatus(marginOfSafety) : null
  const marginTone = status === 'below' ? 'positive' : status === 'above' ? 'negative' : 'default'
  const fairTitle = fairValueTitle ?? 'Preço justo'
  const fairNoun = fairTitle.toLowerCase()
  const statusLabel = valuationStatusLabel(marginOfSafety)
  const statusCaption = statusLabel && fairValueTitle ? statusLabel.replace('preço justo', fairNoun) : statusLabel
  const scoreValue = score?.value
  const hasScore = typeof scoreValue === 'number' && Number.isFinite(scoreValue)

  return (
    <section aria-label={`Resumo de ${ticker}`} className={cn('space-y-4', className)}>
      <div className="flex items-start gap-3">
        <CompanyLogo logoUrl={logoUrl} companyName={name} ticker={ticker} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-2xl font-semibold tracking-tight text-foreground">{ticker}</span>
            <span className="truncate text-sm font-normal text-muted-foreground">{name}</span>
          </h1>
          {(subtitle || visibleBadges.length > 0) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {subtitle && <span>{subtitle}</span>}
              {visibleBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant ?? 'neutral'}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {actions.map((action) => (
              <ActionButton key={action.label} action={action} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
        <Stat label="Preço" value={formatBRL(price)} delta={dayChange} deltaLabel="hoje" />
        <div className="min-w-0">
          <Stat
            label={fairTitle}
            value={formatBRL(fairValue)}
            caption={fairValueLabel}
            locked={fairLocked}
          />
          {fairValueSlot && <div className="mt-1.5">{fairValueSlot}</div>}
        </div>
        <Stat
          label="Margem de segurança"
          value={formatDeltaPct(marginOfSafety)}
          tone={marginTone}
          caption={statusCaption ?? undefined}
          locked={fairLocked}
          hint={`Quanto o preço atual está abaixo (positivo) ou acima (negativo) do ${fairNoun} estimado: 1 − preço ÷ ${fairNoun}.`}
        />
        <Stat
          label="Score"
          value={hasScore ? `${formatNumber(Math.round(scoreValue), { digits: 0 })}/100` : '—'}
          caption={score?.label}
          locked={scoreLocked}
        />
      </div>

      {(updatedAt || locked?.cta) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {updatedAt && (
            <p className="text-xs text-muted-foreground">Atualizado em {formatDate(updatedAt, { style: 'datetime' })}</p>
          )}
          {locked?.cta && (fairLocked || scoreLocked) && (
            <Button size="sm" asChild>
              <Link href={locked.cta.href}>{locked.cta.label}</Link>
            </Button>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
          {actions.map((action) => (
            <ActionButton key={action.label} action={action} compact />
          ))}
        </div>
      )}
    </section>
  )
}
