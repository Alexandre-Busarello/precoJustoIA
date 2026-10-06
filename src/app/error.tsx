'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-lg px-4 py-16" role="alert">
      <p className="text-xs font-medium text-muted-foreground">Erro inesperado</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Algo falhou do nosso lado. Tente novamente em instantes; se o problema continuar, volte para a página inicial.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">
          Código do erro: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={reset}>
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir para a página inicial</Link>
        </Button>
      </div>
    </div>
  )
}
