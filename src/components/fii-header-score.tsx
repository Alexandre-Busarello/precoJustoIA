import type { FiiOverallScore } from "@/lib/strategies/fii-overall-score";
import { formatPct } from "@/lib/format";
import { ScoreCard, type ScorePillar } from "@/components/asset/score-card";

interface Props {
  /** Resultado de `getCachedFiiOverallScore` (null quando não há dados suficientes). */
  score: FiiOverallScore | null;
  /** Premium bloqueado: mostra a estrutura dos pilares sem valores. */
  locked?: boolean;
  className?: string;
}

const PILLARS: Array<{ key: keyof FiiOverallScore["breakdown"]; label: string; hint: string }> = [
  { key: "dividendos", label: "Dividendos", hint: "Dividend yield, regularidade e estabilidade dos rendimentos e payout sobre o FFO." },
  { key: "valuation", label: "Valuation", hint: "P/VP, cap rate (tijolo) ou FFO yield (papel) e distância entre cotação e valor patrimonial." },
  { key: "qualidadePortfolio", label: "Qualidade do portfólio", hint: "Tijolo: número de imóveis, vacância e aluguel por m². Papel: segmento e consistência dos rendimentos." },
  { key: "liquidez", label: "Liquidez", hint: "Volume médio negociado por dia e valor de mercado." },
  { key: "gestao", label: "Segmento e resiliência", hint: "Resiliência do segmento de atuação do fundo." },
];

/** "Muito Bom" → "Muito bom" (sentence case). */
export function fiiScoreLabel(classification: FiiOverallScore["classification"]): string {
  return classification.charAt(0) + classification.slice(1).toLowerCase();
}

/** Score PJ-FII no mesmo ScoreCard de ação, ETF e BDR: número, rótulo e barras finas por pilar. */
export function FiiHeaderScore({ score, locked = false, className }: Props) {
  if (!locked && !score) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <p className="text-sm font-medium text-foreground">Score PJ-FII</p>
          <p className="mt-2 text-sm text-muted-foreground">Score indisponível: dados insuficientes para este fundo.</p>
        </div>
      </div>
    );
  }

  const pillars: ScorePillar[] = PILLARS.map((pillar) => {
    const data = score?.breakdown[pillar.key];
    return {
      label: data?.label ?? pillar.label,
      value: data ? data.score : null,
      hint: data ? `${pillar.hint} Peso ${formatPct(data.weight, { digits: 0 })} no score.` : pillar.hint,
    };
  });

  return (
    <div className={className}>
      <ScoreCard
        title="Score PJ-FII"
        score={score?.score ?? null}
        label={score ? fiiScoreLabel(score.classification) : undefined}
        pillars={pillars}
        locked={locked}
      />
      {!locked && score && (score.strengths.length > 0 || score.weaknesses.length > 0 || score.flags?.length) ? (
        <div className="mt-3 space-y-3 text-sm">
          {score.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pontos fortes</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                {score.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {score.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pontos de atenção</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
                {score.weaknesses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {score.flags?.length ? <p className="text-xs text-warning">{score.flags.join(" · ")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
