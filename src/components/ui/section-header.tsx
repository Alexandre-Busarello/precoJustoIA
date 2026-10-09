import * as React from "react"

import { cn } from "@/lib/utils"

export interface SectionHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Botões/links alinhados à direita. */
  actions?: React.ReactNode
  /** Nível do título (padrão h2). */
  as?: "h2" | "h3"
  id?: string
  className?: string
}

/** Cabeçalho de seção: título text-lg semibold, descrição opcional e ações à direita. Sem ícone decorativo. */
export function SectionHeader({ title, description, actions, as: Heading = "h2", id, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 space-y-1">
        <Heading id={id} className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
