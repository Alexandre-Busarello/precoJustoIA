import { formatNumber, formatPct } from '@/lib/format';
import type { ScoreDimensions } from '@/lib/etf-scoring';
import { ScoreCard, type ScorePillar } from '@/components/asset/score-card';

const PILLARS = [
  {
    key: 'custo' as const,
    label: 'Custo',
    weight: 0.18,
    hint: 'Taxa de administração anual do ETF. Taxas menores preservam mais do seu retorno; abaixo de 0,20% a.a. é considerado baixo custo.',
  },
  {
    key: 'retorno' as const,
    label: 'Retorno',
    weight: 0.22,
    hint: 'Retorno de 12 meses comparado ao dos ETFs com o mesmo índice de referência.',
  },
  {
    key: 'liquidez' as const,
    label: 'Liquidez',
    weight: 0.18,
    hint: 'Volume médio de negociação diária. ETFs mais líquidos têm spreads menores e são negociados sem impactar o preço.',
  },
  {
    key: 'solidez' as const,
    label: 'Solidez',
    weight: 0.12,
    hint: 'Patrimônio líquido do fundo. ETFs maiores tendem a ser mais estáveis e com menor risco de encerramento.',
  },
  {
    key: 'qualidadeCarteira' as const,
    label: 'Qualidade da carteira',
    weight: 0.18,
    hint: 'Média ponderada do score PJ dos ativos que compõem o ETF.',
  },
  {
    key: 'analiseIA' as const,
    label: 'Análise IA',
    weight: 0.12,
    hint: 'Avaliação qualitativa gerada por IA: índice rastreado, gestora, coerência da estratégia e adequação ao investidor brasileiro.',
  },
] as const;

interface Props {
  /** 0–100; null quando bloqueado. */
  score: number | null;
  label?: string;
  dimensions: ScoreDimensions | null;
  overrideActive?: boolean;
  locked?: boolean;
  className?: string;
}

/** Score PJ-ETF no ScoreCard único (variante `full`): número, rótulo e barras finas por pilar. */
export function EtfScorePillars({ score, label, dimensions, overrideActive, locked = false, className }: Props) {
  const pillars: ScorePillar[] = PILLARS.map((pillar) => ({
    label: pillar.label,
    value: dimensions ? dimensions[pillar.key] : null,
    hint: `${pillar.hint} Peso ${formatPct(pillar.weight, { digits: 0 })} no score.`,
  }));
  const penalty = !locked && dimensions ? dimensions.concentracaoPenalty : 0;

  return (
    <div className={className}>
      <ScoreCard title="Score PJ-ETF" score={score} label={label} pillars={pillars} locked={locked} />
      {(penalty > 0 || (!locked && overrideActive)) && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {penalty > 0 && (
            <p className="flex items-center justify-between gap-2">
              <span>Penalidade por concentração da carteira</span>
              <span className="font-medium tabular-nums text-warning">−{formatNumber(penalty, { digits: 1 })} pts</span>
            </p>
          )}
          {overrideActive && <p>Fundo espelho: a concentração é estrutural e a penalidade não é aplicada.</p>}
        </div>
      )}
    </div>
  );
}
