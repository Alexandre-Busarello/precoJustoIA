"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Calendar } from "lucide-react";

interface PortfolioPendingTransactionsCTAProps {
  portfolioId: string;
  trackingStarted: boolean;
  onGoToTransactions: () => void;
  refreshKey?: number; // Para forçar atualização quando necessário
}

export function PortfolioPendingTransactionsCTA({
  portfolioId,
  trackingStarted,
  onGoToTransactions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  refreshKey: _refreshKey, // Mantido para compatibilidade com key do componente pai, mas não usado internamente
}: PortfolioPendingTransactionsCTAProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState<{
    lastSuggestionsGeneratedAt: string | null;
    needsRegeneration: boolean;
    isRecent: boolean;
    cashBalance: number;
    hasCashAvailable: boolean;
    hasPendingBuySuggestions: boolean;
  } | null>(null);

  // Fetch function for suggestion status
  const fetchSuggestionStatus = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions/suggestions/status`
    );
    if (!response.ok) {
      throw new Error("Erro ao verificar status de sugestões");
    }
    return response.json();
  };

  // Use React Query for suggestion status
  const {
    data: suggestionStatusData,
    refetch: refetchSuggestionStatus,
  } = useQuery({
    queryKey: ["suggestion-status", portfolioId],
    queryFn: fetchSuggestionStatus,
    enabled: !!portfolioId && trackingStarted,
    // Configurações globais do query-provider.tsx já aplicam:
    // staleTime: 5 minutos, gcTime: 10 minutos, refetchOnMount: false, refetchOnWindowFocus: false
  });

  // Update local state when query data changes
  useEffect(() => {
    if (suggestionStatusData) {
      setSuggestionStatus(suggestionStatusData);
    }
  }, [suggestionStatusData]);

  // Fetch function for pending transactions
  const fetchPendingTransactions = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions?status=PENDING`
    );
    if (!response.ok) {
      throw new Error("Erro ao carregar transações pendentes");
    }
    const data = await response.json();
    const allPendingTx = data.transactions || [];
    const contributionTx = allPendingTx.filter(
      (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
    );
    return contributionTx.length;
  };

  // Use React Query for pending count
  const {
    data: pendingCountData,
    isLoading: pendingLoading,
    refetch: refetchPendingCount,
  } = useQuery({
    queryKey: ["pending-transactions", portfolioId],
    queryFn: fetchPendingTransactions,
    enabled: !!portfolioId,
    // Configurações globais do query-provider.tsx já aplicam:
    // staleTime: 5 minutos, gcTime: 10 minutos, refetchOnMount: false, refetchOnWindowFocus: false
  });

  // Update local state when query data changes
  useEffect(() => {
    if (pendingCountData !== undefined) {
      setPendingCount(pendingCountData);
    }
  }, [pendingCountData]);

  useEffect(() => {
    setLoading(pendingLoading);
  }, [pendingLoading]);


  const queryClient = useQueryClient();

  // Removido useEffect que forçava refetch - agora usa cache do React Query
  // O React Query já gerencia o cache automaticamente, não precisamos forçar refetch
  useEffect(() => {
    if (!trackingStarted) {
      setLoading(false);
    }
  }, [trackingStarted]);

  // Try to generate suggestions if needed
  useEffect(() => {
    if (!trackingStarted || loading || generatingSuggestions) return;
    if (pendingCount === null) return; // Wait for initial load
    if (!suggestionStatus) return; // Wait for status to load
    
    // CRITICAL: Don't generate suggestions if there are already pending buy suggestions
    // This prevents infinite loops when hasPendingBuySuggestions is true but pendingCount is 0
    // (can happen if there's a mismatch between what the status endpoint checks and what we count)
    if (suggestionStatus.hasPendingBuySuggestions) {
      console.log('⏸️ [CTA] Skipping suggestion generation: hasPendingBuySuggestions is true', {
        pendingCount,
        cashBalance: suggestionStatus.cashBalance,
        hasCashAvailable: suggestionStatus.hasCashAvailable,
        needsRegeneration: suggestionStatus.needsRegeneration
      });
      return;
    }
    
    // CRITICAL: Don't generate if suggestions were generated recently (isRecent = true)
    // This prevents loops when a transaction was rejected/accepted and we tried to generate
    // but there were no suggestions to create. The getContributionSuggestions() updates
    // lastSuggestionsGeneratedAt even when returning empty, so isRecent will be true.
    if (suggestionStatus.isRecent && pendingCount === 0) {
      console.log('⏸️ [CTA] Skipping suggestion generation: isRecent is true and no pending transactions', {
        pendingCount,
        cashBalance: suggestionStatus.cashBalance,
        hasCashAvailable: suggestionStatus.hasCashAvailable,
        needsRegeneration: suggestionStatus.needsRegeneration,
        lastSuggestionsGeneratedAt: suggestionStatus.lastSuggestionsGeneratedAt
      });
      return;
    }
    
    // Check if we need to generate suggestions
    // Generate if: needsRegeneration OR has cash available (always suggest buys when there's cash)
    const shouldGenerate = suggestionStatus.needsRegeneration || suggestionStatus.hasCashAvailable;
    
    if (pendingCount === 0 && shouldGenerate) {
      const reason = suggestionStatus.hasCashAvailable 
        ? 'has cash available' 
        : 'needs regeneration';
      console.log(`🔄 [CTA] No pending transactions and ${reason}, generating suggestions...`);
      setGeneratingSuggestions(true);
      
      fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/contributions`, {
        method: 'POST'
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to generate suggestions');
        })
        .then(data => {
          console.log('✅ [CTA] Suggestions generated:', data);
          
          // If no suggestions were created (count === 0 or debug.suggestionsGenerated === 0),
          // wait a bit longer before reloading to ensure lastSuggestionsGeneratedAt is updated
          const noSuggestionsCreated = data.count === 0 || 
            (data.debug && data.debug.suggestionsGenerated === 0);
          const delay = noSuggestionsCreated ? 1000 : 500;
          
          // Reload status and pending count after generating suggestions
          setTimeout(() => {
            refetchSuggestionStatus();
            refetchPendingCount();
            // Also invalidate queries to ensure fresh data
            queryClient.invalidateQueries({ queryKey: ["suggestion-status", portfolioId] });
            queryClient.invalidateQueries({ queryKey: ["pending-transactions", portfolioId] });
          }, delay);
        })
        .catch(error => {
          console.error('❌ [CTA] Error generating suggestions:', error);
        })
        .finally(() => {
          setGeneratingSuggestions(false);
        });
    }
  }, [trackingStarted, pendingCount, suggestionStatus, portfolioId, refetchPendingCount, refetchSuggestionStatus, queryClient, loading, generatingSuggestions]);

  if (loading || generatingSuggestions) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">
              {generatingSuggestions ? 'Gerando sugestões...' : 'Carregando...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trackingStarted) {
    return (
      <Card className="border-2 border-dashed border-blue-200 dark:border-blue-900">
        <CardContent className="py-8">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-blue-600 opacity-50" />
            <h3 className="text-base font-semibold mb-2">Acompanhamento não iniciado</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Inicie o acompanhamento para receber sugestões mensais automáticas de transações.
            </p>
            <Button 
              onClick={onGoToTransactions}
              size="sm"
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
            >
              Ver Transações
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show "Tudo em dia" only if:
  // 1. Suggestions were generated recently (< 30 days) AND
  // 2. No pending transactions AND
  // 3. No cash available (if there's cash, we should suggest buys)
  const shouldShowAllUpToDate = pendingCount === 0 && 
    suggestionStatus?.isRecent && 
    !suggestionStatus?.hasCashAvailable;

  if (shouldShowAllUpToDate) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <p className="text-sm font-medium">Tudo em dia!</p>
            </div>
            <p className="text-xs">Não há transações pendentes no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
      <CardContent className="py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm sm:text-base">
                  Transações Pendentes
                </h3>
                <Badge variant="outline" className="bg-white dark:bg-gray-900 border-orange-300 dark:border-orange-700">
                  {pendingCount}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Você tem {pendingCount} {pendingCount === 1 ? 'transação pendente' : 'transações pendentes'} aguardando sua ação
              </p>
            </div>
          </div>
          <Button
            onClick={onGoToTransactions}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0 w-full sm:w-auto"
          >
            Ver Transações
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

