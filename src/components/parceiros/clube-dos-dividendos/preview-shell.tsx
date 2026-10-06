import { Lock } from 'lucide-react'
import { type ReactNode } from 'react'

interface PreviewShellProps {
  children: ReactNode
  path?: string
}

export function PreviewShell({ children, path = '/dashboard' }: PreviewShellProps) {
  return (
    <div className="rounded-lg bg-muted p-2 ring-1 ring-border">
      {/* Fake browser chrome */}
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-sm ring-1 ring-border">
        <div className="flex gap-1.5 shrink-0">
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1">
          <Lock className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate text-xs text-muted-foreground select-none">precojusto.ai{path}</span>
        </div>
        <span className="shrink-0 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand select-none">
          Preview
        </span>
      </div>

      {children}

      {/* Disclaimer */}
      <p className="mt-2 px-1 text-center text-xs italic text-muted-foreground">
        Reprodução ilustrativa — o design e dados reais da plataforma podem variar
      </p>
    </div>
  )
}
