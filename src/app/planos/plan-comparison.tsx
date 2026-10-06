'use client'

import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PREMIUM_STOCK_MODELS_COUNT } from '@/lib/site-constants'

type PlanKey = 'free' | 'monthly' | 'annual'
type Cell = boolean | string

const PLANS: Array<{ key: PlanKey; label: string }> = [
  { key: 'free', label: 'Grátis' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'annual', label: 'Anual' },
]

const ROWS: Array<{ feature: string; values: Record<PlanKey, Cell> }> = [
  { feature: 'Fórmula de Graham', values: { free: true, monthly: true, annual: true } },
  { feature: `Os outros ${PREMIUM_STOCK_MODELS_COUNT} modelos de valuation de ações`, values: { free: false, monthly: true, annual: true } },
  { feature: 'Análises completas de empresas', values: { free: '3 por mês', monthly: 'Ilimitadas', annual: 'Ilimitadas' } },
  { feature: 'Rankings', values: { free: '3 por mês, top 10', monthly: 'Ilimitados', annual: 'Ilimitados' } },
  { feature: 'Comparador (até 6 ações)', values: { free: '3 por mês', monthly: 'Ilimitado', annual: 'Ilimitado' } },
  { feature: 'Screening', values: { free: '3 por mês', monthly: 'Ilimitado', annual: 'Ilimitado' } },
  { feature: 'Backtest de carteiras', values: { free: '1 por mês', monthly: 'Ilimitado', annual: 'Ilimitado' } },
  { feature: 'Síntese dos modelos com IA e relatórios', values: { free: false, monthly: true, annual: true } },
  { feature: 'Análise técnica', values: { free: false, monthly: true, annual: true } },
  { feature: 'Radar de oportunidades e de dividendos', values: { free: false, monthly: true, annual: true } },
  { feature: 'Carteiras com acompanhamento', values: { free: '1 carteira', monthly: true, annual: true } },
  { feature: 'Acesso antecipado a novos recursos', values: { free: false, monthly: false, annual: true } },
  { feature: 'Formas de pagamento', values: { free: false, monthly: 'Somente PIX', annual: 'PIX ou cartão' } },
  { feature: 'Suporte', values: { free: 'Padrão', monthly: 'Prioritário', annual: 'VIP' } },
]

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <Check className="ml-auto size-4 text-foreground md:mx-auto" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">Incluído</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <Minus className="ml-auto size-4 text-muted-foreground md:mx-auto" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">Não incluído</span>
      </>
    )
  }
  return <span className="text-foreground">{value}</span>
}

/** Tabela comparativa dos planos. No mobile, um seletor mostra uma coluna por vez. */
export function PlanComparison() {
  const [selected, setSelected] = useState<PlanKey>('annual')

  return (
    <div>
      <div role="radiogroup" aria-label="Plano exibido na tabela" className="mb-4 grid grid-cols-3 gap-1 rounded-md bg-muted p-1 md:hidden">
        {PLANS.map((plan) => (
          <button
            key={plan.key}
            type="button"
            role="radio"
            aria-checked={selected === plan.key}
            onClick={() => setSelected(plan.key)}
            className={cn(
              'h-11 rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
              selected === plan.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {plan.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação de recursos entre os planos Grátis, Mensal e Anual</caption>
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left font-medium sm:px-4">Recurso</th>
              {PLANS.map((plan) => (
                <th
                  key={plan.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2.5 text-right font-medium sm:px-4 md:table-cell md:w-40 md:text-center',
                    selected === plan.key ? 'table-cell' : 'hidden'
                  )}
                >
                  {plan.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => (
              <tr key={row.feature}>
                <th scope="row" className="px-3 py-3 text-left font-normal text-foreground sm:px-4">{row.feature}</th>
                {PLANS.map((plan) => (
                  <td
                    key={plan.key}
                    className={cn(
                      'px-3 py-3 text-right sm:px-4 md:table-cell md:text-center',
                      selected === plan.key ? 'table-cell' : 'hidden'
                    )}
                  >
                    <CellValue value={row.values[plan.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
