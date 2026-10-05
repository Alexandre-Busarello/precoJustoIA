'use client'

/**
 * Resumo da simulação: qual estratégia termina com maior patrimônio líquido e a comparação lado a lado.
 */

import { formatBRL, formatNumber, formatPct } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/ui/section-header'
import { Stat } from '@/components/ui/stat'

interface StrategyResults {
  breakEvenMonth: number | null
  finalDebtBalance: number
  finalInvestedBalance: number
  finalNetWorth: number
  totalInterestPaid: number
  totalInvestmentContribution: number
  totalInvestmentReturn: number
  totalMonths: number
}

interface SimulationSummaryProps {
  sniperResults: StrategyResults
  hybridResults: StrategyResults
  /** Rentabilidade anual considerada, como fração. */
  rentabilityRate: number
}

const ROWS: Array<{ label: string; value: (r: StrategyResults) => string }> = [
  { label: 'Patrimônio líquido final', value: (r) => formatBRL(r.finalNetWorth) },
  { label: 'Patrimônio investido', value: (r) => formatBRL(r.finalInvestedBalance) },
  { label: 'Saldo devedor final', value: (r) => formatBRL(r.finalDebtBalance) },
  { label: 'Juros pagos', value: (r) => formatBRL(r.totalInterestPaid) },
  { label: 'Total aportado', value: (r) => formatBRL(r.totalInvestmentContribution) },
  { label: 'Rendimento dos investimentos', value: (r) => formatBRL(r.totalInvestmentReturn) },
  {
    label: 'Break-even',
    value: (r) => (r.breakEvenMonth ? `Mês ${formatNumber(r.breakEvenMonth, { digits: 0 })}` : 'Não atingido'),
  },
  { label: 'Duração simulada', value: (r) => `${formatNumber(r.totalMonths, { digits: 0 })} meses` },
]

export function SimulationSummary({ sniperResults, hybridResults, rentabilityRate }: SimulationSummaryProps) {
  const sniperAhead = sniperResults.finalNetWorth >= hybridResults.finalNetWorth
  const leader = sniperAhead ? 'Sniper' : 'Híbrida'
  const netWorthDifference = Math.abs(sniperResults.finalNetWorth - hybridResults.finalNetWorth)
  const interestDifference = hybridResults.totalInterestPaid - sniperResults.totalInterestPaid
  const breakEvenGap =
    sniperResults.breakEvenMonth && hybridResults.breakEvenMonth
      ? hybridResults.breakEvenMonth - sniperResults.breakEvenMonth
      : null

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
      <SectionHeader
        title="Resumo da simulação"
        description={`Rentabilidade considerada para os investimentos: ${formatPct(rentabilityRate)} ao ano.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Maior patrimônio líquido"
          value={`Estratégia ${leader}`}
          caption={`${formatBRL(netWorthDifference)} acima da outra`}
          size="sm"
        />
        <Stat
          label="Diferença em juros pagos"
          value={formatBRL(Math.abs(interestDifference))}
          caption={interestDifference >= 0 ? 'a menos com a Sniper' : 'a menos com a Híbrida'}
          size="sm"
        />
        <Stat
          label="Break-even"
          value={
            breakEvenGap === null
              ? '—'
              : breakEvenGap === 0
                ? 'Mesmo mês'
                : `${formatNumber(Math.abs(breakEvenGap), { digits: 0 })} meses antes`
          }
          caption={breakEvenGap === null ? 'não atingido nas duas' : breakEvenGap > 0 ? 'com a Sniper' : breakEvenGap < 0 ? 'com a Híbrida' : undefined}
          size="sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação entre as estratégias Sniper e Híbrida</caption>
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="h-9 px-3 text-left font-medium">
                Indicador
              </th>
              <th scope="col" className="h-9 px-3 text-right font-medium">
                <span className="inline-flex items-center gap-1.5">
                  Sniper {sniperAhead && <Badge variant="brand">Maior PL</Badge>}
                </span>
              </th>
              <th scope="col" className="h-9 px-3 text-right font-medium">
                <span className="inline-flex items-center gap-1.5">
                  Híbrida {!sniperAhead && <Badge variant="brand">Maior PL</Badge>}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="h-10 border-b border-border last:border-0">
                <th scope="row" className="px-3 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                <td className="px-3 text-right whitespace-nowrap tabular-nums">{row.value(sniperResults)}</td>
                <td className="px-3 text-right whitespace-nowrap tabular-nums">{row.value(hybridResults)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sniperAhead && sniperResults.finalInvestedBalance < hybridResults.finalInvestedBalance && (
        <p className="text-sm leading-6 text-muted-foreground">
          A Sniper termina com menos patrimônio investido, mas com patrimônio líquido maior: quitar a dívida antes evita{' '}
          {formatBRL(interestDifference)} em juros, o que compensa a diferença de aportes.
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Simulação matemática com as premissas informadas. Não é recomendação de investimento.
      </p>
    </section>
  )
}
