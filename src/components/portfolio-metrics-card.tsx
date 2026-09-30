'use client';

import { addMonths, differenceInMonths } from 'date-fns';
import { Stat } from '@/components/ui/stat';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatBRL, formatDate, formatDeltaPct, formatNumber, formatPct } from '@/lib/format';

interface PortfolioMetrics {
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  /** Capital líquido investido (totalInvested − totalWithdrawn). */
  netInvested?: number;
  totalDividends: number;
  /** Fração (0,271 = 27,1%). */
  totalReturn: number;
  annualizedReturn?: number | null;
  volatility?: number | null;
  sharpeRatio?: number | null;
  /** Fração positiva (0,12 = queda de 12%). */
  maxDrawdown?: number | null;
}

interface PortfolioMetricsCardProps {
  /** Ausente enquanto carrega (skeleton) ou se a API falhar (aviso com "Tentar de novo"). */
  metrics?: PortfolioMetrics | null;
  loading?: boolean;
  /** A requisição de métricas falhou. */
  error?: boolean;
  onRetry?: () => void;
  /** Data de início da carteira, para saber quando cada métrica fica disponível. */
  startDate?: Date | string;
}

function toTone(value: number | null | undefined): 'default' | 'positive' | 'negative' {
  if (typeof value !== 'number' || Math.round(Math.abs(value) * 1000) === 0) return 'default';
  return value > 0 ? 'positive' : 'negative';
}

/** Resumo da carteira em Stats: patrimônio, retorno e métricas de risco. */
export function PortfolioMetricsCard({ metrics, loading, error, onRetry, startDate }: PortfolioMetricsCardProps) {
  if (!loading && !metrics && error) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">Não foi possível carregar o resumo da carteira</p>
          <p className="mt-0.5 text-muted-foreground">Patrimônio, retorno e risco aparecem aqui quando o cálculo responder.</p>
        </div>
        {onRetry && (
          <Button variant="outline" className="shrink-0" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:p-5 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }

  const start = startDate ? new Date(startDate) : null;
  /** Texto para métricas que precisam de N meses de histórico, ou null se já deveriam existir. */
  const pendingCaption = (requiredMonths: number): string | null => {
    if (!start || Number.isNaN(start.getTime())) return null;
    if (differenceInMonths(new Date(), start) >= requiredMonths) return null;
    return `Disponível em ${formatDate(addMonths(start, requiredMonths))}`;
  };

  const netInvested = metrics.netInvested ?? metrics.totalInvested - metrics.totalWithdrawn;
  const hasValue = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value);

  const annualizedPending = pendingCaption(12);
  const riskPending = pendingCaption(2);

  return (
    <section aria-label="Resumo da carteira" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
        <Stat
          label="Patrimônio"
          value={formatBRL(metrics.currentValue)}
          caption={`Caixa ${formatBRL(metrics.cashBalance)}`}
        />
        <Stat
          label="Retorno total"
          value={formatDeltaPct(metrics.totalReturn)}
          tone={toTone(metrics.totalReturn)}
          caption={`Investido ${formatBRL(netInvested, { digits: 0 })}`}
          hint={
            metrics.totalWithdrawn > 0
              ? `Investido líquido: aportes de ${formatBRL(metrics.totalInvested)} menos saques de ${formatBRL(metrics.totalWithdrawn)}.`
              : `Investido líquido: ${formatBRL(netInvested)}.`
          }
        />
        {hasValue(metrics.annualizedReturn) ? (
          <Stat
            label="Retorno anualizado"
            value={formatDeltaPct(metrics.annualizedReturn)}
            tone={toTone(metrics.annualizedReturn)}
            caption="Por ano (CAGR)"
          />
        ) : annualizedPending ? (
          <Stat label="Retorno anualizado" value="—" caption={annualizedPending} hint="Requer 12 meses de histórico." />
        ) : null}
        {metrics.totalDividends > 0 && (
          <Stat label="Dividendos recebidos" value={formatBRL(metrics.totalDividends)} caption="Proventos creditados" />
        )}
        {hasValue(metrics.volatility) ? (
          <Stat label="Volatilidade" value={formatPct(metrics.volatility)} caption="Risco anualizado" />
        ) : riskPending ? (
          <Stat label="Volatilidade" value="—" caption={riskPending} hint="Requer 2 meses de histórico." />
        ) : null}
        {hasValue(metrics.sharpeRatio) ? (
          <Stat
            label="Índice Sharpe"
            value={formatNumber(metrics.sharpeRatio, { digits: 2 })}
            caption="Ajustado ao risco"
          />
        ) : annualizedPending ? (
          <Stat label="Índice Sharpe" value="—" caption={annualizedPending} hint="Requer 12 meses de histórico." />
        ) : null}
        {hasValue(metrics.maxDrawdown) ? (
          <Stat
            label="Maior queda"
            value={formatDeltaPct(-Math.abs(metrics.maxDrawdown))}
            tone={toTone(-Math.abs(metrics.maxDrawdown))}
            caption="Desde o pico anterior"
          />
        ) : riskPending ? (
          <Stat label="Maior queda" value="—" caption={riskPending} hint="Requer 2 meses de histórico." />
        ) : null}
        {metrics.totalWithdrawn > 0 && (
          <Stat label="Total sacado" value={formatBRL(metrics.totalWithdrawn)} caption="Saques realizados" />
        )}
      </div>
    </section>
  );
}
