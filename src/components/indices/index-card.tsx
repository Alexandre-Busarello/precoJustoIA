/**
 * Card de Índice
 * Exibe informações resumidas de um índice no dashboard
 */

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { IndexSparkline } from './index-sparkline';

interface IndexCardProps {
  ticker: string;
  name: string;
  color: string;
  currentPoints: number;
  accumulatedReturn: number;
  currentYield: number | null;
  assetCount: number;
  sparklineData?: Array<{ date: string; points: number }>;
}

export function IndexCard({
  ticker,
  name,
  color,
  currentPoints,
  accumulatedReturn,
  currentYield,
  assetCount,
  sparklineData = []
}: IndexCardProps) {
  const isPositive = accumulatedReturn >= 0;
  const returnColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const ReturnIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Link href={`/indices/${ticker}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold mb-1">{name}</CardTitle>
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: color, color }}
              >
                {ticker}
              </Badge>
            </div>
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: color }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sparkline */}
          <div className="h-[40px] -mx-2">
            <IndexSparkline data={sparklineData} color={color} />
          </div>

          {/* Métricas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Pontos</span>
              <span className="text-lg font-semibold">{currentPoints.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Retorno</span>
              <div className={`flex items-center gap-1 ${returnColor}`}>
                <ReturnIcon className="h-4 w-4" />
                <span className="font-semibold">
                  {isPositive ? '+' : ''}{accumulatedReturn.toFixed(2)}%
                </span>
              </div>
            </div>

            {currentYield !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">DY Médio</span>
                <span className="text-sm font-medium">{currentYield.toFixed(2)}%</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-gray-600 dark:text-gray-400">Ativos</span>
              <span className="text-sm font-medium">{assetCount}</span>
            </div>
          </div>

          {/* Link */}
          <div className="flex items-center justify-end pt-2 text-sm text-blue-600 dark:text-blue-400">
            Ver detalhes
            <ArrowRight className="h-4 w-4 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

