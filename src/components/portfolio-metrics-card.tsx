'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Calendar
} from 'lucide-react';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PortfolioMetrics {
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  totalDividends: number;
  totalReturn: number;
  annualizedReturn?: number;
  volatility?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

interface PortfolioMetricsCardProps {
  metrics: PortfolioMetrics;
  loading?: boolean;
  startDate?: Date; // Portfolio start date for calculating availability
}

export function PortfolioMetricsCard({ metrics, loading, startDate }: PortfolioMetricsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const isPositive = (value: number) => value >= 0;

  // Calculate when metrics will be available
  const getMetricAvailability = (requiredMonths: number) => {
    if (!startDate) return null;
    
    const monthsPassed = differenceInMonths(new Date(), startDate);
    const monthsRemaining = Math.max(0, requiredMonths - monthsPassed);
    
    if (monthsRemaining === 0) return { available: true, monthsRemaining: 0, availableDate: null };
    
    const availableDate = addMonths(startDate, requiredMonths);
    
    return {
      available: false,
      monthsRemaining,
      availableDate
    };
  };

  const volatilityAvailability = getMetricAvailability(2);
  const annualizedReturnAvailability = getMetricAvailability(12);
  const maxDrawdownAvailability = getMetricAvailability(2);

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Current Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Valor Atual
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(metrics.currentValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Caixa: {formatCurrency(metrics.cashBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Alocado: {formatCurrency(metrics.currentValue - metrics.cashBalance)}
          </p>
        </CardContent>
      </Card>

      {/* Total Return */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Retorno Total
          </CardTitle>
          {isPositive(metrics.totalReturn) ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            isPositive(metrics.totalReturn) ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatPercent(metrics.totalReturn)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Investido: {formatCurrency(metrics.totalInvested)}
          </p>
        </CardContent>
      </Card>

      {/* Annualized Return */}
      {metrics.annualizedReturn !== null && metrics.annualizedReturn !== undefined ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Retorno Anualizado
            </CardTitle>
            {isPositive(metrics.annualizedReturn) ? (
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              isPositive(metrics.annualizedReturn) ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(metrics.annualizedReturn)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por ano (CAGR)
            </p>
          </CardContent>
        </Card>
      ) : annualizedReturnAvailability && !annualizedReturnAvailability.available ? (
        <Card className="border-dashed border-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
              <span>Retorno Anualizado</span>
              <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                <Clock className="h-3 w-3 mr-1" />
                Em {annualizedReturnAvailability.monthsRemaining} meses
              </Badge>
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-muted-foreground">
              Aguardando dados
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Disponível em {format(annualizedReturnAvailability.availableDate!, 'MMM/yyyy', { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Requer 12 meses de histórico
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Dividends */}
      {metrics.totalDividends > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Dividendos Recebidos
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.totalDividends)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Renda passiva
            </p>
          </CardContent>
        </Card>
      )}

      {/* Volatility */}
      {metrics.volatility !== null && metrics.volatility !== undefined ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Volatilidade
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(metrics.volatility)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Risco anualizado
            </p>
          </CardContent>
        </Card>
      ) : volatilityAvailability && !volatilityAvailability.available ? (
        <Card className="border-dashed border-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
              <span>Volatilidade</span>
              <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                <Clock className="h-3 w-3 mr-1" />
                Em {volatilityAvailability.monthsRemaining} {volatilityAvailability.monthsRemaining === 1 ? 'mês' : 'meses'}
              </Badge>
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-muted-foreground">
              Aguardando dados
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Disponível em {format(volatilityAvailability.availableDate!, 'MMM/yyyy', { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Requer 2 meses de histórico
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Sharpe Ratio */}
      {metrics.sharpeRatio !== null && metrics.sharpeRatio !== undefined ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Índice Sharpe
            </CardTitle>
            <Badge variant={metrics.sharpeRatio > 1 ? 'default' : 'secondary'}>
              {metrics.sharpeRatio > 1 ? 'Bom' : 'Regular'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Retorno ajustado ao risco
            </p>
          </CardContent>
        </Card>
      ) : annualizedReturnAvailability && !annualizedReturnAvailability.available ? (
        <Card className="border-dashed border-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
              <span>Índice Sharpe</span>
              <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                <Clock className="h-3 w-3 mr-1" />
                Em {annualizedReturnAvailability.monthsRemaining} meses
              </Badge>
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-muted-foreground">
              Aguardando dados
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Disponível em {format(annualizedReturnAvailability.availableDate!, 'MMM/yyyy', { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Requer 12 meses de histórico
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Max Drawdown */}
      {metrics.maxDrawdown !== null && metrics.maxDrawdown !== undefined ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Maior Queda
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatPercent(metrics.maxDrawdown)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Máximo drawdown
            </p>
          </CardContent>
        </Card>
      ) : maxDrawdownAvailability && !maxDrawdownAvailability.available ? (
        <Card className="border-dashed border-2">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
              <span>Maior Queda</span>
              <Badge variant="outline" className="text-xs flex-shrink-0 whitespace-nowrap">
                <Clock className="h-3 w-3 mr-1" />
                Em {maxDrawdownAvailability.monthsRemaining} {maxDrawdownAvailability.monthsRemaining === 1 ? 'mês' : 'meses'}
              </Badge>
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-muted-foreground">
              Aguardando dados
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Disponível em {format(maxDrawdownAvailability.availableDate!, 'MMM/yyyy', { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Requer 2 meses de histórico
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Withdrawals */}
      {metrics.totalWithdrawn > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sacado
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalWithdrawn)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saques realizados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

