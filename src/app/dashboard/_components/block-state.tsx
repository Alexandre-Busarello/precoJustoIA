'use client'

import type { ReactNode } from 'react'
import { RotateCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Estado de erro de um bloco do dashboard: mensagem curta + "Tentar novamente". */
export function BlockError({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      data-block-error
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        <RotateCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  )
}

/** Estado vazio de um bloco: uma frase + uma ação. */
export function BlockEmpty({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
