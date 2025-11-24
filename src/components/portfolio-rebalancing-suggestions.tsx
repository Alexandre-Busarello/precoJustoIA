'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Scale,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { PortfolioTransactionFormSuggested } from '@/components/portfolio-transaction-form-suggested';
import { PortfolioRebalancingCombinedForm } from '@/components/portfolio-rebalancing-combined-form';

// Helper to parse date strings as local dates without timezone conversion
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

interface SuggestedTransaction {
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  notes?: string;
  reason?: string;
  // For combined rebalancing
  sellTransaction?: SuggestedTransaction | null;
  sellTransactions?: SuggestedTransaction[];
  buyTransactions?: SuggestedTransaction[];
  totalSold?: number;
  totalBought?: number;
  netCashChange?: number;
}

interface PortfolioRebalancingSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioRebalancingSuggestions({
  portfolioId,
  trackingStarted,
  onTransactionsConfirmed,
}: PortfolioRebalancingSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedTransaction | null>(null);
  const [showForm, setShowForm] = useState(false);

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
      details: data.details || '',
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

  // Query for dynamic rebalancing suggestions (not saved in DB)
  const fetchDynamicSuggestions = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/suggestions?type=rebalancing`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao carregar sugestões de rebalanceamento');
    }

    const data = await response.json();
    return {
      suggestions: data.suggestions || [],
      message: data.message || null,
    };
  };

  const {
    data: suggestionsData,
    isLoading: loading,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['portfolio-rebalancing-suggestions-dynamic', portfolioId],
    queryFn: fetchDynamicSuggestions,
    enabled: trackingStarted, // Always fetch to get message even if no suggestions
  });

  const suggestions = suggestionsData?.suggestions || [];
  const message = suggestionsData?.message || null;

  const handleSuggestionClick = (suggestion: SuggestedTransaction) => {
    setSelectedSuggestion(suggestion);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedSuggestion(null);
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions-dynamic', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    
    if (onTransactionsConfirmed) {
      onTransactionsConfirmed();
    }
    
    toast({
      title: 'Transação confirmada',
      description: 'A transação foi registrada com sucesso',
    });
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
      'BUY_REBALANCE': 'Compra (Rebal.)',
    };
    return labels[type] || type;
  };

  if (!trackingStarted) {
    return null;
  }

  // Don't show if no rebalancing needed and no suggestions
  if (!shouldShow && suggestions.length === 0) {
    return null;
  }

  return (
    <>
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
                  onClick={() => refetchSuggestions()}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto flex-shrink-0"
                >
                  {loading ? (
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
              <p className="text-sm text-muted-foreground mt-2 break-words overflow-wrap-anywhere">
                {deviationDetails}
              </p>
            )}
            {message ? (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-3 mt-2 overflow-hidden">
                <p className="text-xs text-blue-800 dark:text-blue-200 break-words overflow-wrap-anywhere">
                  <strong>ℹ️ Informação:</strong> {message}
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md p-3 mt-2 overflow-hidden">
                <p className="text-xs text-orange-800 dark:text-orange-200 break-words overflow-wrap-anywhere">
                  <strong>💡 Importante:</strong> As sugestões são calculadas dinamicamente. 
                  Clique em uma sugestão para abrir o formulário pré-preenchido e confirmar a transação.
                </p>
              </div>
            )}
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
              {message ? (
                <>
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-blue-600 opacity-50" />
                  <p className="font-medium">Aguardando transações de aporte/compras</p>
                  <p className="text-sm mt-1">{message}</p>
                </>
              ) : shouldShow ? (
                <>
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-orange-600 opacity-50" />
                  <p className="font-medium">Rebalanceamento necessário</p>
                  <p className="text-sm mt-1">Clique em &quot;Gerar Sugestões&quot; para ver as transações sugeridas</p>
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
                  <Button
                    onClick={() => refetchSuggestions()}
                    disabled={loading}
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loading ? (
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
                )}
              </div>

              {/* Transactions List - Combined rebalancing */}
              <div className="space-y-3 overflow-x-hidden">
                {suggestions.map((tx: SuggestedTransaction, index: number) => {
                  // Check if this is a combined rebalancing suggestion
                  const isCombined = tx.type === 'REBALANCING_COMBINED' || 
                                    (tx.sellTransaction !== undefined && tx.buyTransactions !== undefined);
                  
                  if (isCombined) {
                    // Render combined rebalancing as single card
                    return (
                      <div
                        key={`combined-${index}`}
                        className="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors cursor-pointer"
                        onClick={() => handleSuggestionClick(tx)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Scale className="h-5 w-5 text-orange-600" />
                              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700">
                                Rebalanceamento Combinado
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">
                              {tx.reason || 'Venda e compra combinadas para rebalanceamento'}
                            </p>
                            
                            {/* Sell Transactions */}
                            {tx.sellTransactions && tx.sellTransactions.length > 0 ? (
                              <div className="mb-2 space-y-2">
                                {tx.sellTransactions.map((sell, sellIndex) => (
                                  <div key={sellIndex} className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                                    <div className="flex items-center gap-2 mb-1">
                                      <ArrowUpCircle className="h-4 w-4 text-red-600" />
                                      <Badge variant="destructive" className="text-xs">
                                        Vender {sell.ticker}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {sell.quantity?.toFixed(0)} ações × R$ {sell.price?.toFixed(2)} = R$ {sell.amount.toFixed(2)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : tx.sellTransaction && (
                              <div className="mb-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                                <div className="flex items-center gap-2 mb-1">
                                  <ArrowUpCircle className="h-4 w-4 text-red-600" />
                                  <Badge variant="destructive" className="text-xs">
                                    Vender {tx.sellTransaction.ticker}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {tx.sellTransaction.quantity?.toFixed(0)} ações × R$ {tx.sellTransaction.price?.toFixed(2)} = R$ {tx.sellTransaction.amount.toFixed(2)}
                                </p>
                              </div>
                            )}
                            
                            {/* Buy Transactions */}
                            {tx.buyTransactions && tx.buyTransactions.length > 0 && (
                              <div className="space-y-1">
                                {tx.buyTransactions.map((buy, buyIndex) => (
                                  <div key={`buy-${buyIndex}`} className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                                    <div className="flex items-center gap-2 mb-1">
                                      <ArrowDownCircle className="h-4 w-4 text-green-600" />
                                      <Badge variant="default" className="text-xs bg-green-600">
                                        Comprar {buy.ticker}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {buy.quantity?.toFixed(0)} ações × R$ {buy.price?.toFixed(2)} = R$ {buy.amount.toFixed(2)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSuggestionClick(tx);
                              }}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Executar Rebalanceamento
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Legacy single transaction (fallback)
                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors gap-3 overflow-hidden cursor-pointer"
                        onClick={() => handleSuggestionClick(tx)}
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
                            {tx.reason && (
                              <p className="text-xs text-muted-foreground mt-1 break-words overflow-wrap-anywhere">
                                {tx.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1 sm:flex-shrink-0 justify-end sm:justify-start">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSuggestionClick(tx);
                            }}
                            className="flex-shrink-0"
                          >
                            Simular {tx.type === 'SELL_REBALANCE' ? 'Venda' : 'Compra'}
                          </Button>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Form Dialogs */}
      {selectedSuggestion && (
        <>
          {/* Combined Rebalancing Form */}
          {(selectedSuggestion.type === 'REBALANCING_COMBINED' || 
            (selectedSuggestion.sellTransaction !== undefined && selectedSuggestion.buyTransactions !== undefined)) ? (
            <PortfolioRebalancingCombinedForm
              portfolioId={portfolioId}
              suggestion={selectedSuggestion as any}
              open={showForm}
              onOpenChange={setShowForm}
              onSuccess={handleFormSuccess}
            />
          ) : (
            /* Regular Transaction Form */
            <PortfolioTransactionFormSuggested
              portfolioId={portfolioId}
              suggestion={selectedSuggestion}
              open={showForm}
              onOpenChange={setShowForm}
              onSuccess={handleFormSuccess}
            />
          )}
        </>
      )}
    </>
  );
}
