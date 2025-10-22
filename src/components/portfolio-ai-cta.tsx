'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Sparkles, 
  ArrowRight, 
  Zap,
  Crown
} from 'lucide-react';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useRouter } from 'next/navigation';

interface Asset {
  ticker: string;
  targetAllocation: number;
}

interface PortfolioAICTAProps {
  portfolioId: string;
  currentAssets?: Asset[];
  onScrollToAI?: () => void;
}

export function PortfolioAICTA({ currentAssets = [], onScrollToAI }: PortfolioAICTAProps) {
  const { isPremium } = usePremiumStatus();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (!isPremium) {
      router.push('/planos');
      return;
    }

    if (onScrollToAI) {
      onScrollToAI();
    } else {
      // Fallback: navegar para a aba de configuração
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'config');
      url.hash = '#ai-assistant';
      window.location.href = url.toString();
    }
  };

  const examples = currentAssets.length > 0 ? [
    `"Troque ${currentAssets[0]?.ticker || 'PETR4'} por empresas mais defensivas"`,
    '"Adicione mais empresas de tecnologia"',
    '"Reduza exposição a bancos e aumente em saneamento"'
  ] : [
    '"Otimize para melhor dividend yield"',
    '"Substitua por empresas com melhor ROE"',
    '"Rebalanceie para reduzir risco"'
  ];

  return (
    <Card 
      className={`relative overflow-hidden border-2 transition-all duration-300 cursor-pointer ${
        isPremium 
          ? 'border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg' 
          : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg'
      } ${isHovered ? 'scale-[1.02]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4">
          <Sparkles className="h-8 w-8" />
        </div>
        <div className="absolute bottom-4 left-4">
          <Bot className="h-6 w-6" />
        </div>
      </div>

      <CardContent className="relative p-3 sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${
              isPremium 
                ? 'bg-blue-100 dark:bg-blue-900/50' 
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}>
              {isPremium ? (
                <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-1">
                <h3 className={`font-bold text-base sm:text-lg leading-tight ${
                  isPremium 
                    ? 'text-blue-900 dark:text-blue-100' 
                    : 'text-amber-900 dark:text-amber-100'
                }`}>
                  Otimize sua Carteira com IA
                </h3>
                <Sparkles className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                  isPremium 
                    ? 'text-blue-500' 
                    : 'text-amber-500'
                } ${isHovered ? 'animate-pulse' : ''}`} />
              </div>
              
              <p className={`text-xs sm:text-sm leading-relaxed ${
                isPremium 
                  ? 'text-blue-700 dark:text-blue-300' 
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                Use linguagem natural para modificar, otimizar ou rebalancear seus ativos
              </p>
              
            </div>
          </div>

          {/* Examples */}
          <div className="flex flex-wrap gap-1">
            {examples.slice(0, 2).map((example, index) => (
              <Badge 
                key={index}
                variant="outline" 
                className={`text-xs leading-tight ${
                  isPremium 
                    ? 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300' 
                    : 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                }`}
              >
                {example}
              </Badge>
            ))}
          </div>

          {/* CTA Button */}
          <Button 
            className={`group transition-all duration-300 w-full ${
              isPremium 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            } ${isHovered ? 'shadow-lg' : ''}`}
            size="lg"
          >
            <div className="flex items-center justify-center gap-2 w-full">
              {isPremium ? (
                <Zap className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Crown className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="font-semibold truncate">
                {isPremium 
                  ? 'Otimizar com IA'
                  : 'Upgrade Premium'
                }
              </span>
              <ArrowRight className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${
                isHovered ? 'translate-x-1' : ''
              }`} />
            </div>
          </Button>
          
          {!isPremium && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center -mt-2">
              Recurso exclusivo Premium
            </p>
          )}

          {/* Current Portfolio Preview (Mobile) */}
          {currentAssets.length > 0 && (
            <div className="sm:hidden border-t pt-3 -mb-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Carteira atual ({currentAssets.length} ativos):
              </p>
              <div className="flex flex-wrap gap-1">
                {currentAssets.slice(0, 3).map((asset, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {asset.ticker} ({(asset.targetAllocation * 100).toFixed(1)}%)
                  </Badge>
                ))}
                {currentAssets.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{currentAssets.length - 3} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}