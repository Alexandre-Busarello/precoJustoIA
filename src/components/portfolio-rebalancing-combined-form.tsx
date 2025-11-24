'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowDownCircle, ArrowUpCircle, Scale, Loader2 } from 'lucide-react';

interface CombinedRebalancingSuggestion {
  date: string;
  type: string;
  sellTransaction?: {
    ticker?: string;
    amount: number;
    price?: number;
    quantity?: number;
    reason?: string;
  } | null;
  sellTransactions?: Array<{
    ticker?: string;
    amount: number;
    price?: number;
    quantity?: number;
    reason?: string;
  }>;
  buyTransactions?: Array<{
    ticker?: string;
    amount: number;
    price?: number;
    quantity?: number;
    reason?: string;
  }>;
  totalSold?: number;
  totalBought?: number;
  netCashChange?: number;
  reason: string;
  cashBalanceBefore: number;
  cashBalanceAfter: number;
}

interface EditableTransaction {
  ticker: string;
  type: 'SELL_REBALANCE' | 'BUY_REBALANCE';
  quantity: number;
  price: number;
  amount: number;
  reason?: string;
  selected: boolean;
}

interface PortfolioRebalancingCombinedFormProps {
  portfolioId: string;
  suggestion: CombinedRebalancingSuggestion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Formatting function (local to avoid importing Node.js modules)
const formatCurrencyLocal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function PortfolioRebalancingCombinedForm({
  portfolioId,
  suggestion,
  open,
  onOpenChange,
  onSuccess,
}: PortfolioRebalancingCombinedFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);

  // Initialize editable transactions from suggestion
  const [sellTransactions, setSellTransactions] = useState<EditableTransaction[]>([]);
  const [buyTransactions, setBuyTransactions] = useState<EditableTransaction[]>([]);

  useEffect(() => {
    if (open && suggestion) {
      // Initialize sell transactions
      const sells: EditableTransaction[] = [];
      if (suggestion.sellTransactions && suggestion.sellTransactions.length > 0) {
        for (const sell of suggestion.sellTransactions) {
          if (sell.ticker) {
            sells.push({
              ticker: sell.ticker,
              type: 'SELL_REBALANCE',
              quantity: sell.quantity || 0,
              price: sell.price || 0,
              amount: sell.amount || 0,
              reason: sell.reason,
              selected: true, // Selected by default
            });
          }
        }
      } else if (suggestion.sellTransaction && suggestion.sellTransaction.ticker) {
        sells.push({
          ticker: suggestion.sellTransaction.ticker,
          type: 'SELL_REBALANCE',
          quantity: suggestion.sellTransaction.quantity || 0,
          price: suggestion.sellTransaction.price || 0,
          amount: suggestion.sellTransaction.amount || 0,
          reason: suggestion.sellTransaction.reason,
          selected: true,
        });
      }

      // Initialize buy transactions
      const buys: EditableTransaction[] = [];
      if (suggestion.buyTransactions && suggestion.buyTransactions.length > 0) {
        for (const buy of suggestion.buyTransactions) {
          if (buy.ticker) {
            buys.push({
              ticker: buy.ticker,
              type: 'BUY_REBALANCE',
              quantity: buy.quantity || 0,
              price: buy.price || 0,
              amount: buy.amount || 0,
              reason: buy.reason,
              selected: true, // Selected by default
            });
          }
        }
      }

      setSellTransactions(sells);
      setBuyTransactions(buys);
    }
  }, [open, suggestion]);

