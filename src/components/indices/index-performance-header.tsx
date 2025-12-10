/**
 * Cabeçalho de Performance do Índice
 * Exibe retorno total estimado (valorização + DY médio)
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface IndexPerformanceHeaderProps {
  currentPoints: number;
  accumulatedReturn: number;
  currentYield: number | null;
  totalDividendsReceived?: number;
  color: string;
}

export function IndexPerformanceHeader({
  currentPoints,
  accumulatedReturn,
  currentYield,
  totalDividendsReceived = 0,
  color
}: IndexPerformanceHeaderProps) {
  // Calcular retorno total (valorização já inclui dividendos ajustados no preço)
  // Os dividendos já estão incorporados nos pontos através do ajuste de preço teórico
  const isPositive = accumulatedReturn >= 0;
  const ReturnIcon = isPositive ? TrendingUp : TrendingDown;
  const returnColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  
  // Calcular impacto dos dividendos como porcentagem do retorno total
  // Dividendo em pontos / pontos iniciais (100) = impacto percentual dos dividendos
  const dividendsImpactPercent = totalDividendsReceived > 0 
    ? (totalDividendsReceived / 100) * 100 // Dividendo acumulado em pontos desde o início
    : 0;

  return (
    <Card className="border-2" style={{ borderColor: color }}>
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Retorno Total
            </p>
            <div className={`flex items-center justify-center gap-2 ${returnColor}`}>
              <ReturnIcon className="h-8 w-8" />
              <span className="text-4xl font-bold">
                {isPositive ? '+' : ''}{accumulatedReturn.toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Retorno já inclui ajuste por dividendos recebidos
              {totalDividendsReceived > 0 && (
                <> • {dividendsImpactPercent.toFixed(2)} pts de dividendos desde o início</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pontos Atuais</p>
              <p className="text-2xl font-semibold">{currentPoints.toFixed(2)}</p>
              {totalDividendsReceived > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Dividendos já incluídos no cálculo
                </p>
              )}
            </div>
            {totalDividendsReceived > 0 ? (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Contribuição dos Dividendos
                </p>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  +{dividendsImpactPercent.toFixed(2)} pts
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  (acumulado desde o início, já nos pontos)
                </p>
              </div>
            ) : currentYield !== null ? (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">DY Médio</p>
                <p className="text-2xl font-semibold">{currentYield.toFixed(2)}%</p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

