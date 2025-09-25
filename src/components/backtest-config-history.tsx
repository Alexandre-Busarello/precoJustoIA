'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  Calendar, 
  BarChart3,
  Eye,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw
} from 'lucide-react';

// Interfaces
interface BacktestResultHistory {
  id: string;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  finalCashReserve?: number;
  totalDividendsReceived?: number;
  monthlyReturns: any[];
  assetPerformance: any[];
  portfolioEvolution: any[];
  calculatedAt: string;
}

interface BacktestConfigHistoryProps {
  configId: string;
  configName: string;
  onShowResult?: (result: any, config: any, transactions?: any[]) => void;
}

export function BacktestConfigHistory({ configId, configName, onShowResult }: BacktestConfigHistoryProps) {
  const [results, setResults] = useState<BacktestResultHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar histórico de resultados
  useEffect(() => {
    loadResults();
  }, [configId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/backtest/configs/${configId}/results`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico de resultados');
      }

      const data = await response.json();
      console.log('📊 Resultados carregados:', data.results?.length || 0);
      
      setResults(data.results || []);

    } catch (err) {
      console.error('Erro ao carregar resultados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar detalhes de um resultado específico
  const showResultDetails = async (result: BacktestResultHistory) => {
    if (!onShowResult) return;

    try {
      // Buscar configuração completa e transações para este resultado
      const configResponse = await fetch(`/api/backtest/configs/${configId}`);
      const configData = await configResponse.json();

      if (!configResponse.ok) {
        throw new Error('Erro ao carregar configuração');
      }

      const config = {
        name: configData.config.name,
        description: configData.config.description,
        assets: configData.config.assets.map((asset: any) => ({
          ticker: asset.ticker,
          companyName: asset.ticker,
          allocation: asset.targetAllocation,
          averageDividendYield: asset.averageDividendYield
        })),
        startDate: new Date(configData.config.startDate),
        endDate: new Date(configData.config.endDate),
        initialCapital: configData.config.initialCapital,
        monthlyContribution: configData.config.monthlyContribution,
        rebalanceFrequency: configData.config.rebalanceFrequency
      };

      // IMPORTANTE: Preservar o ID da configuração
      (config as any).id = configId;

      const formattedResult = {
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalInvested: result.totalInvested,
        finalValue: result.finalValue,
        finalCashReserve: result.finalCashReserve || 0,
        totalDividendsReceived: result.totalDividendsReceived || 0,
        monthlyReturns: result.monthlyReturns || [],
        assetPerformance: result.assetPerformance || [],
        portfolioEvolution: result.portfolioEvolution || [],
        dataValidation: null,
        dataQualityIssues: [],
        effectiveStartDate: config.startDate,
        effectiveEndDate: config.endDate,
        actualInvestment: result.totalInvested,
        plannedInvestment: result.totalInvested,
        missedContributions: 0,
        missedAmount: 0
      };

      onShowResult(formattedResult, config, configData.config.transactions || []);
    } catch (error) {
      console.error('Erro ao mostrar detalhes:', error);
      alert('Erro ao carregar detalhes do resultado');
    }
  };

  // Formatação
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-4" />
          <p className="text-gray-500">Carregando histórico de resultados...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-red-800 dark:text-red-200">
            Erro ao Carregar Histórico
          </h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <Button onClick={loadResults} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum Resultado Encontrado</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Esta configuração ainda não possui resultados de backtesting.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Execute uma simulação para ver os resultados aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6" />
            Histórico de Resultados
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {results.length} resultado(s) para "{configName}"
          </p>
        </div>
        <Button onClick={loadResults} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Lista de Resultados */}
      <div className="space-y-4">
        {results.map((result, index) => (
          <Card 
            key={result.id} 
            className={`hover:shadow-lg transition-shadow ${index === 0 ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Resultado #{results.length - index}
                    {index === 0 && (
                      <Badge variant="default" className="bg-blue-500">
                        Mais Recente
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Executado em {formatDate(result.calculatedAt)}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Métricas Principais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Retorno Total</p>
                  <div className="flex items-center justify-center gap-1">
                    {result.totalReturn >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`font-bold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(result.totalReturn)}
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Retorno Anual</p>
                  <p className={`font-bold ${result.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(result.annualizedReturn)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Sharpe Ratio</p>
                  <p className="font-bold text-gray-900 dark:text-gray-100">
                    {result.sharpeRatio ? result.sharpeRatio.toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Drawdown Máx.</p>
                  <p className="font-bold text-red-600">
                    {formatPercentage(result.maxDrawdown)}
                  </p>
                </div>
              </div>

              {/* Valores Finais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Capital Próprio</p>
                  <p className="font-medium">{formatCurrency(result.totalInvested)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Valor Final</p>
                  <p className="font-medium">{formatCurrency(result.finalValue)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Dividendos Recebidos</p>
                  <p className="font-medium">{formatCurrency(result.totalDividendsReceived || 0)}</p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showResultDetails(result)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalhes Completos
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
