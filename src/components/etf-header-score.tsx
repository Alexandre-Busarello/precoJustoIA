import type { EtfScoreResult } from '@/lib/etf-score-loader';
import { EtfScorePillars } from '@/components/etf-score-pillars';

interface Props {
  /** Resultado de `getCachedEtfScore` (null quando o histórico é insuficiente). */
  result: EtfScoreResult | null;
  /** Premium bloqueado: mostra a estrutura dos pilares sem valores. */
  locked?: boolean;
  className?: string;
}

/** Classificação textual do score PJ-ETF (0–100). */
export function etfScoreClassification(score: number): string {
  if (score >= 70) return 'Excelente';
  if (score >= 55) return 'Bom';
  if (score >= 40) return 'Regular';
  return 'Fraco';
}

/** Painel do score PJ-ETF (ScoreCard `full` com os seis pilares). */
export function EtfHeaderScore({ result, locked = false, className }: Props) {
  if (locked) {
    return <EtfScorePillars score={null} dimensions={null} locked className={className} />;
  }

  if (!result) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium text-foreground">Score PJ-ETF</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Score indisponível: histórico de retorno insuficiente para este ETF.
          </p>
        </div>
      </div>
    );
  }

  return (
    <EtfScorePillars
      score={result.score}
      label={etfScoreClassification(result.score)}
      dimensions={result.dimensions}
      overrideActive={result.aiConcentracaoPenaltyOverride}
      className={className}
    />
  );
}
