'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import TechnicalAnalysisTrafficLight from './technical-analysis-traffic-light'

interface TechnicalAnalysisLinkProps {
  ticker: string
  userIsPremium: boolean
  currentPrice: number
  assetType?: 'STOCK' | 'BDR' | 'FII' | 'ETF'
}

const ROUTE_PREFIX: Record<NonNullable<TechnicalAnalysisLinkProps['assetType']>, string> = {
  STOCK: 'acao',
  BDR: 'bdr',
  FII: 'fii',
  ETF: 'etf',
}

const DESCRIPTION = 'Faixa de preço estimada por IA para os próximos 30 dias, a partir de indicadores técnicos.'

/** Bloco "Análise técnica" da página de ativo: posição do preço na faixa estimada e link para a análise completa. */
export default function TechnicalAnalysisLink({
  ticker,
  userIsPremium,
  currentPrice,
  assetType = 'STOCK'
}: TechnicalAnalysisLinkProps) {
  const { data: session, status } = useSession()
  // A API de análise técnica exige login: visitante anônimo (mesmo com acesso completo liberado) vê o bloqueio
  const canView = userIsPremium && status !== 'unauthenticated'
  const href = `/${ROUTE_PREFIX[assetType]}/${ticker.toLowerCase()}/analise-tecnica`
  const note = (
    <p className="text-xs text-muted-foreground">
      Complemento para quem investe no longo prazo; não é indicado para operações de curto prazo.
    </p>
  )

  if (!canView) {
    // Um único CTA primário por página (no cabeçalho do ativo): aqui só uma linha discreta com link
    const upsellLink = session?.user
      ? { label: 'Ver planos', href: '/planos' }
      : { label: 'Criar conta grátis', href: '/register' }

    return (
      <div className="space-y-4">
        <SectionHeader title="Análise técnica" description={DESCRIPTION} />
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <div aria-hidden="true" className="grid select-none grid-cols-1 gap-2 text-sm blur-sm sm:grid-cols-2">
            <p className="font-medium text-foreground">Técnica: dentro da faixa estimada</p>
            <p className="text-muted-foreground">Faixa estimada (30 dias) R$ 00,00 – R$ 00,00</p>
            <p className="text-muted-foreground">Preço justo técnico R$ 00,00</p>
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              Faixa estimada e preço justo técnico disponíveis no Premium.{' '}
              <Link
                href={upsellLink.href}
                className="whitespace-nowrap py-3 font-medium text-brand underline-offset-4 hover:underline"
              >
                {upsellLink.label}
              </Link>
            </span>
          </p>
        </div>
        {note}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Análise técnica"
        description={DESCRIPTION}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={href}>Ver análise completa</Link>
          </Button>
        }
      />
      <TechnicalAnalysisTrafficLight ticker={ticker} currentPrice={currentPrice} compact />
      {note}
    </div>
  )
}
