/**
 * Componente para visualizar distribuição de usuários por tipo (Premium, Gratuito, Anônimo)
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserTypeData {
  premium: number;
  free: number;
  anonymous: number;
}

interface UserTypeChartProps {
  title: string;
  data: UserTypeData;
  showPercentages?: boolean;
}

export function UserTypeChart({ title, data, showPercentages = true }: UserTypeChartProps) {
  const total = data.premium + data.free + data.anonymous;
  
  const premiumPercent = total > 0 ? ((data.premium / total) * 100).toFixed(1) : '0';
  const freePercent = total > 0 ? ((data.free / total) * 100).toFixed(1) : '0';
  const anonymousPercent = total > 0 ? ((data.anonymous / total) * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Premium */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-sm font-medium">Premium</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{data.premium.toLocaleString()}</span>
                {showPercentages && (
                  <span className="text-xs text-muted-foreground">({premiumPercent}%)</span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${premiumPercent}%` }}
              />
            </div>
          </div>

          {/* Gratuito */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm font-medium">Gratuito</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{data.free.toLocaleString()}</span>
                {showPercentages && (
                  <span className="text-xs text-muted-foreground">({freePercent}%)</span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${freePercent}%` }}
              />
            </div>
          </div>

          {/* Anônimo */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                <span className="text-sm font-medium">Anônimo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{data.anonymous.toLocaleString()}</span>
                {showPercentages && (
                  <span className="text-xs text-muted-foreground">({anonymousPercent}%)</span>
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-gray-400 h-2 rounded-full transition-all"
                style={{ width: `${anonymousPercent}%` }}
              />
            </div>
          </div>

          {/* Total */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold">{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

