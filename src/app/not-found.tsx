import type { Metadata } from 'next'
import Link from 'next/link'
import CompanySearch from '@/components/company-search'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs font-medium text-muted-foreground">Erro 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O endereço pode ter mudado ou não existe mais. Busque um ativo pelo ticker ou pelo nome, ou volte para a página
        inicial.
      </p>
      <CompanySearch
        placeholder="Digite um ticker, ex.: PETR4"
        className="mt-6 [&_input]:h-11 [&_input]:text-base"
      />
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Ir para a página inicial</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/ranking">Ver rankings</Link>
        </Button>
      </div>
    </div>
  )
}
