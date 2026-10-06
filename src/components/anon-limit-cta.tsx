import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Aviso exibido quando o visitante anônimo atinge o limite de 2 visualizações completas.
 * Um único CTA: criar conta ganha 1 dia de acesso completo.
 */
export function AnonLimitCTA() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Você usou as 2 análises completas gratuitas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie uma conta para ver todos os modelos de valuation, o score e a análise com IA, com 1 dia de acesso
          completo. Já tem conta?{' '}
          <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
      <Button asChild variant="outline" className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto">
        <Link href="/register">Criar conta grátis</Link>
      </Button>
    </div>
  )
}
