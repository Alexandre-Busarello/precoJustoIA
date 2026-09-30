'use client'

import { Badge } from "@/components/ui/badge"
import { ArrowRight, LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FeatureCardProps {
  title: string
  description: string
  /** @deprecated Cards não exibem mais ícone em azulejo. */
  icon?: LucideIcon | ReactNode
  /** @deprecated Cards não exibem mais ícone em azulejo. */
  iconName?: string
  href?: string
  badge?: {
    text: string
    variant?: "default" | "secondary" | "outline"
    /** @deprecated Cores do badge vêm das variantes do design system. */
    className?: string
  }
  isPremium?: boolean
  className?: string
  /** @deprecated Cards não exibem mais ícone em azulejo. */
  iconBgClass?: string
  onClick?: () => void
}

/** Card de recurso: título, descrição curta e link opcional. Borda fina, sem ícone decorativo. */
export function FeatureCard({
  title,
  description,
  href,
  badge,
  isPremium = false,
  className,
  onClick,
}: FeatureCardProps) {
  const interactive = Boolean(href || onClick)

  const content = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:p-5",
        interactive && "transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {badge && <Badge variant={isPremium ? "brand" : "neutral"}>{badge.text}</Badge>}
      </div>
      <p className="flex-grow text-sm leading-6 text-muted-foreground">{description}</p>
      {interactive && (
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand">
          {href ? "Ver mais" : "Explorar"}
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group block h-full w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        {content}
      </button>
    )
  }

  return content
}
