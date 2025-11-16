'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import CompactScore from '@/components/compact-score';
import { usePremiumStatus } from '@/hooks/use-premium-status';

// Interface para score geral
interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssima';
}

interface HeaderScoreWrapperProps {
  ticker: string;
}

export default function HeaderScoreWrapper({ ticker }: HeaderScoreWrapperProps) {
  const { data: session } = useSession();
  const { isPremium } = usePremiumStatus();
  const [overallScore, setOverallScore] = useState<OverallScore | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    async function fetchScore() {
      if (!ticker) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/company-analysis/${ticker}`);
        
        if (response.ok) {
          const data = await response.json();
          setOverallScore(data.overallScore);
        }
      } catch (error) {
        console.error('Erro ao buscar score:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchScore();
  }, [ticker]);

  if (loading) {
    return (
      <Card className="w-full lg:w-80">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">Score Geral</p>
          <div className="w-20 h-20 mx-auto bg-muted/50 rounded-full animate-pulse mb-3" />
          <p className="text-xs text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full lg:w-80">
      <CardContent className="p-6">
        <CompactScore 
          overallScore={overallScore}
          isPremium={isPremium ?? false}
          isLoggedIn={isLoggedIn}
          ticker={ticker}
        />
      </CardContent>
    </Card>
  );
}
