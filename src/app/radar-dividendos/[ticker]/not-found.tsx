import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-12">
      <div className="rounded-lg border border-border px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ticker não encontrado</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Não encontramos este ticker no radar de dividendos. Confira o código ou busque pela empresa no radar.
        </p>
        <Button asChild className="mt-6">
          <Link href="/radar-dividendos">Voltar ao radar de dividendos</Link>
        </Button>
      </div>
    </div>
  )
}
