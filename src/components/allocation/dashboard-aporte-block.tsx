'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PortfolioMoneyInput } from '@/components/portfolio-money-input'
import { MIN_AMOUNT } from '@/lib/allocation/constants'

export interface DashboardAporteBlockProps {
  isPremium: boolean
  portfolios: { id: string; name: string }[]
  radarCount: number
}

type Target = { kind: 'portfolio'; id: string } | { kind: 'radar' } | { kind: 'market' } | { kind: 'tickers' }

function targetKey(target: Target): string {
  return target.kind === 'portfolio' ? `portfolio:${target.id}` : target.kind
}

/**
 * Bloco principal do dashboard: "Onde aportar este mês". Valor + universo (carteira principal, radar ou, sem
 * nenhum dos dois, "Todo o mercado" no Premium) e abre `/onde-aportar` já preenchido.
 */
export function DashboardAporteBlock({ isPremium, portfolios, radarCount }: DashboardAporteBlockProps) {
  const router = useRouter()
  const [amount, setAmount] = useState<number | undefined>(1000)
  const options: { target: Target; label: string }[] = [
    ...portfolios.map((p) => ({ target: { kind: 'portfolio', id: p.id } as Target, label: /^carteira\b/i.test(p.name) ? p.name : `Carteira ${p.name}` })),
    ...(radarCount > 0 ? [{ target: { kind: 'radar' } as Target, label: 'Meu radar' }] : []),
    ...(isPremium ? [{ target: { kind: 'market' } as Target, label: 'Todo o mercado' }] : []),
    { target: { kind: 'tickers' }, label: 'Escolher tickers' },
  ]
  const fallback = isPremium && portfolios.length === 0 && radarCount === 0 ? 'market' : targetKey(options[0].target)
  const [selected, setSelected] = useState(fallback)

  const open = () => {
    const target = options.find((o) => targetKey(o.target) === selected)?.target ?? { kind: 'tickers' }
    const params = new URLSearchParams()
    if (amount && amount >= MIN_AMOUNT) params.set('valor', String(amount))
    if (target.kind === 'portfolio') params.set('carteira', target.id)
    if (target.kind === 'radar') params.set('universo', 'radar')
    if (target.kind === 'market') params.set('universo', 'mercado')
    // Com carteira ou radar, já calcula; "Todo o mercado" pede a escolha do critério antes.
    if (isPremium && (target.kind === 'portfolio' || target.kind === 'radar')) params.set('calcular', '1')
    router.push(`/onde-aportar?${params.toString()}`)
  }

  return (
    <section aria-labelledby="aporte-mes-titulo" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 id="aporte-mes-titulo" className="text-lg font-semibold text-foreground">
            Onde aportar este mês
          </h2>
          <p className="text-sm text-muted-foreground">Simule a distribuição do seu aporte segundo os seus critérios, com o motivo de cada ativo.</p>
        </div>
        <form
          data-ben-fab-avoid
          className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,16rem)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            open()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-aporte-valor" className="text-xs text-muted-foreground">
              Valor
            </Label>
            <PortfolioMoneyInput id="dashboard-aporte-valor" value={amount} onValueChange={setAmount} enterKeyHint="go" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-aporte-universo" className="text-xs text-muted-foreground">
              Entre
            </Label>
            <select
              id="dashboard-aporte-universo"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-ring md:h-9 md:text-sm"
            >
              {options.map((option) => (
                <option key={targetKey(option.target)} value={targetKey(option.target)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Calcular distribuição</Button>
        </form>
      </div>
    </section>
  )
}
