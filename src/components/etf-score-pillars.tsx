"use client";

import { InfoTooltip } from '@/components/info-tooltip';
import type { ScoreDimensions } from '@/lib/etf-scoring';

const PILLARS = [
  {
    key: 'custo' as const,
    label: 'Custo',
    weight: 0.18,
    tooltip:
      'Taxa de administração anual do ETF. Taxas menores preservam mais do seu retorno — ETFs abaixo de 0,20% a.a. são considerados de baixo custo.',
  },
  {
    key: 'retorno' as const,
    label: 'Retorno',
    weight: 0.22,
    tooltip:
      'Desempenho relativo ao grupo de ETFs com o mesmo índice de referência, considerando retorno de 1 ano.',
  },
  {
    key: 'liquidez' as const,
    label: 'Liquidez',
    weight: 0.18,
    tooltip:
      'Volume médio de negociação diária. ETFs mais líquidos têm spreads menores e são mais fáceis de comprar e vender sem impactar o preço.',
  },
  {
    key: 'solidez' as const,
    label: 'Solidez',
    weight: 0.12,
    tooltip:
      'Patrimônio líquido total do fundo. ETFs maiores são mais estáveis, têm menor risco de encerramento e spreads menores.',
  },
  {
    key: 'qualidadeCarteira' as const,
    label: 'Qualidade da Carteira',
    weight: 0.18,
    tooltip:
      'Média ponderada do score PJ dos ativos que compõem o ETF. Reflete a qualidade fundamentalista das empresas na carteira.',
  },
  {
    key: 'analiseIA' as const,
    label: 'Análise IA',
    weight: 0.12,
    tooltip:
      'Avaliação qualitativa por inteligência artificial considerando a qualidade do índice rastreado, reputação da gestora, coerência estratégica e adequação para investidores brasileiros.',
  },
] as const;

interface Props {
  dimensions: ScoreDimensions;
  overrideActive?: boolean;
}

export function EtfScorePillars({ dimensions, overrideActive }: Props) {
  return (
    <div className="space-y-3">
      {PILLARS.map((p) => {
        const raw = dimensions[p.key];
        const pts = (raw * p.weight).toFixed(1);
        return (
          <div key={p.key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1">
                {p.label}
                <InfoTooltip content={p.tooltip} />
              </span>
              <span className="text-muted-foreground">{pts} pts</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, raw))}%` }}
              />
            </div>
          </div>
        );
      })}
      {dimensions.concentracaoPenalty > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-amber-700 dark:text-amber-400">Penalidade concentração</span>
            <span className="text-amber-700 dark:text-amber-400">
              -{dimensions.concentracaoPenalty.toFixed(1)} pts
            </span>
          </div>
        </div>
      )}
      {overrideActive && (
        <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 pt-0.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Fundo espelho — concentração é estrutural, penalidade não aplicada</span>
        </div>
      )}
    </div>
  );
}
