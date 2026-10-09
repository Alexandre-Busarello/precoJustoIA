import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Só o noindex: sobrescreve o `index, follow` herdado do layout raiz (sem robots duplicado e contraditório no 404)
export const metadata: Metadata = {
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-medium text-muted-foreground">Erro 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Ticker não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não encontramos este ticker na nossa base ou ele ainda não foi processado. Confira se o código está correto
          (por exemplo, VALE3, PETR4 ou ITUB4) e se a empresa é listada na B3.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/ranking">Ver rankings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Ir para o painel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
