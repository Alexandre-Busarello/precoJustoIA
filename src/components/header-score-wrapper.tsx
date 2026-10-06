'use client';

import { useSession } from 'next-auth/react';
import CompactScore from '@/components/compact-score';
import { Skeleton } from '@/components/ui/skeleton';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useHydratedCompanyAnalysis } from '@/components/strategic-analysis-client';

interface HeaderScoreWrapperProps {
  ticker: string;
  /** Quando true (ex: anônimo com 2 usos restantes), mostra score completo sem paywall */
  canViewFullContent?: boolean;
}

type CompactScoreProps = Parameters<typeof CompactScore>[0];

/** Painel do score geral usado nos cabeçalhos de ativo (ScoreCard compacto dentro de uma borda fina). */
export default function HeaderScoreWrapper({ ticker, canViewFullContent }: HeaderScoreWrapperProps) {
  const { data: session } = useSession();
  const { isPremium } = usePremiumStatus();
  const effectiveIsPremium = canViewFullContent ?? isPremium ?? false;
  const { data: analysisData, isLoading } = useHydratedCompanyAnalysis(ticker, effectiveIsPremium);
  const overallScore = ((analysisData as { overallScore?: CompactScoreProps['overallScore'] } | undefined)?.overallScore) ?? null;

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4 lg:w-80">
      <p className="mb-2 text-sm font-medium text-foreground">Score</p>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ) : (
        <CompactScore
          overallScore={overallScore}
          isPremium={effectiveIsPremium}
          isLoggedIn={!!session?.user}
          ticker={ticker}
        />
      )}
    </div>
  );
}
