'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Lucide Icons
import { 
  Award, 
  TrendingUp, 
  Crown, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';

interface OverallScore {
  score: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'Excelente' | 'Muito Bom' | 'Bom' | 'Regular' | 'Fraco' | 'Péssimo';
  strengths: string[];
  weaknesses: string[];
  recommendation: 'Empresa Excelente' | 'Empresa Boa' | 'Empresa Regular' | 'Empresa Fraca' | 'Empresa Péssimo';
}

interface OverallScoreCardProps {
  ticker: string;
  overallScore: OverallScore | null;
  isPremium: boolean;
  isLoggedIn: boolean;
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
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

  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="4"
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
        <span className="text-2xl font-bold">{score}</span>
        <span className={`text-xl font-bold ${getGradeColor(grade)}`}>{grade}</span>
      </div>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'Empresa Excelente':
        return {
          variant: 'default' as const,
          className: 'bg-green-600 hover:bg-green-700 text-white',
          icon: CheckCircle
        };
      case 'Empresa Boa':
        return {
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white',
          icon: TrendingUp
        };
      case 'Empresa Regular':
        return {
          variant: 'secondary' as const,
          className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
          icon: Shield
        };
      case 'Empresa Fraca':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600 text-white',
          icon: AlertTriangle
        };
      case 'Empresa Péssimo':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-600 hover:bg-red-700 text-white',
          icon: XCircle
        };
      default:
        return {
          variant: 'secondary' as const,
          className: '',
          icon: Shield
        };
    }
  };

  const { variant, className, icon: Icon } = getRecommendationStyle(recommendation);

  return (
    <Badge variant={variant} className={`px-3 py-1 text-sm font-semibold ${className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {recommendation}
    </Badge>
  );
}

function PremiumPrompt({ reason }: { reason: string }) {
  return (
    <div className="relative">
      {/* Blurred content mock */}
      <div className="filter blur-sm pointer-events-none select-none">
        <div className="flex flex-col items-center space-y-4 p-6">
          <ScoreGauge score={85} grade="B+" />
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">Muito Bom</p>
            <RecommendationBadge recommendation="Empresa Excelente" />
          </div>
          <div className="grid grid-cols-2 gap-4 w-full text-sm">
            <div>
              <p className="font-semibold text-green-600 mb-2">Pontos Fortes:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Fundamentos sólidos</li>
                <li>• Boa liquidez</li>
                <li>• Alto ROE</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-red-600 mb-2">Pontos Fracos:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Alto endividamento</li>
                <li>• Margem baixa</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay with premium prompt */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 rounded-lg border shadow-lg max-w-sm">
          <Crown className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Score Premium</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {reason}
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700">
              <Link href="/checkout">
                <Crown className="w-4 h-4 mr-2" />
                Assinar Premium
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">
                Ver planos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverallScoreCard({ ticker, overallScore, isPremium, isLoggedIn }: OverallScoreCardProps) {
  // Render for premium users
  if (isPremium && overallScore) {
    return (
      <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2 text-xl">
            <Award className="w-6 h-6 text-purple-600" />
            <span>Score Geral - {ticker}</span>
            <Crown className="w-5 h-5 text-yellow-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score principal */}
          <div className="text-center space-y-4">
            <ScoreGauge score={overallScore.score} grade={overallScore.grade} />
            <div>
              <p className="text-lg font-semibold text-muted-foreground mb-2">
                {overallScore.classification}
              </p>
              <RecommendationBadge recommendation={overallScore.recommendation} />
            </div>
          </div>

          {/* Pontos fortes e fracos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pontos fortes */}
            <div>
              <h4 className="font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Pontos Fortes
              </h4>
              {overallScore.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {overallScore.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <Zap className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum ponto forte identificado
                </p>
              )}
            </div>

            {/* Pontos fracos */}
            <div>
              <h4 className="font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center">
                <XCircle className="w-4 h-4 mr-2" />
                Pontos Fracos
              </h4>
              {overallScore.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {overallScore.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum ponto fraco identificado
                </p>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/50 rounded-lg">
            <p>
              ⚠️ Score baseado em análise automatizada. Sempre faça sua própria pesquisa antes de investir.
              Este não é um conselho de investimento.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render for non-premium users (with blur)
  return (
    <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center space-x-2 text-xl">
          <Award className="w-6 h-6 text-purple-600" />
          <span>Score Geral - {ticker}</span>
          <Crown className="w-5 h-5 text-yellow-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PremiumPrompt
          reason={
            isLoggedIn
              ? "O Score Geral está disponível apenas para assinantes Premium"
              : "Faça login e assine o Premium para ver o Score Geral completo"
          }
        />
      </CardContent>
    </Card>
  );
}