  // Update amount when quantity or price changes
  const updateTransaction = (
    index: number,
    field: 'quantity' | 'price',
    value: number,
    isSell: boolean
  ) => {
    if (isSell) {
      const updated = [...sellTransactions];
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'quantity' 
          ? value * updated[index].price 
          : updated[index].quantity * value,
      };
      setSellTransactions(updated);
    } else {
      const updated = [...buyTransactions];
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: field === 'quantity' 
          ? value * updated[index].price 
          : updated[index].quantity * value,
      };
      setBuyTransactions(updated);
    }
  };

  // Toggle transaction selection
  const toggleTransaction = (index: number, isSell: boolean) => {
    if (isSell) {
      const updated = [...sellTransactions];
      updated[index].selected = !updated[index].selected;
      setSellTransactions(updated);
    } else {
      const updated = [...buyTransactions];
      updated[index].selected = !updated[index].selected;
      setBuyTransactions(updated);
    }
  };

  // Calculate totals for selected transactions
  const selectedSells = sellTransactions.filter(tx => tx.selected);
  const selectedBuys = buyTransactions.filter(tx => tx.selected);
  const totalSold = selectedSells.reduce((sum, tx) => sum + tx.amount, 0);
  const totalBought = selectedBuys.reduce((sum, tx) => sum + tx.amount, 0);
  const finalCashBalance = suggestion.cashBalanceBefore + totalSold - totalBought;
  const hasNegativeCash = finalCashBalance < 0;

  // Execute combined rebalancing using batch endpoint
  const executeRebalancingMutation = useMutation({
    mutationFn: async () => {
      setIsExecuting(true);
      
      const transactions = [];

      // Add selected sell transactions
      for (const sell of selectedSells) {
        transactions.push({
          date: suggestion.date,
          type: 'SELL_REBALANCE' as const,
          ticker: sell.ticker,
          amount: sell.amount,
          price: sell.price,
          quantity: sell.quantity,
          notes: sell.reason || 'Rebalanceamento: venda',
        });
      }

      // Add selected buy transactions
      for (const buy of selectedBuys) {
        transactions.push({
          date: suggestion.date,
          type: 'BUY_REBALANCE' as const,
          ticker: buy.ticker,
          amount: buy.amount,
          price: buy.price,
          quantity: buy.quantity,
          notes: buy.reason || 'Rebalanceamento: compra',
        });
      }

      if (transactions.length === 0) {
        throw new Error('Selecione pelo menos uma transação para executar');
      }

      // Execute batch via new endpoint
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/rebalancing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar rebalanceamento');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Rebalanceamento executado',
        description: data.message || 'Todas as transações de rebalanceamento foram executadas com sucesso',
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-suggestions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-suggestions-dynamic', portfolioId] });

      // Dispatch event for cache invalidation
      window.dispatchEvent(
        new CustomEvent('portfolio-config-updated', {
          detail: { action: 'rebalancing' },
        })
      );

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao executar rebalanceamento:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível executar o rebalanceamento',
        variant: 'destructive',
      });
      setIsExecuting(false);
    },
  });

  const handleExecute = () => {
    if (selectedSells.length === 0 && selectedBuys.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos uma transação para executar',
        variant: 'destructive',
      });
      return;
    }

    if (hasNegativeCash) {
      toast({
        title: 'Erro',
        description: 'Não é possível executar operações que resultem em caixa negativo',
        variant: 'destructive',
      });
      return;
    }

    executeRebalancingMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-orange-600" />
            Confirmar Rebalanceamento Combinado
          </DialogTitle>
          <DialogDescription>
            <p className="mt-2">
              Revise e ajuste quantidade e preço médio de cada operação. Selecione quais operações deseja executar.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {selectedSells.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Vendas Selecionadas</p>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrencyLocal(totalSold)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedSells.length} operação(ões)
                      </p>
                    </div>
                  )}
                  {selectedBuys.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Compras Selecionadas</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrencyLocal(totalBought)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBuys.length} operação(ões)
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Caixa Antes</p>
                    <p className="text-lg font-semibold">
                      {formatCurrencyLocal(suggestion.cashBalanceBefore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Caixa Depois</p>
                    <p className={`text-lg font-semibold ${hasNegativeCash ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {formatCurrencyLocal(finalCashBalance)}
                      {hasNegativeCash && (
                        <span className="ml-2 text-xs">⚠️</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sell Transactions */}
            {sellTransactions.length > 0 && (
              <Card className="border-red-200 dark:border-red-900">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowDownCircle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold">
                      Vendas ({selectedSells.length} de {sellTransactions.length} selecionadas)
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {sellTransactions.map((sell, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          sell.selected
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                            : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1">
                            <Checkbox
                              checked={sell.selected}
                              onCheckedChange={() => toggleTransaction(index, true)}
                            />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-sm">
                                {sell.ticker}
                              </Badge>
                              {sell.reason && (
                                <p className="text-xs text-muted-foreground">{sell.reason}</p>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor={`sell-qty-${index}`} className="text-xs">
                                  Quantidade
                                </Label>
                                <Input
                                  id={`sell-qty-${index}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={sell.quantity}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    updateTransaction(index, 'quantity', value, true);
                                  }}
                                  disabled={!sell.selected}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`sell-price-${index}`} className="text-xs">
                                  Preço Médio
                                </Label>
                                <Input
                                  id={`sell-price-${index}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={sell.price.toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateTransaction(index, 'price', value, true);
                                  }}
                                  disabled={!sell.selected}
                                  className="h-9"
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-sm font-medium">Valor Total</span>
                              <span className={`text-lg font-semibold ${sell.selected ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {formatCurrencyLocal(sell.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Buy Transactions */}
            {buyTransactions.length > 0 && (
              <Card className="border-green-200 dark:border-green-900">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowUpCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">
                      Compras ({selectedBuys.length} de {buyTransactions.length} selecionadas)
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {buyTransactions.map((buy, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          buy.selected
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                            : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1">
                            <Checkbox
                              checked={buy.selected}
                              onCheckedChange={() => toggleTransaction(index, false)}
                            />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-sm">
                                {buy.ticker}
                              </Badge>
                              {buy.reason && (
                                <p className="text-xs text-muted-foreground">{buy.reason}</p>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor={`buy-qty-${index}`} className="text-xs">
                                  Quantidade
                                </Label>
                                <Input
                                  id={`buy-qty-${index}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={buy.quantity}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    updateTransaction(index, 'quantity', value, false);
                                  }}
                                  disabled={!buy.selected}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`buy-price-${index}`} className="text-xs">
                                  Preço Médio
                                </Label>
                                <Input
                                  id={`buy-price-${index}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={buy.price.toFixed(2)}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateTransaction(index, 'price', value, false);
                                  }}
                                  disabled={!buy.selected}
                                  className="h-9"
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-sm font-medium">Valor Total</span>
                              <span className={`text-lg font-semibold ${buy.selected ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {formatCurrencyLocal(buy.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning if no transactions selected */}
            {selectedSells.length === 0 && selectedBuys.length === 0 && (
              <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
                <CardContent className="py-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Selecione pelo menos uma transação para executar o rebalanceamento.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Warning if cash would be negative */}
            {hasNegativeCash && (selectedSells.length > 0 || selectedBuys.length > 0) && (
              <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
                <CardContent className="py-4">
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                    ❌ Atenção: Esta operação resultaria em caixa negativo ({formatCurrencyLocal(finalCashBalance)}).
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                    Ajuste as quantidades ou preços das compras, ou selecione menos operações de compra para evitar saldo negativo.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExecuting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting || (selectedSells.length === 0 && selectedBuys.length === 0) || hasNegativeCash}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 mr-2" />
                Executar Rebalanceamento ({selectedSells.length + selectedBuys.length} transações)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
