'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  Calendar, 
  BarChart3,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle
} from 'lucide-react';

// Interfaces
interface BacktestHistoryItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  assets: Array<{
    ticker: string;
    targetAllocation: number;
    averageDividendYield?: number;
  }>;
  results?: Array<{
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    volatility: number;
    sharpeRatio: number | null;
    positiveMonths: number;
    negativeMonths: number;
    totalInvested: number;
    finalCashReserve: number;
    totalDividendsReceived: number;
    finalValue: number;
    monthlyReturns: any[];
    assetPerformance: any[];
    portfolioEvolution: any[];
    calculatedAt: string;
  }>;
  transactions?: Array<{
    id: string;
    month: number;
    date: string;
    ticker: string;
    transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT';
    contribution: number;
    price: number;
    sharesAdded: number;
    totalShares: number;
    totalInvested: number;
    cashReserved?: number | null;
    totalContribution: number;
    portfolioValue: number;
    cashBalance: number;
  }>;
  startDate: string;
  endDate: string;
  initialCapital?: number;
  monthlyContribution: number;
  rebalanceFrequency: string;
}

interface BacktestHistoryProps {
  onShowDetails?: (result: any, config: any, transactions?: any[]) => void;
}

export function BacktestHistory({ onShowDetails }: BacktestHistoryProps = {}) {
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar histórico
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/backtest/configs');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico');
      }

      const data = await response.json();
      console.log('📊 Histórico carregado:', data.configs?.length || 0, 'configurações');
      
      // Debug: verificar se as transações estão chegando
      if (data.configs && data.configs.length > 0) {
        console.log('🔍 Debug - Primeira config tem transações:', data.configs[0].transactions?.length || 0);
        console.log('📋 Exemplo de transação:', data.configs[0].transactions?.[0] || 'Nenhuma');
      }
      
      setHistory(data.configs || []);

    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Deletar configuração
  const deleteConfig = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta configuração?')) {
      return;
    }

    try {
      const response = await fetch(`/api/backtest/configs/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar configuração');
      }

      // Atualizar lista
      setHistory(prev => prev.filter(item => item.id !== id));

    } catch (err) {
      console.error('Erro ao deletar:', err);
      alert(err instanceof Error ? err.message : 'Erro ao deletar configuração');
    }
  };

  // Executar novamente
  const rerunBacktest = async (config: BacktestHistoryItem) => {
    try {
      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config.id })
      });

      if (!response.ok) {
        throw new Error('Erro ao executar backtesting');
      }

      // Recarregar histórico para atualizar resultados
      await loadHistory();

    } catch (err) {
      console.error('Erro ao executar:', err);
      alert(err instanceof Error ? err.message : 'Erro ao executar backtesting');
    }
  };

  // Mostrar detalhes do backtest
  const showDetails = (item: BacktestHistoryItem) => {
    if (!item.results || item.results.length === 0 || !onShowDetails) return;

    // Pegar o primeiro (e único) resultado
    const result = item.results[0];

    const configData = {
      name: item.name,
      description: item.description,
      assets: item.assets.map(asset => ({
        ticker: asset.ticker,
        companyName: asset.ticker, // Fallback
        allocation: asset.targetAllocation,
        averageDividendYield: (asset as any).averageDividendYield || undefined
      })),
      startDate: new Date(item.startDate),
      endDate: new Date(item.endDate),
      initialCapital: item.initialCapital || 10000,
      monthlyContribution: item.monthlyContribution,
      rebalanceFrequency: item.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly'
    };

    // IMPORTANTE: Preservar o ID da configuração
    (configData as any).id = item.id;

    // Usar os dados completos que agora vêm do banco
    const completeResult = {
      totalReturn: result.totalReturn,
      annualizedReturn: result.annualizedReturn,
      volatility: result.volatility,
      sharpeRatio: result.sharpeRatio,
      maxDrawdown: result.maxDrawdown,
      positiveMonths: result.positiveMonths,
      negativeMonths: result.negativeMonths,
      totalInvested: result.totalInvested,
      finalValue: result.finalValue,
      finalCashReserve: (result as any).finalCashReserve || 0,
      totalDividendsReceived: (result as any).totalDividendsReceived || 0,
      monthlyReturns: result.monthlyReturns || [],
      assetPerformance: result.assetPerformance || [],
      portfolioEvolution: result.portfolioEvolution || [],
      // Campos opcionais com valores padrão
      dataValidation: null,
      dataQualityIssues: [],
      effectiveStartDate: new Date(item.startDate),
      effectiveEndDate: new Date(item.endDate),
      actualInvestment: result.totalInvested,
      plannedInvestment: result.totalInvested,
      missedContributions: 0,
      missedAmount: 0
    };

    onShowDetails(completeResult, configData, item.transactions || []);
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
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getRebalanceFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      case 'yearly': return 'Anual';
      default: return frequency;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-4" />
          <p className="text-gray-500">Carregando histórico...</p>
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
          <Button onClick={loadHistory} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma Simulação Salva</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Você ainda não executou nenhuma simulação de backtesting.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Configure uma carteira e execute uma simulação para ver o histórico aqui.
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
            Histórico de Simulações
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {history.length} simulação(ões) salva(s)
          </p>
        </div>
        <Button onClick={loadHistory} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Lista de Simulações */}
      <div className="space-y-4">
        {history.map((item) => (
          <Card key={item.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  {item.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>
                    <span>{item.assets.length} ativos</span>
                    <span>{getRebalanceFrequencyLabel(item.rebalanceFrequency)}</span>
                  </div>
                </div>
                
                {/* Status da Simulação */}
                <div className="flex items-center gap-2">
                  {item.results ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Concluída
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      Pendente
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Configuração da Carteira */}
              <div>
                <h4 className="font-semibold mb-2 text-sm">Configuração</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Período</p>
                    <p className="font-medium">
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Capital Inicial</p>
                    <p className="font-medium">{formatCurrency(item.initialCapital || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Aporte Mensal</p>
                    <p className="font-medium">{formatCurrency(item.monthlyContribution)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Rebalanceamento</p>
                    <p className="font-medium">{getRebalanceFrequencyLabel(item.rebalanceFrequency)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Ativos</p>
                    <p className="font-medium">{item.assets.length} selecionados</p>
                  </div>
                </div>
              </div>

              {/* Ativos da Carteira */}
              <div>
                <h4 className="font-semibold mb-2 text-sm">Ativos</h4>
                <div className="flex flex-wrap gap-2">
                  {item.assets.map((asset) => (
                    <Badge key={asset.ticker} variant="outline" className="text-xs">
                      {asset.ticker} ({(asset.targetAllocation * 100).toFixed(1)}%)
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Resultados (se disponível) */}
              {item.results && item.results.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Resultados</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Retorno Total</p>
                      <p className={`font-bold ${item.results[0].totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(item.results[0].totalReturn)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Retorno Anual</p>
                      <p className={`font-bold ${item.results[0].annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(item.results[0].annualizedReturn)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Drawdown Máx.</p>
                      <p className="font-bold text-red-600">
                        {formatPercentage(item.results[0].maxDrawdown)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Calculado em {formatDate(item.results[0].calculatedAt)}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rerunBacktest(item)}
                  className="flex-1"
                >
                  {item.results ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Executar Novamente
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Executar Simulação
                    </>
                  )}
                </Button>
                
                
                {item.results && item.results.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showDetails(item)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteConfig(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
