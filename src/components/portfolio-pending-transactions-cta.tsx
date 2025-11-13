"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Calendar } from "lucide-react";
import { portfolioCache } from "@/lib/portfolio-cache";

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
  refreshKey = 0,
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
  } | null>(null);

  const loadSuggestionStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/status`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestionStatus(data);
        return data;
      }
    } catch (error) {
      console.error("Erro ao verificar status de sugestões:", error);
    }
    return null;
  }, [portfolioId]);

  const loadPendingCount = useCallback(async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = portfolioCache.suggestions.get(portfolioId) as any;
      if (cached && Array.isArray(cached)) {
        const filteredCached = cached.filter(
          (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
        );
        setPendingCount(filteredCached.length);
        setLoading(false);
        return;
      }

      // Fetch pending transactions count
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
      const count = contributionTx.length;
      
      setPendingCount(count);
      
      // Cache the result (only contribution transactions)
      if (contributionTx.length > 0) {
        portfolioCache.suggestions.set(portfolioId, contributionTx);
      }
    } catch (error) {
      console.error("Erro ao carregar contagem de transações pendentes:", error);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (trackingStarted) {
      loadSuggestionStatus();
      loadPendingCount();
    } else {
      setLoading(false);
    }
  }, [trackingStarted, refreshKey, loadPendingCount, loadSuggestionStatus]);

  // Try to generate suggestions if needed
  useEffect(() => {
    if (!trackingStarted || loading || generatingSuggestions) return;
    if (pendingCount === null) return; // Wait for initial load
    
    // Check if we need to generate suggestions
    // Generate if: needsRegeneration OR has cash available (always suggest buys when there's cash)
    const shouldGenerate = suggestionStatus?.needsRegeneration || suggestionStatus?.hasCashAvailable;
    
    if (pendingCount === 0 && shouldGenerate) {
      const reason = suggestionStatus?.hasCashAvailable 
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
          // Reload status and pending count after generating suggestions
          setTimeout(() => {
            loadSuggestionStatus();
            loadPendingCount();
          }, 500);
        })
        .catch(error => {
          console.error('❌ [CTA] Error generating suggestions:', error);
        })
        .finally(() => {
          setGeneratingSuggestions(false);
        });
    }
  }, [trackingStarted, pendingCount, suggestionStatus, portfolioId, loadPendingCount, loadSuggestionStatus, loading, generatingSuggestions]);

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

