'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Lucide Icons
import { Crown, Calculator } from 'lucide-react';

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

function CompactScoreGauge({ score, grade }: { score: number; grade: string }) {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600 dark:text-green-400';
    if (grade.startsWith('B')) return 'text-blue-600 dark:text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-600 dark:text-yellow-400';
    if (grade.startsWith('D')) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 70) return 'stroke-blue-500';
    if (score >= 60) return 'stroke-yellow-500';
    if (score >= 50) return 'stroke-orange-500';
    return 'stroke-red-500';
  };

  const circumference = 2 * Math.PI * 30;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20">
      <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 70 70">
        {/* Background circle */}
        <circle
          cx="35"
          cy="35"
          r="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="35"
          cy="35"
          r="30"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={getScoreColor(score)}
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out',
          }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold">{score}</span>
        <span className={`text-sm font-bold ${getGradeColor(grade)}`}>{grade}</span>
      </div>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'Empresa Excelente':
        return { variant: 'default' as const, className: 'bg-green-600 text-white text-xs' };
      case 'Empresa Boa':
        return { variant: 'default' as const, className: 'bg-green-500 text-white text-xs' };
      case 'Empresa Regular':
        return { variant: 'secondary' as const, className: 'bg-yellow-500 text-white text-xs' };
      case 'Empresa Fraca':
        return { variant: 'destructive' as const, className: 'bg-red-500 text-white text-xs' };
      case 'Empresa Péssima':
        return { variant: 'destructive' as const, className: 'bg-red-600 text-white text-xs' };
      default:
        return { variant: 'secondary' as const, className: 'text-xs' };
    }
  };

  const { variant, className } = getRecommendationStyle(recommendation);

  return (
    <Badge variant={variant} className={`px-2 py-0.5 ${className}`}>
      {recommendation}
    </Badge>
  );
}

export default function CompactScore({ overallScore, isPremium, isLoggedIn, ticker }: CompactScoreProps) {
  // Para usuários Premium - mostrar score real
  if (isPremium && overallScore) {
    return (
      <div className="flex flex-col items-center w-full">
        {/* Título */}
        <div className="mb-2 text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center space-x-1">
            <span>Score Geral</span>
            <Crown className="w-3 h-3 text-yellow-500" />
          </p>
        </div>

        {/* Gauge centralizado */}
        <div className="mb-2">
          <CompactScoreGauge score={overallScore.score} grade={overallScore.grade} />
        </div>

        {/* Classificação */}
        <p className="text-sm text-center text-muted-foreground mb-2">
          {overallScore.classification}
        </p>

        {/* Recomendação */}
        <div className="w-full flex justify-center mb-2">
          <RecommendationBadge recommendation={overallScore.recommendation} />
        </div>

        {/* Botão Ver Breakdown */}
        {ticker && (
          <Button asChild variant="outline" size="sm" className="w-full text-xs">
            <Link href={`/acao/${ticker.toLowerCase()}/entendendo-score`}>
              <Calculator className="w-3 h-3 mr-1" />
              Entender Score
            </Link>
          </Button>
        )}
      </div>
    );
  }

  // Para usuários não Premium - mostrar com blur
  return (
    <div className="flex flex-col items-center w-full relative min-h-[160px]">
      {/* Título */}
      <div className="mb-2 text-center">
        <p className="text-sm text-muted-foreground flex items-center justify-center space-x-1">
          <span>Score Geral</span>
          <Crown className="w-3 h-3 text-yellow-500" />
        </p>
      </div>
      
      {/* Conteúdo com blur */}
      <div className="filter blur-sm pointer-events-none select-none flex flex-col items-center">
        <div className="mb-2">
          <CompactScoreGauge score={75} grade="B" />
        </div>
        <p className="text-sm text-center text-muted-foreground mb-3">
          Bom
        </p>
        <RecommendationBadge recommendation="Empresa Boa" />
      </div>

      {/* Overlay para Premium/Login */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg border border-dashed border-orange-300">
        <Crown className="w-6 h-6 text-orange-600 mb-2" />
        <p className="text-xs text-muted-foreground mb-2 text-center px-2">
          {isLoggedIn ? "Upgrade para ver o score real" : "Faça login para ver o score"}
        </p>
        <Button asChild size="sm" variant="outline" className="text-xs">
          <Link href={isLoggedIn ? "/checkout" : "/login"}>
            {isLoggedIn ? "Upgrade Premium" : "Fazer Login"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
