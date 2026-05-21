import { type ReactNode } from 'react'

interface PreviewShellProps {
  children: ReactNode
  path?: string
}

export function PreviewShell({ children, path = '/dashboard' }: PreviewShellProps) {
  return (
    <div className="rounded-2xl bg-slate-100 p-2 ring-1 ring-slate-200">
      {/* Fake browser chrome */}
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
        <div className="flex gap-1.5 shrink-0">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <span className="h-3 w-3 rounded-full bg-green-400/80" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1">
          <span className="text-slate-300 text-xs select-none">🔒</span>
          <span className="truncate text-xs text-slate-400 select-none">precojusto.ai{path}</span>
        </div>
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-600 select-none">
          Preview
        </span>
      </div>

      {children}

      {/* Disclaimer */}
      <p className="mt-2 px-1 text-center text-xs italic text-slate-400">
        Reprodução ilustrativa — o design e dados reais da plataforma podem variar
      </p>
    </div>
  )
}
