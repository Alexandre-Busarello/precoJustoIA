import Link from 'next/link'
import { formatBRL, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

export const SHOWCASE_METHOD_HREF = '/metodologia#backtest'
export const SHOWCASE_RISK_NOTE = 'Rentabilidade passada não garante resultados futuros. Simulação, não é recomendação.'

/** "Calculado em 9 out. 2026" (dia civil em Brasília). */
export function computedLabel(computedAt: string): string {
  return `Calculado em ${formatDate(computedAt)}`
}

interface ShowcaseDisclosureProps {
  computedAt: string
  tradingCostRate: number
  /** Total de custos da carteira, em reais. Ausente na faixa compacta (cada carteira tem o seu). */
  totalTradingCosts?: number
  shortenedWindow: boolean
  /** O card compara com o Ibovespa (índice de preço); a faixa compacta não. */
  mentionsIbovespa?: boolean
  className?: string
}

/** Rodapé obrigatório da vitrine: custos, o que não entra, benchmark, data do cálculo, aviso e link da metodologia. */
export function ShowcaseDisclosure({
  computedAt,
  tradingCostRate,
  totalTradingCosts,
  shortenedWindow,
  mentionsIbovespa = true,
  className,
}: ShowcaseDisclosureProps) {
  const cost = formatPct(tradingCostRate, { digits: 2 })
  return (
    <div className={cn('space-y-1.5 text-xs leading-5 text-muted-foreground', className)}>
      <p>
        {typeof totalTradingCosts === 'number' ? (
          <>
            Custo de <span className="tabular-nums">{cost}</span> por operação, <span className="tabular-nums">{formatBRL(totalTradingCosts)}</span> no
            total.
          </>
        ) : (
          <>
            Custo de <span className="tabular-nums">{cost}</span> por operação.
          </>
        )}{' '}
        IR sobre ganho de capital e spread não incluídos.
        {mentionsIbovespa && ' CDI e Ibovespa com os mesmos aportes; Ibovespa como índice de preço, sem dividendos.'}
        {shortenedWindow && ' Período encurtado ao histórico comum das três carteiras.'}
      </p>
      <p>
        {computedLabel(computedAt)}. {SHOWCASE_RISK_NOTE}
      </p>
      <Link
        href={SHOWCASE_METHOD_HREF}
        className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4 hover:text-brand md:min-h-6"
      >
        Como a simulação funciona
      </Link>
    </div>
  )
}
