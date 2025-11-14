/**
 * Componente para visualização de funis de conversão
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingDown, 
  TrendingUp,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { UserEmailFilter } from './user-email-filter';

interface FunnelData {
  funnel: {
    name: string;
    steps: Array<{
      name: string;
      eventType: string;
      count: number;
      percentage: number;
    }>;
    totalUsers: number;
    conversionRate: number;
  };
  period: {
    start: string;
    end: string;
  };
}

const FUNNEL_TYPES = [
  { value: 'registration_to_ranking', label: 'Primeiro Acesso → Primeiro Ranking' },
  { value: 'ranking_to_asset', label: 'Ranking → Visualização de Ativo' },
  { value: 'asset_to_comparison', label: 'Ativo → Comparação' },
  { value: 'comparison_to_backtest', label: 'Comparação → Backtest' },
];

interface FunnelViewerProps {
  userId?: string | null;
}

export function FunnelViewer({ userId }: FunnelViewerProps = {}) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnelType, setFunnelType] = useState('registration_to_ranking');
  const [filterUserId, setFilterUserId] = useState<string | null>(userId || null);

  const fetchFunnel = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const url = `/api/admin/analytics/funnel?type=${funnelType}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${filterUserId ? `&userId=${filterUserId}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Erro ao buscar dados do funil');
      }

      const funnelData = await response.json();
      setData(funnelData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelType, filterUserId]);

  const handleUserFilterChange = (userId: string | null) => {
    setFilterUserId(userId);
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchFunnel}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { funnel } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Funis de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro por Usuário */}
        <UserEmailFilter onUserChange={handleUserFilterChange} />
        
        {/* Seletor de Tipo de Funil */}
        <div className="flex items-center justify-end">
          <Select value={funnelType} onValueChange={setFunnelType}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4">
          {/* Taxa de conversão geral */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-2xl font-bold">{funnel.conversionRate.toFixed(1)}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold">{funnel.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Steps do funil */}
          <div className="space-y-3">
            {funnel.steps.map((step, index) => {
              const isLast = index === funnel.steps.length - 1;
              const previousStep = index > 0 ? funnel.steps[index - 1] : null;
              const dropoff = previousStep 
                ? previousStep.count - step.count 
                : 0;
              const dropoffPercentage = previousStep && previousStep.count > 0
                ? (dropoff / previousStep.count) * 100
                : 0;

              return (
                <div key={index}>
                  <div className="flex items-center gap-4">
                    {/* Barra de progresso */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="font-medium">{step.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {step.count.toLocaleString()} usuários
                          </span>
                          <Badge variant={step.percentage >= 50 ? 'default' : 'secondary'}>
                            {step.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-500"
                          style={{ width: `${step.percentage}%` }}
                        />
                      </div>
                      {!isLast && dropoff > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-red-500" />
                          {dropoff.toLocaleString()} abandonaram ({dropoffPercentage.toFixed(1)}%)
                        </div>
                      )}
                    </div>
                    {!isLast && (
                      <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

