'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import CompactScore from '@/components/compact-score';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useCompanyAnalysis } from '@/hooks/use-company-data';

interface HeaderScoreWrapperProps {
  ticker: string;
  /** Quando true (ex: anônimo com 2 usos restantes), mostra score completo sem paywall */
  canViewFullContent?: boolean;
}

interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssima';
}

interface CompanyAnalysisResponse {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | null;
  strategies: unknown;
}

export default function HeaderScoreWrapper({ ticker, canViewFullContent }: HeaderScoreWrapperProps) {
  const { data: session } = useSession();
  const { isPremium } = usePremiumStatus();
  const effectiveIsPremium = canViewFullContent ?? isPremium ?? false;
  const { data: analysisData, isLoading } = useCompanyAnalysis(ticker, effectiveIsPremium);
  
  const isLoggedIn = !!session?.user;
  const overallScore = (analysisData as CompanyAnalysisResponse | undefined)?.overallScore ?? null;

  if (isLoading) {
    return (
      <Card className="w-full lg:w-80">
        <CardContent className="p-4 lg:p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">Score Geral</p>
          <div className="w-20 h-20 mx-auto bg-muted/50 rounded-full animate-pulse mb-2" />
          <p className="text-xs text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full lg:w-80">
      <CardContent className="p-4 lg:p-4">
        <CompactScore 
          overallScore={overallScore}
          isPremium={effectiveIsPremium}
          isLoggedIn={isLoggedIn}
          ticker={ticker}
        />
      </CardContent>
    </Card>
  );
}
