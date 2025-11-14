'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { portfolioCache } from '@/lib/portfolio-cache';
import {
  CheckCircle2,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Scale,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

// Helper to parse date strings as local dates without timezone conversion
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

interface SuggestedTransaction {
  id: string;
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  notes?: string;
}

interface PortfolioRebalancingSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioRebalancingSuggestions({
  portfolioId,
  trackingStarted,
  onTransactionsConfirmed
}: PortfolioRebalancingSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for checking pending contributions
  const fetchPendingContributions = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions?status=PENDING`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao verificar transações pendentes');
    }

    const data = await response.json();
    const contributionTx = (data.transactions || []).filter(
      (tx: any) => 
        tx.type !== 'SELL_REBALANCE' && 
        tx.type !== 'BUY_REBALANCE' &&
        (tx.type === 'MONTHLY_CONTRIBUTION' || 
         tx.type === 'CASH_CREDIT' || 
         tx.type === 'BUY' || 
         tx.type === 'DIVIDEND')
    );
    
    return {
      hasPending: contributionTx.length > 0,
      count: contributionTx.length
    };
  };

  const {
    data: pendingContributionsData,
  } = useQuery({
    queryKey: ['portfolio-pending-contributions', portfolioId],
    queryFn: fetchPendingContributions,
    enabled: trackingStarted,
  });

  const hasPendingContributions = pendingContributionsData?.hasPending || false;
  const pendingContributionsCount = pendingContributionsData?.count || 0;

  // Query for checking rebalancing needed
  const fetchRebalancingCheck = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing/check`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao verificar necessidade de rebalanceamento');
    }

    const data = await response.json();
    return {
      shouldShow: data.shouldShow || false,
      maxDeviation: data.maxDeviation || 0,
      details: data.details || ''
    };
  };

  const {
    data: rebalancingCheckData,
  } = useQuery({
    queryKey: ['portfolio-rebalancing-check', portfolioId],
    queryFn: fetchRebalancingCheck,
    enabled: trackingStarted,
  });

  const shouldShow = rebalancingCheckData?.shouldShow || false;
  const maxDeviation = rebalancingCheckData?.maxDeviation || 0;
  const deviationDetails = rebalancingCheckData?.details || '';

  // Query for loading pending rebalancing suggestions
  const fetchPendingRebalancing = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions?status=PENDING`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao carregar sugestões de rebalanceamento');
    }

    const data = await response.json();
    const rebalancingTx = (data.transactions || []).filter(
      (tx: any) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
    );
    return rebalancingTx;
  };

  const {
    data: suggestions = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ['portfolio-rebalancing-suggestions', portfolioId],
    queryFn: fetchPendingRebalancing,
    enabled: trackingStarted,
  });

  // Re-check when transactions change
  useEffect(() => {
    if (!trackingStarted) return;

    const handleTransactionUpdate = () => {
      // Small delay to ensure backend has processed the transaction
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      }, 500);
    };

    // Listen for transaction updates
    window.addEventListener('transaction-updated', handleTransactionUpdate);
    window.addEventListener('reload-suggestions', handleTransactionUpdate);
    window.addEventListener('transaction-cash-flow-changed', handleTransactionUpdate);

    return () => {
      window.removeEventListener('transaction-updated', handleTransactionUpdate);
      window.removeEventListener('reload-suggestions', handleTransactionUpdate);
      window.removeEventListener('transaction-cash-flow-changed', handleTransactionUpdate);
    };
  }, [portfolioId, trackingStarted, queryClient]);

  // Re-check pending contributions when callback is triggered
  useEffect(() => {
    if (onTransactionsConfirmed && trackingStarted) {
      // Small delay to ensure backend has processed the transaction
      const timeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [onTransactionsConfirmed, trackingStarted, portfolioId, queryClient]);

  // Mutation for generating rebalancing suggestions
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      // Delete existing rebalancing suggestions
      // First get all pending rebalancing transactions
      const pendingResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const rebalancingTx = (pendingData.transactions || []).filter(
          (tx: any) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
        );
        
        // Delete each rebalancing transaction
        await Promise.all(
          rebalancingTx.map((tx: any) =>
            fetch(`/api/portfolio/${portfolioId}/transactions/${tx.id}`, {
              method: 'DELETE'
            }).catch(() => {})
          )
        );
      }

      // Generate new rebalancing suggestions
      const generateResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing`,
        { method: 'POST' }
      );

      if (!generateResponse.ok) {
        throw new Error('Erro ao gerar sugestões de rebalanceamento');
      }

      return generateResponse.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sugestões geradas',
        description: 'Sugestões de rebalanceamento geradas com sucesso'
      });

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
    },
    onError: (error: Error) => {
      console.error('Erro ao gerar sugestões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar sugestões de rebalanceamento',
        variant: 'destructive'
      });
    }
  });

  const handleGenerateSuggestions = () => {
    generateSuggestionsMutation.mutate();
  };

  const generating = generateSuggestionsMutation.isPending;

  // Mutation for confirming single transaction
  const confirmSingleMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}/confirm`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Erro ao confirmar transação');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Transação confirmada'
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar transação',
        variant: 'destructive'
      });
    }
  });

  const handleConfirmSingle = (transactionId: string) => {
    confirmSingleMutation.mutate(transactionId);
  };

  // Mutation for rejecting single transaction
  const rejectSingleMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Rejeitado pelo usuário' })
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao rejeitar transação');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Transação rejeitada'
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar transação',
        variant: 'destructive'
      });
    }
  });

  const handleRejectSingle = (transactionId: string) => {
    rejectSingleMutation.mutate(transactionId);
  };

  // Mutation for confirming all transactions
  const confirmAllMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/confirm-batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds })
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao confirmar transações');
      }

      return response.json();
    },
    onSuccess: (_, transactionIds) => {
      toast({
        title: 'Sucesso',
        description: `${transactionIds.length} transações confirmadas`
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar transações em lote',
        variant: 'destructive'
      });
    }
  });

  const handleConfirmAll = () => {
    if (!confirm(`Confirmar todas as ${suggestions.length} transações de rebalanceamento?`)) {
      return;
    }

    const transactionIds = suggestions.map((s: SuggestedTransaction) => s.id);
    confirmAllMutation.mutate(transactionIds);
  };

  const confirmingAll = confirmAllMutation.isPending;

  // Mutation for rejecting all transactions
  const rejectAllMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/reject-batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds })
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao rejeitar transações');
      }

      return response.json();
    },
    onSuccess: (_, transactionIds) => {
      toast({
        title: 'Sucesso',
        description: `${transactionIds.length} transações rejeitadas`
      });

      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar transações em lote',
        variant: 'destructive'
      });
    }
  });

  const handleRejectAll = () => {
    if (!confirm(`Rejeitar todas as ${suggestions.length} transações de rebalanceamento?`)) {
      return;
    }

    const transactionIds = suggestions.map((s: SuggestedTransaction) => s.id);
    rejectAllMutation.mutate(transactionIds);
  };

  const rejectingAll = rejectAllMutation.isPending;

  const getTypeIcon = (type: string) => {
    if (type === 'SELL_REBALANCE') {
      return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
    }
    if (type === 'BUY_REBALANCE') {
      return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
    }
    return <Scale className="h-4 w-4 text-blue-600" />;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'SELL_REBALANCE': 'Venda (Rebal.)',
      'BUY_REBALANCE': 'Compra (Rebal.)'
    };
    return labels[type] || type;
  };

  if (!trackingStarted) {
    return null;
  }

  // Don't show if no rebalancing needed and no pending suggestions
  if (!shouldShow && suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-900 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Scale className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <CardTitle className="text-lg">Rebalanceamento</CardTitle>
              {shouldShow && maxDeviation > 0 && (
                <Badge variant="destructive" className="ml-2 flex-shrink-0">
                  Desvio: {(maxDeviation * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
          {suggestions.length === 0 && shouldShow && (
            <Button
              onClick={handleGenerateSuggestions}
              disabled={generating || hasPendingContributions}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto flex-shrink-0"
              title={hasPendingContributions ? `Complete primeiro as ${pendingContributionsCount} transação(ões) pendente(s) em "Aportes e Compras"` : ''}
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4 mr-2" />
                  Gerar Sugestões
                </>
              )}
            </Button>
          )}
          </div>
          {shouldShow && deviationDetails && (
            <p className="text-sm text-muted-foreground mt-2 break-words overflow-wrap-anywhere">{deviationDetails}</p>
          )}
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md p-3 mt-2 overflow-hidden">
          {hasPendingContributions ? (
            <p className="text-xs text-orange-800 dark:text-orange-200 break-words overflow-wrap-anywhere">
              <strong>⚠️ Atenção:</strong> Você tem <strong>{pendingContributionsCount} transação(ões) pendente(s)</strong> na seção &quot;Aportes e Compras&quot;. 
              Complete todas as transações de aportes e compras antes de gerar sugestões de rebalanceamento.
            </p>
          ) : (
            <p className="text-xs text-orange-800 dark:text-orange-200 break-words overflow-wrap-anywhere">
              <strong>⚠️ Importante:</strong> O rebalanceamento deve ser feito apenas após confirmar os aportes do mês atual. 
              Isso garante que o rebalanceamento considere o dinheiro novo aportado.
            </p>
          )}
        </div>
        </div>
      </CardHeader>

      {loading ? (
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      ) : suggestions.length === 0 ? (
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {shouldShow ? (
              <>
                {hasPendingContributions ? (
                  <>
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-orange-600 opacity-50" />
                    <p className="font-medium">Rebalanceamento necessário</p>
                    <p className="text-sm mt-1">
                      Complete primeiro as <strong>{pendingContributionsCount} transação(ões) pendente(s)</strong> em &quot;Aportes e Compras&quot;
                    </p>
                    <p className="text-xs mt-2 text-orange-600">
                      O botão &quot;Gerar Sugestões&quot; estará disponível após confirmar ou rejeitar todas as transações de aportes e compras.
                    </p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-orange-600 opacity-50" />
                    <p className="font-medium">Rebalanceamento necessário</p>
                    <p className="text-sm mt-1">Clique em &quot;Gerar Sugestões&quot; para ver as transações sugeridas</p>
                  </>
                )}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600 opacity-50" />
                <p className="font-medium">Carteira balanceada</p>
                <p className="text-sm mt-1">Não há necessidade de rebalanceamento no momento</p>
              </>
            )}
          </div>
        </CardContent>
      ) : (
        <CardContent className="overflow-x-hidden">
          <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              {suggestions.length > 0 && (
                <>
                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={generating || hasPendingContributions}
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    title={hasPendingContributions ? `Complete primeiro as ${pendingContributionsCount} transação(ões) pendente(s) em "Aportes e Compras"` : 'Recalcular sugestões de rebalanceamento'}
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Recalculando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Recalcular
                      </>
                    )}
                  </Button>
                  {suggestions.length > 1 && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        onClick={handleRejectAll}
                        disabled={rejectingAll}
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {rejectingAll ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2 animate-spin" />
                            Rejeitando...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Rejeitar Todas
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleConfirmAll}
                        disabled={confirmingAll}
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        {confirmingAll ? 'Confirmando...' : 'Confirmar Todas'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Transactions List - Sells first, then buys */}
            <div className="space-y-3 overflow-x-hidden">
              {suggestions
                .sort((a: SuggestedTransaction, b: SuggestedTransaction) => {
                  // Sort: SELL_REBALANCE first, then BUY_REBALANCE
                  if (a.type === 'SELL_REBALANCE' && b.type !== 'SELL_REBALANCE') return -1;
                  if (a.type !== 'SELL_REBALANCE' && b.type === 'SELL_REBALANCE') return 1;
                  return 0;
                })
                .map((tx: SuggestedTransaction) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors gap-3 overflow-hidden"
                >
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
                    <div className="flex-shrink-0 mt-0.5">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm break-words">
                          {getTypeLabel(tx.type)}
                        </span>
                        {tx.ticker && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {tx.ticker}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex-shrink-0">
                          {format(parseLocalDate(tx.date), 'dd/MM/yyyy')}
                        </span>
                        <span className="font-medium flex-shrink-0 break-words">
                          R$ {tx.amount.toFixed(2)}
                        </span>
                        {tx.quantity && (
                          <span className="flex-shrink-0 break-words">
                            {tx.quantity.toFixed(0)} ações
                          </span>
                        )}
                      </div>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground mt-1 break-words overflow-wrap-anywhere">
                          {tx.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 sm:flex-shrink-0 justify-end sm:justify-start">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleConfirmSingle(tx.id)}
                      title="Confirmar"
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRejectSingle(tx.id)}
                      title="Rejeitar"
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                    >
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

