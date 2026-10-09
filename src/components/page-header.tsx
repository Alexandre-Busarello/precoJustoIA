import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PageHeaderProps {
  title: React.ReactNode
  /** Uma linha de descrição abaixo do título. */
  description?: React.ReactNode
  breadcrumb?: BreadcrumbItem[]
  /** Botões/links à direita (no mobile, abaixo do título). */
  actions?: React.ReactNode
  className?: string
}

/** Cabeçalho de página do app: breadcrumb opcional, H1 text-2xl semibold, descrição e ações. */
export function PageHeader({ title, description, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("space-y-2", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Trilha de navegação">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((item, index) => {
              const last = index === breadcrumb.length - 1
              return (
                <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                  {item.href && !last ? (
                    <Link
                      href={item.href}
                      className="relative hover:text-foreground hover:underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:before:content-none"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className={cn(last && "text-foreground")}>
                      {item.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="size-3" strokeWidth={1.75} aria-hidden="true" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
