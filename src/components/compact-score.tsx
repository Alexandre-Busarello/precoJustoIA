'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ScoreCard } from '@/components/asset/score-card';

interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssima';
}

interface CompactScoreProps {
  overallScore: OverallScore | null;
  isPremium: boolean;
  isLoggedIn: boolean;
  ticker?: string;
}

/**
 * Score geral compacto (wrapper do ScoreCard) com link para o detalhamento. Bloqueado, mostra só uma linha discreta
 * com link: o CTA primário da página fica no cabeçalho do ativo.
 */
export default function CompactScore({ overallScore, isPremium, isLoggedIn, ticker }: CompactScoreProps) {
  const locked = !isPremium;
  // Premium sem score calculado: estado vazio, sem blur nem CTA de desbloqueio
  if (!locked && !overallScore) {
    return <p className="text-sm text-muted-foreground">Score ainda não calculado para este ativo.</p>;
  }

  return (
    <div className="space-y-3">
      <ScoreCard
        variant="compact"
        score={overallScore?.score ?? null}
        label={overallScore?.classification}
        locked={locked}
      />
      {locked ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {isLoggedIn ? 'Disponível no Premium.' : 'Disponível com conta grátis.'}{' '}
            <Link
              href={isLoggedIn ? '/planos' : '/register'}
              className="whitespace-nowrap py-3 font-medium text-brand underline-offset-4 hover:underline"
            >
              {isLoggedIn ? 'Ver planos' : 'Criar conta grátis'}
            </Link>
          </span>
        </p>
      ) : (
        ticker && (
          <Link
            href={`/acao/${ticker.toLowerCase()}/entendendo-score`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
          >
            Como o score é calculado
          </Link>
        )
      )}
    </div>
  );
}
