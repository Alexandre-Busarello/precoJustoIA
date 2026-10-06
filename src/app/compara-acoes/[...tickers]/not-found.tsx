import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comparação não encontrada</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Uma ou mais ações não foram encontradas na nossa base, ou a comparação tem menos de 2 tickers. Confira os
          códigos e tente de novo, por exemplo em /compara-acoes/vale3/petr4/itub4.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/comparador">Escolher ações</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/compara-acoes/vale3/petr4">Ver VALE3 vs PETR4</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
