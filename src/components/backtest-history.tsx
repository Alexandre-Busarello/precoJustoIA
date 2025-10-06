'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  History, 
  Calendar, 
  BarChart3,
  Trash2,
  Eye,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight
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
  const router = useRouter();
  const { toast } = useToast();
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConfigs, setTotalConfigs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningBacktest, setRunningBacktest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const itemsPerPage = 10;

  // Carregar histórico com paginação
  useEffect(() => {
    loadHistory();
    // Scroll para o topo ao trocar de página
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/backtest/configs?page=${page}&limit=${itemsPerPage}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico');
      }

      const data = await response.json();
      console.log('📊 Histórico carregado:', data.configs?.length || 0, 'configurações');
      
      setHistory(data.configs || []);
      setTotalPages(data.totalPages || 1);
      setTotalConfigs(data.total || 0);

    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Deletar configuração
  const deleteConfig = async (id: string) => {
    try {
      const response = await fetch(`/api/backtest/configs/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar configuração');
      }

      // Atualizar lista
      setHistory(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Configuração deletada",
        description: "A configuração foi removida com sucesso."
      });

      // Se a página atual ficou vazia e não é a primeira, voltar uma página
      if (history.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadHistory();
      }

    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast({
        title: "Erro ao deletar",
        description: err instanceof Error ? err.message : 'Erro ao deletar configuração',
        variant: "destructive"
      });
    }
  };

  // Executar novamente
  const rerunBacktest = async (config: BacktestHistoryItem) => {
    try {
      setRunningBacktest(config.id);
      
      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar backtesting');
      }

      await response.json();

      toast({
        title: "Backtest concluído!",
        description: "Redirecionando para os resultados..."
      });

      // Redirecionar para a página de resultados
      setTimeout(() => {
        router.push(`/backtest?view=results&configId=${config.id}`);
      }, 500);

    } catch (err) {
      console.error('Erro ao executar:', err);
      toast({
        title: "Erro ao executar backtest",
        description: err instanceof Error ? err.message : 'Erro ao executar backtesting',
        variant: "destructive"
      });
      setRunningBacktest(null);
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
    <>
      {/* Loading Overlay Fullscreen */}
      {runningBacktest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md shadow-2xl">
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <BarChart3 className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Executando backtest...
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 px-2">
                  Processando dados históricos e calculando métricas
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6" />
            Minhas Configurações
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalConfigs} configuração(ões) salva(s)
          </p>
        </div>
        <Button onClick={loadHistory} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Lista de Simulações */}
      <div className="space-y-3 sm:space-y-4">
        {history.map((item) => (
          <Card key={item.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg truncate">{item.name}</CardTitle>
                  {item.description && (
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>
                    <span>{item.assets.length} ativos</span>
                    <span className="hidden sm:inline">{getRebalanceFrequencyLabel(item.rebalanceFrequency)}</span>
                  </div>
                </div>
                
                {/* Status da Simulação */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.results ? (
                    <Badge variant="default" className="bg-green-500 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Concluída
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Pendente
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 sm:space-y-4 pt-3">
              {/* Ativos da Carteira */}
              <div>
                <h4 className="font-semibold mb-2 text-xs sm:text-sm">Ativos</h4>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {item.assets.slice(0, 6).map((asset) => (
                    <Badge key={asset.ticker} variant="outline" className="text-xs">
                      {asset.ticker} ({(asset.targetAllocation * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                  {item.assets.length > 6 && (
                    <Badge variant="secondary" className="text-xs">
                      +{item.assets.length - 6} mais
                    </Badge>
                  )}
                </div>
              </div>

              {/* Resultados (se disponível) */}
              {item.results && item.results.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-xs sm:text-sm">Último Resultado</h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Retorno Total</p>
                      <p className={`font-bold text-sm sm:text-base ${item.results[0].totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(item.results[0].totalReturn)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Retorno Anual</p>
                      <p className={`font-bold text-sm sm:text-base ${item.results[0].annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(item.results[0].annualizedReturn)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Drawdown</p>
                      <p className="font-bold text-sm sm:text-base text-red-600">
                        {formatPercentage(item.results[0].maxDrawdown)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t">
                {/* Botão Principal: Ver Detalhes ou Executar */}
                {item.results && item.results.length > 0 ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => showDetails(item)}
                    className="flex-1 sm:flex-none"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => rerunBacktest(item)}
                    disabled={runningBacktest === item.id}
                    className="flex-1 sm:flex-none"
                  >
                    {runningBacktest === item.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Executar Simulação
                      </>
                    )}
                  </Button>
                )}
                
                {/* Botão Secundário: Executar Novamente (apenas se já tem resultado) */}
                {item.results && item.results.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rerunBacktest(item)}
                    disabled={runningBacktest === item.id}
                    className="flex-1 sm:flex-none"
                  >
                    {runningBacktest === item.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Executando...</span>
                        <span className="sm:hidden">Executando...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Executar Novamente</span>
                        <span className="sm:hidden">Re-executar</span>
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmId(item.id)}
                  className="text-red-500 hover:text-red-700 flex-shrink-0"
                  disabled={runningBacktest === item.id}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sm:hidden ml-2">Deletar</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
            Página {page} de {totalPages} • {totalConfigs} configurações
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex-1 sm:flex-none"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            
            {/* Números de página para desktop */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (page <= 3) {
                  pageNumber = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = page - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNumber}
                    variant={page === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    className="w-9"
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>
            
            {/* Indicador de página para mobile */}
            <div className="sm:hidden px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-medium">
              {page} / {totalPages}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>

    {/* Dialog de Confirmação de Deleção */}
    {deleteConfirmId && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Confirmar Exclusão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tem certeza que deseja deletar esta configuração? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteConfig(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </>
  );
}
