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
  DollarSign,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface PortfolioDividendSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioDividendSuggestions({
  portfolioId,
  trackingStarted,
  onTransactionsConfirmed
}: PortfolioDividendSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for loading dividend suggestions
  const fetchDividendSuggestions = async (): Promise<SuggestedTransaction[]> => {
    // First, fetch pending DIVIDEND transactions
    const pendingResponse = await fetch(`/api/portfolio/${portfolioId}/transactions?status=PENDING&type=DIVIDEND`);
    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      const pendingDividends = (pendingData.transactions || []).filter((tx: any) => tx.type === 'DIVIDEND');
      
      if (pendingDividends.length > 0) {
        return pendingDividends;
      }
    }

    // If no pending transactions, try to get suggestions
    const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/dividends`);
    if (!response.ok) {
      throw new Error('Erro ao carregar sugestões de dividendos');
    }

    const data = await response.json();
    const fetchedSuggestions = data.suggestions || [];
    
    // Map suggestions to include id (for pending transactions)
    // If suggestions don't have id, they're not yet created as pending transactions
    return fetchedSuggestions.map((s: any, index: number) => ({
      ...s,
      id: s.id || `suggestion-${index}` // Temporary id for display
    }));
  };

  const {
    data: suggestions = [],
    isLoading: loading,
    error: suggestionsError
  } = useQuery({
    queryKey: ['portfolio-dividend-suggestions', portfolioId],
    queryFn: fetchDividendSuggestions,
    enabled: trackingStarted,
  });

  // Show error toast if query fails
  useEffect(() => {
    if (suggestionsError) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar sugestões de dividendos',
        variant: 'destructive'
      });
    }
  }, [suggestionsError, toast]);

  // Re-check when transactions change
  useEffect(() => {
    if (!trackingStarted) return;

    const handleTransactionUpdate = () => {
      // Small delay to ensure backend has processed the transaction
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions', portfolioId] });
      }, 500);
    };

    // Listen for transaction updates
    window.addEventListener('transaction-updated', handleTransactionUpdate);
    window.addEventListener('transaction-cash-flow-changed', handleTransactionUpdate);

    return () => {
      window.removeEventListener('transaction-updated', handleTransactionUpdate);
      window.removeEventListener('transaction-cash-flow-changed', handleTransactionUpdate);
    };
  }, [portfolioId, trackingStarted, queryClient]);

  // Mutation for generating dividend suggestions
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/dividends`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar sugestões');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.transactionIds && data.transactionIds.length > 0) {
        toast({
          title: 'Sucesso',
          description: `${data.transactionIds.length} sugestão(ões) de dividendo criada(s)`,
        });
        
        // Invalidate queries to reload
        queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions', portfolioId] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
        portfolioCache.dividends.remove(portfolioId);
        portfolioCache.suggestions.remove(portfolioId);
        
        if (onTransactionsConfirmed) {
          onTransactionsConfirmed();
        }
      } else {
        toast({
          title: 'Info',
          description: data.message || 'Nenhuma sugestão de dividendo para criar',
        });
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao gerar sugestões:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar sugestões',
        variant: 'destructive'
      });
    }
  });

  const generateSuggestions = () => {
    generateSuggestionsMutation.mutate();
  };

  const generating = generateSuggestionsMutation.isPending;

  // Mutation for confirming all transactions
  const confirmAllMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/confirm-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds })
      });

      if (!response.ok) {
        throw new Error('Erro ao confirmar transações');
      }

      return response.json();
    },
    onSuccess: (_, transactionIds) => {
      toast({
        title: 'Sucesso',
        description: `${transactionIds.length} transação(ões) confirmada(s)`,
      });

      // Invalidate queries to reload
      queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.suggestions.remove(portfolioId);
      portfolioCache.transactions.remove(portfolioId);

      if (onTransactionsConfirmed) {
        onTransactionsConfirmed();
      }
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar as transações',
        variant: 'destructive'
      });
    }
  });

  const confirmAll = () => {
    if (suggestions.length === 0) return;
    const transactionIds = suggestions.map((s: SuggestedTransaction) => s.id);
    confirmAllMutation.mutate(transactionIds);
  };

  const confirmingAll = confirmAllMutation.isPending;

  // Helper function to check if transactionId is temporary (suggestion not yet created as PENDING)
  const isTemporaryId = (id: string): boolean => {
    return id.startsWith('suggestion-');
  };

  // Helper function to find suggestion by temporary ID
  const findSuggestionById = (id: string): SuggestedTransaction | undefined => {
    return suggestions.find(s => s.id === id);
  };

  // Mutation for confirming single transaction
  const confirmTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      // Check if this is a temporary ID (suggestion not yet created as PENDING)
      if (isTemporaryId(transactionId)) {
        const suggestion = findSuggestionById(transactionId);
        if (!suggestion) {
          throw new Error('Sugestão não encontrada');
        }

        // Use the new endpoint that creates and confirms in one operation
        const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestion: {
              date: suggestion.date,
              type: suggestion.type,
              ticker: suggestion.ticker,
              amount: suggestion.amount,
              price: suggestion.price,
              quantity: suggestion.quantity,
              notes: suggestion.notes,
              reason: suggestion.notes || (suggestion as any).reason,
              cashBalanceBefore: (suggestion as any).cashBalanceBefore ?? 0,
              cashBalanceAfter: (suggestion as any).cashBalanceAfter ?? 0,
            },
            action: 'confirm'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao confirmar sugestão');
        }

        return response.json();
      } else {
        // Regular transaction ID - use existing endpoint
        const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/confirm`, {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error('Erro ao confirmar transação');
        }

        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Transação confirmada',
      });

      // Invalidate queries to reload
      queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.dividends.remove(portfolioId);
      portfolioCache.suggestions.remove(portfolioId);
      portfolioCache.transactions.remove(portfolioId);

      if (onTransactionsConfirmed) {
        onTransactionsConfirmed();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível confirmar a transação',
        variant: 'destructive'
      });
    }
  });

  const confirmTransaction = (transactionId: string) => {
    confirmTransactionMutation.mutate(transactionId);
  };

  // Mutation for rejecting transaction
  const rejectTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      // Check if this is a temporary ID (suggestion not yet created as PENDING)
      if (isTemporaryId(transactionId)) {
        const suggestion = findSuggestionById(transactionId);
        if (!suggestion) {
          throw new Error('Sugestão não encontrada');
        }

        // Use the new endpoint that creates and rejects in one operation
        const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestion: {
              date: suggestion.date,
              type: suggestion.type,
              ticker: suggestion.ticker,
              amount: suggestion.amount,
              price: suggestion.price,
              quantity: suggestion.quantity,
              notes: suggestion.notes,
              reason: suggestion.notes || (suggestion as any).reason,
              cashBalanceBefore: (suggestion as any).cashBalanceBefore ?? 0,
              cashBalanceAfter: (suggestion as any).cashBalanceAfter ?? 0,
            },
            action: 'reject'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao rejeitar sugestão');
        }

        return response.json();
      } else {
        // Regular transaction ID - use existing endpoint
        const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/reject`, {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error('Erro ao rejeitar transação');
        }

        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Transação rejeitada',
      });

      // Invalidate queries to reload
      queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions', portfolioId] });
      portfolioCache.dividends.remove(portfolioId);
      portfolioCache.suggestions.remove(portfolioId);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível rejeitar a transação',
        variant: 'destructive'
      });
    }
  });

  const rejectTransaction = (transactionId: string) => {
    rejectTransactionMutation.mutate(transactionId);
  };

  if (!trackingStarted) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 flex-shrink-0">
            <DollarSign className="h-5 w-5 text-green-600 flex-shrink-0" />
            Dividendos
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={generateSuggestions}
              disabled={generating}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Sugestões
                </>
              )}
            </Button>
            {suggestions.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={confirmAll}
                disabled={confirmingAll}
                className="w-full sm:w-auto"
              >
                {confirmingAll ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Todas
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-hidden">
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma sugestão de dividendo pendente</p>
            <p className="text-sm mt-2">Clique em &quot;Gerar Sugestões&quot; para buscar dividendos disponíveis</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-x-hidden">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-3 overflow-hidden"
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                      {suggestion.ticker}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex-shrink-0">
                      {format(new Date(suggestion.date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm font-medium break-words">
                    R$ {suggestion.amount.toFixed(2)}
                  </p>
                  {/* Show calculation: quantity x dividend per share */}
                  {suggestion.quantity && suggestion.price && (
                    <p className="text-xs text-muted-foreground mt-1 break-words overflow-wrap-anywhere">
                      {suggestion.quantity.toFixed(0)} ações × R$ {suggestion.price.toFixed(4)}/ação = R$ {suggestion.amount.toFixed(2)}
                    </p>
                  )}
                  {suggestion.notes && (
                    <p className="text-xs text-muted-foreground mt-1 break-words overflow-wrap-anywhere">
                      {suggestion.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 sm:flex-shrink-0 justify-end sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmTransaction(suggestion.id)}
                    className="flex-shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectTransaction(suggestion.id)}
                    className="flex-shrink-0"
                  >
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

