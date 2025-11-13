'use client';

import { useState, useEffect } from 'react';
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
  const [suggestions, setSuggestions] = useState<SuggestedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [maxDeviation, setMaxDeviation] = useState(0);
  const [deviationDetails, setDeviationDetails] = useState('');
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [rejectingAll, setRejectingAll] = useState(false);
  const [hasPendingContributions, setHasPendingContributions] = useState(false);
  const [pendingContributionsCount, setPendingContributionsCount] = useState(0);

  const checkPendingContributions = async () => {
    try {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );
      
      if (response.ok) {
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
        
        setHasPendingContributions(contributionTx.length > 0);
        setPendingContributionsCount(contributionTx.length);
      }
    } catch (error) {
      console.error('Erro ao verificar transações pendentes de contribuição:', error);
    }
  };

  useEffect(() => {
    if (trackingStarted) {
      checkRebalancingNeeded();
      loadPendingRebalancing();
      checkPendingContributions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, trackingStarted]);

  // Re-check pending contributions when callback is triggered
  useEffect(() => {
    if (onTransactionsConfirmed && trackingStarted) {
      // Small delay to ensure backend has processed the transaction
      const timeout = setTimeout(() => {
        checkPendingContributions();
      }, 500);
      
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTransactionsConfirmed, trackingStarted]);

  const checkRebalancingNeeded = async () => {
    try {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing/check`
      );
      
      if (response.ok) {
        const data = await response.json();
        setShouldShow(data.shouldShow);
        setMaxDeviation(data.maxDeviation);
        setDeviationDetails(data.details);
      }
    } catch (error) {
      console.error('Erro ao verificar necessidade de rebalanceamento:', error);
    }
  };

  const loadPendingRebalancing = async () => {
    try {
      setLoading(true);
      
      // Get all pending transactions and filter rebalancing ones
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );
      
      if (response.ok) {
        const data = await response.json();
        const rebalancingTx = (data.transactions || []).filter(
          (tx: any) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
        );
        setSuggestions(rebalancingTx);
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões de rebalanceamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    try {
      setGenerating(true);
      
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

      toast({
        title: 'Sugestões geradas',
        description: 'Sugestões de rebalanceamento geradas com sucesso'
      });

      // Reload suggestions
      await loadPendingRebalancing();
      await checkRebalancingNeeded();
      await checkPendingContributions(); // Check if contributions are still pending

      // Invalidar cache
      portfolioCache.invalidateAll(portfolioId);
    } catch (error) {
      console.error('Erro ao gerar sugestões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar sugestões de rebalanceamento',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmSingle = async (transactionId: string) => {
    try {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}/confirm`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Erro ao confirmar transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação confirmada'
      });

      portfolioCache.invalidateAll(portfolioId);
      await loadPendingRebalancing();
      await checkRebalancingNeeded();
      await checkPendingContributions(); // Check if contributions are still pending
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar transação',
        variant: 'destructive'
      });
    }
  };

  const handleRejectSingle = async (transactionId: string) => {
    try {
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

      toast({
        title: 'Sucesso',
        description: 'Transação rejeitada'
      });

      portfolioCache.invalidateAll(portfolioId);
      await loadPendingRebalancing();
      await checkPendingContributions(); // Check if contributions are still pending
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar transação',
        variant: 'destructive'
      });
    }
  };

  const handleConfirmAll = async () => {
    if (!confirm(`Confirmar todas as ${suggestions.length} transações de rebalanceamento?`)) {
      return;
    }

    try {
      setConfirmingAll(true);
      
      const transactionIds = suggestions.map(s => s.id);
      
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

      toast({
        title: 'Sucesso',
        description: `${suggestions.length} transações confirmadas`
      });

      portfolioCache.invalidateAll(portfolioId);
      await loadPendingRebalancing();
      await checkRebalancingNeeded();
      await checkPendingContributions(); // Check if contributions are still pending
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar transações em lote',
        variant: 'destructive'
      });
    } finally {
      setConfirmingAll(false);
    }
  };

  const handleRejectAll = async () => {
    if (!confirm(`Rejeitar todas as ${suggestions.length} transações de rebalanceamento?`)) {
      return;
    }

    try {
      setRejectingAll(true);
      
      const transactionIds = suggestions.map(s => s.id);
      
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

      toast({
        title: 'Sucesso',
        description: `${suggestions.length} transações rejeitadas`
      });

      portfolioCache.invalidateAll(portfolioId);
      await loadPendingRebalancing();
      await checkRebalancingNeeded();
      await checkPendingContributions();
      
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar transações em lote',
        variant: 'destructive'
      });
    } finally {
      setRejectingAll(false);
    }
  };

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
    <Card className="border-2 border-orange-200 dark:border-orange-900">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg">Rebalanceamento</CardTitle>
              {shouldShow && maxDeviation > 0 && (
                <Badge variant="destructive" className="ml-2">
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
            <p className="text-sm text-muted-foreground mt-2">{deviationDetails}</p>
          )}
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md p-3 mt-2">
          {hasPendingContributions ? (
            <p className="text-xs text-orange-800 dark:text-orange-200">
              <strong>⚠️ Atenção:</strong> Você tem <strong>{pendingContributionsCount} transação(ões) pendente(s)</strong> na seção &quot;Aportes e Compras&quot;. 
              Complete todas as transações de aportes e compras antes de gerar sugestões de rebalanceamento.
            </p>
          ) : (
            <p className="text-xs text-orange-800 dark:text-orange-200">
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
        <CardContent>
          <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex justify-end gap-2">
              {suggestions.length > 0 && (
                <>
                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={generating || hasPendingContributions}
                    size="sm"
                    variant="outline"
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
                    <>
                      <Button
                        onClick={handleRejectAll}
                        disabled={rejectingAll}
                        size="sm"
                        variant="outline"
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
                      >
                        {confirmingAll ? 'Confirmando...' : 'Confirmar Todas'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Transactions List - Sells first, then buys */}
            <div className="space-y-3">
              {suggestions
                .sort((a, b) => {
                  // Sort: SELL_REBALANCE first, then BUY_REBALANCE
                  if (a.type === 'SELL_REBALANCE' && b.type !== 'SELL_REBALANCE') return -1;
                  if (a.type !== 'SELL_REBALANCE' && b.type === 'SELL_REBALANCE') return 1;
                  return 0;
                })
                .map(tx => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors gap-3"
                >
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
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
                        <span className="font-medium flex-shrink-0">
                          R$ {tx.amount.toFixed(2)}
                        </span>
                        {tx.quantity && (
                          <span className="flex-shrink-0">
                            {tx.quantity.toFixed(0)} ações
                          </span>
                        )}
                      </div>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">
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
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRejectSingle(tx.id)}
                      title="Rejeitar"
                      className="h-8 w-8 sm:h-9 sm:w-9 p-0"
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

