'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL, formatNumber } from '@/lib/format'
import { FREE_MAX_TICKERS } from '@/lib/allocation/constants'
import type { AllocationResult } from '@/lib/allocation/types'
import type { LockReason } from '@/lib/allocation/service'
import { FunnelLine } from './market-transparency'

const COPY: Record<LockReason, { title: string; text: string }> = {
  login: {
    title: 'Entre para usar sua carteira ou seu radar',
    text: 'Com uma conta, a distribuição considera as posições e os pesos-alvo da sua carteira.',
  },
  'premium-tickers': {
    title: `No plano gratuito, até ${FREE_MAX_TICKERS} ativos por simulação`,
    text: 'O Premium libera quantos ativos você quiser e todos os modelos de valuation.',
  },
  'premium-universe': {
    title: 'Distribuição pela carteira e pelo radar no Premium',
    text: 'A prévia abaixo usa os seus ativos de verdade; os valores e os motivos ficam disponíveis no Premium.',
  },
  'premium-market': {
    title: 'Todo o mercado é um recurso Premium',
    text: 'A prévia mostra quantos ativos passaram em cada filtro; os ativos, as quantidades e os motivos ficam no Premium.',
  },
}

interface AllocationLockedProps {
  reason: LockReason
  preview: AllocationResult
  isLoggedIn: boolean
}

/** Estado bloqueado: prévia real desfocada (sem ativos nem valores) e um único CTA. */
export function AllocationLocked({ reason, preview, isLoggedIn }: AllocationLockedProps) {
  const copy = COPY[reason]
  const cta =
    reason === 'login' || !isLoggedIn
      ? { label: 'Desbloquear com 1 dia grátis', href: '/register?callbackUrl=/onde-aportar' }
      : { label: 'Desbloquear no Premium', href: '/checkout' }
  const rows = Math.max(3, Math.min(5, preview.allocations.length))
  return (
    <section aria-labelledby="bloqueado-titulo" className="space-y-4">
      {preview.funnel && <FunnelLine steps={preview.funnel} />}
      <div className="relative min-h-64 overflow-hidden rounded-lg border border-border bg-card">
        <ul aria-hidden="true" className="pointer-events-none divide-y divide-border blur-sm select-none">
          {Array.from({ length: rows }, (_, index) => (
            <li key={index} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{preview.allocations[index]?.ticker ?? `ATIVO${index + 1}`}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(10 + index * 7)} × {formatBRL(24.9 + index * 3.1)}
              </span>
              <span className="font-medium tabular-nums text-foreground">{formatBRL(400 - index * 35)}</span>
            </li>
          ))}
        </ul>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 px-4 text-center">
          <Lock className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <div className="space-y-1">
            <h2 id="bloqueado-titulo" className="text-sm font-semibold text-foreground">
              {copy.title}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">{copy.text}</p>
          </div>
          <Button asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
