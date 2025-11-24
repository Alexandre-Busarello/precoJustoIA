'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, TrendingUp, DollarSign, Scale, Sparkles, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { PortfolioTransactionFormSuggested } from './portfolio-transaction-form-suggested';
import { PortfolioRebalancingCombinedForm } from './portfolio-rebalancing-combined-form';
import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
// Formatting functions (local to avoid importing Node.js modules)
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};


interface PortfolioSuggestionsPageProps {
  portfolioId: string;
}

interface Suggestion {
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  reason: string;
  cashBalanceBefore: number;
  cashBalanceAfter: number;
  // For combined rebalancing
  sellTransaction?: Suggestion | null;
  sellTransactions?: Suggestion[]; // Support multiple sell transactions
  buyTransactions?: Suggestion[];
  totalSold?: number;
  totalBought?: number;
  netCashChange?: number;
}

interface SuggestionsResponse {
  type: string;
  suggestions: Suggestion[];
  count: number;
}

export function PortfolioSuggestionsPage({ portfolioId }: PortfolioSuggestionsPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const previousCashBalanceRef = useRef<number | undefined>(undefined);

  // Fetch portfolio data to get cash balance
  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}`);
      if (!response.ok) throw new Error('Erro ao carregar carteira');
      const data = await response.json();
      return data.portfolio;
    },
  });

  // Fetch metrics to monitor cash balance changes
  const { data: metricsData } = useQuery({
    queryKey: ['portfolio-metrics', portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
      if (!response.ok) throw new Error('Erro ao carregar métricas');
      const data = await response.json();
      return data.metrics;
    },
  });

  // Fetch contribution suggestions
  const {
    data: contributionData,
    isLoading: loadingContributions,
    refetch: refetchContributions,
  } = useQuery<SuggestionsResponse>({
    queryKey: ['portfolio-suggestions', portfolioId, 'contribution'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=contribution`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  // Fetch rebalancing suggestions
  const {
    data: rebalancingData,
    isLoading: loadingRebalancing,
    refetch: refetchRebalancing,
  } = useQuery<SuggestionsResponse & { message?: string }>({
    queryKey: ['portfolio-suggestions', portfolioId, 'rebalancing'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=rebalancing`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  // Fetch dividend suggestions
  const {
    data: dividendData,
    isLoading: loadingDividends,
    refetch: refetchDividends,
  } = useQuery<SuggestionsResponse>({
    queryKey: ['portfolio-suggestions', portfolioId, 'dividends'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=dividends`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  const handleRefresh = () => {
    refetchContributions();
    refetchRebalancing();
    refetchDividends();
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Check if this is a combined rebalancing suggestion
    const isCombined = suggestion.type === 'REBALANCING_COMBINED' || 
                       (suggestion.sellTransaction !== undefined && suggestion.buyTransactions !== undefined);
    
    if (isCombined) {
      // Use combined form for rebalancing
      setSelectedSuggestion(suggestion);
    } else {
      // Use regular form for other suggestions
      setSelectedSuggestion(suggestion);
    }
  };

  const handleTransactionConfirmed = () => {
    setSelectedSuggestion(null);
    handleRefresh();
    // Invalidate portfolio data to refresh cash balance
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    window.dispatchEvent(
      new CustomEvent('portfolio-config-updated', {
        detail: { action: 'transaction' },
      })
    );
  };

  // Monitor cash balance changes and auto-refresh suggestions
  useEffect(() => {
    const currentCashBalance = metricsData?.cashBalance;
    const previousCashBalance = previousCashBalanceRef.current;

    // If cash balance changed, refresh contribution suggestions
    if (
      previousCashBalance !== undefined &&
      currentCashBalance !== undefined &&
      currentCashBalance !== previousCashBalance
    ) {
      console.log('💰 Cash balance changed, refreshing suggestions...', {
        previous: previousCashBalance,
        current: currentCashBalance,
      });
      
      // Refetch contribution suggestions when cash changes
      refetchContributions();
      
      // Also refetch rebalancing and dividends in case they're affected
      refetchRebalancing();
      refetchDividends();
    }

    // Update ref
    previousCashBalanceRef.current = currentCashBalance;
  }, [metricsData?.cashBalance, refetchContributions, refetchRebalancing, refetchDividends]);

  // Listen for transaction events to auto-refresh
  useEffect(() => {
    const handleTransactionEvent = () => {
      console.log('🔄 Transaction event detected, refreshing suggestions...');
      // Small delay to ensure backend has processed the transaction
      setTimeout(() => {
        refetchContributions();
        refetchRebalancing();
        refetchDividends();
        queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
      }, 500);
    };

    // Listen for various transaction-related events
    window.addEventListener('portfolio-transaction-updated', handleTransactionEvent);
    window.addEventListener('portfolio-config-updated', handleTransactionEvent);
    window.addEventListener('transaction-cash-flow-changed', handleTransactionEvent);

    return () => {
      window.removeEventListener('portfolio-transaction-updated', handleTransactionEvent);
      window.removeEventListener('portfolio-config-updated', handleTransactionEvent);
      window.removeEventListener('transaction-cash-flow-changed', handleTransactionEvent);
    };
  }, [refetchContributions, refetchRebalancing, refetchDividends, queryClient, portfolioId]);

  const contributionSuggestions = contributionData?.suggestions || [];
  const rebalancingSuggestions = rebalancingData?.suggestions || [];
  const dividendSuggestions = dividendData?.suggestions || [];
  const totalSuggestions = contributionSuggestions.length + rebalancingSuggestions.length + dividendSuggestions.length;
  const cashBalance = metricsData?.cashBalance || portfolioData?.metrics?.cashBalance || 0;

  const isLoading = loadingContributions || loadingRebalancing || loadingDividends;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/carteira/${portfolioId}`)}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Sugestões de Transações
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {portfolioData?.name || 'Carteira'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cash Balance Alert */}
        {cashBalance >= 100 && (
          <Card className="mb-6 border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Dinheiro Disponível para Investimento
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Você tem {formatCurrency(cashBalance)} em caixa. Confirme as sugestões abaixo para investir.
                  </p>
                </div>
                <Badge variant="outline" className="bg-white dark:bg-gray-900 border-blue-300 dark:border-blue-700">
                  {formatCurrency(cashBalance)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Sugestões</p>
                  <p className="text-2xl font-bold">{totalSuggestions}</p>
                </div>
                <Sparkles className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aportes/Compras</p>
                  <p className="text-2xl font-bold">{contributionSuggestions.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rebalanceamento</p>
                  <p className="text-2xl font-bold">{rebalancingSuggestions.length}</p>
                </div>
                <Scale className="h-8 w-8 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-16 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando sugestões...</p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && totalSuggestions === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma sugestão no momento</h3>
              <p className="text-muted-foreground mb-4">
                Sua carteira está equilibrada e não há sugestões de transações no momento.
              </p>
              <Button onClick={() => router.push(`/carteira/${portfolioId}`)} variant="outline">
                Ver Detalhes da Carteira
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contribution Suggestions */}
        {!isLoading && contributionSuggestions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Aportes e Compras ({contributionSuggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contributionSuggestions.map((suggestion, index) => (
                  <div
                    key={`contribution-${index}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={suggestion.type === 'MONTHLY_CONTRIBUTION' ? 'default' : 'secondary'}>
                          {suggestion.type === 'MONTHLY_CONTRIBUTION' ? 'Aporte Mensal' : 'Compra'}
                        </Badge>
                        {suggestion.ticker && (
                          <Badge variant="outline">{suggestion.ticker}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                      {suggestion.quantity && suggestion.price && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestion.quantity} ações × {formatCurrency(suggestion.price)}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{formatCurrency(suggestion.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Caixa após: {formatCurrency(suggestion.cashBalanceAfter)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rebalancing Suggestions */}
        {!isLoading && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-orange-600" />
                Rebalanceamento ({rebalancingSuggestions.length})
              </CardTitle>
              {rebalancingData?.message && (
                <div className="mt-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>ℹ️ Informação:</strong> {rebalancingData.message}
                  </p>
                </div>
              )}
            </CardHeader>
            {rebalancingSuggestions.length > 0 && (
            <CardContent>
              <div className="space-y-4">
                {rebalancingSuggestions.map((suggestion, index) => {
                  // Check if this is a combined rebalancing suggestion
                  const isCombined = suggestion.type === 'REBALANCING_COMBINED' || 
                                    (suggestion.sellTransaction !== undefined && suggestion.buyTransactions !== undefined);
                  
                  if (isCombined) {
                    // Combined rebalancing: show sell + buy together
                    return (
                      <div
                        key={`rebalancing-combined-${index}`}
                        className="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/50 dark:hover:bg-orange-950/40 transition-colors cursor-pointer"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700">
                                <Scale className="h-3 w-3 mr-1" />
                                Rebalanceamento Combinado
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">
                              {suggestion.reason || 'Venda e compra combinadas para rebalanceamento'}
                            </p>
                            
                            {/* Sell Transactions */}
                            {suggestion.sellTransactions && suggestion.sellTransactions.length > 0 ? (
                              <div className="mb-3 space-y-2">
                                {suggestion.sellTransactions.map((sell, sellIndex) => (
                                  <div key={sellIndex} className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="destructive" className="text-xs">
                                        <ArrowDownCircle className="h-3 w-3 mr-1" />
                                        Vender
                                      </Badge>
                                      {sell.ticker && (
                                        <Badge variant="outline" className="text-xs">
                                          {sell.ticker}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {sell.quantity} ações × {formatCurrency(sell.price || 0)} = {formatCurrency(sell.amount)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : suggestion.sellTransaction && (
                              <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="destructive" className="text-xs">
                                    <ArrowDownCircle className="h-3 w-3 mr-1" />
                                    Vender
                                  </Badge>
                                  {suggestion.sellTransaction.ticker && (
                                    <Badge variant="outline" className="text-xs">
                                      {suggestion.sellTransaction.ticker}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {suggestion.sellTransaction.quantity} ações × {formatCurrency(suggestion.sellTransaction.price || 0)} = {formatCurrency(suggestion.sellTransaction.amount)}
                                </p>
                              </div>
                            )}
                            
                            {/* Buy Transactions */}
                            {suggestion.buyTransactions && suggestion.buyTransactions.length > 0 && (
                              <div className="space-y-2">
                                {suggestion.buyTransactions.map((buy, buyIndex) => (
                                  <div key={`buy-${buyIndex}`} className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="default" className="text-xs bg-green-600">
                                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                                        Comprar
                                      </Badge>
                                      {buy.ticker && (
                                        <Badge variant="outline" className="text-xs">
                                          {buy.ticker}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {buy.quantity} ações × {formatCurrency(buy.price || 0)} = {formatCurrency(buy.amount)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <div className="space-y-1">
                              {suggestion.totalSold && suggestion.totalSold > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Venda Total</p>
                                  <p className="font-semibold text-red-600">{formatCurrency(suggestion.totalSold)}</p>
                                </div>
                              )}
                              {suggestion.totalBought && suggestion.totalBought > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Compra Total</p>
                                  <p className="font-semibold text-green-600">{formatCurrency(suggestion.totalBought)}</p>
                                </div>
                              )}
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground">Caixa Final</p>
                                <p className="font-semibold">{formatCurrency(suggestion.cashBalanceAfter)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Legacy single transaction (fallback)
                    return (
                      <div
                        key={`rebalancing-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={suggestion.type.includes('BUY') ? 'default' : 'destructive'}>
                              {suggestion.type.includes('BUY') ? 'Comprar' : 'Vender'}
                            </Badge>
                            {suggestion.ticker && (
                              <Badge variant="outline">{suggestion.ticker}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                          {suggestion.quantity && suggestion.price && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.quantity} ações × {formatCurrency(suggestion.price)}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold">{formatCurrency(Math.abs(suggestion.amount))}</p>
                          <p className="text-xs text-muted-foreground">
                            Caixa após: {formatCurrency(suggestion.cashBalanceAfter)}
                          </p>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </CardContent>
            )}
          </Card>
        )}

        {/* Dividend Suggestions */}
        {!isLoading && dividendSuggestions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Dividendos ({dividendSuggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dividendSuggestions.map((suggestion, index) => (
                  <div
                    key={`dividend-${index}`}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="default">Dividendo</Badge>
                        {suggestion.ticker && (
                          <Badge variant="outline">{suggestion.ticker}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{formatCurrency(suggestion.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Caixa após: {formatCurrency(suggestion.cashBalanceAfter)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Form Modals */}
        {selectedSuggestion && (
          <>
            {/* Combined Rebalancing Form */}
            {(selectedSuggestion.type === 'REBALANCING_COMBINED' || 
              (selectedSuggestion.sellTransaction !== undefined && selectedSuggestion.buyTransactions !== undefined)) ? (
              <PortfolioRebalancingCombinedForm
                portfolioId={portfolioId}
                suggestion={selectedSuggestion as any}
                open={!!selectedSuggestion}
                onOpenChange={(open) => {
                  if (!open) setSelectedSuggestion(null);
                }}
                onSuccess={handleTransactionConfirmed}
              />
            ) : (
              /* Regular Transaction Form */
              <PortfolioTransactionFormSuggested
                portfolioId={portfolioId}
                suggestion={selectedSuggestion}
                open={!!selectedSuggestion}
                onOpenChange={(open) => {
                  if (!open) setSelectedSuggestion(null);
                }}
                onSuccess={handleTransactionConfirmed}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

