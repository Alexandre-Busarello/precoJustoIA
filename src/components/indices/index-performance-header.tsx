/**
 * Resumo de performance do índice: retorno desde o início, pontos e dividendos (ou DY médio).
 */

import { Stat } from '@/components/ui/stat';
import { formatDeltaPct, formatNumber, formatPct } from '@/lib/format';

interface IndexPerformanceHeaderProps {
  currentPoints: number;
  /** Retorno acumulado, em pontos percentuais. */
  accumulatedReturn: number;
  /** DY médio ponderado, em pontos percentuais. */
  currentYield: number | null;
  /** Dividendos acumulados desde o início, em pontos do índice (base 100). */
  totalDividendsReceived?: number;
}

export function IndexPerformanceHeader({
  currentPoints,
  accumulatedReturn,
  currentYield,
  totalDividendsReceived = 0,
}: IndexPerformanceHeaderProps) {
  const totalReturn = accumulatedReturn / 100;

  return (
    <section aria-label="Performance do índice" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          label="Retorno desde o início"
          value={formatDeltaPct(totalReturn)}
          tone={totalReturn > 0 ? 'positive' : totalReturn < 0 ? 'negative' : 'default'}
          hint="O retorno já inclui o ajuste pelos dividendos recebidos pela carteira teórica."
          className="col-span-2 sm:col-span-1"
        />
        <Stat label="Pontos atuais" value={formatNumber(currentPoints, { digits: 2 })} caption="Base 100 no início" />
        {totalDividendsReceived > 0 ? (
          <Stat
            label="Dividendos acumulados"
            value={`${formatNumber(totalDividendsReceived, { digits: 2 })} pts`}
            caption="Já incluídos nos pontos"
          />
        ) : (
          <Stat label="DY médio" value={currentYield !== null ? formatPct(currentYield / 100) : '—'} />
        )}
      </div>
    </section>
  );
}
