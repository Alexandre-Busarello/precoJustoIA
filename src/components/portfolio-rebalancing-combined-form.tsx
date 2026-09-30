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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PortfolioMoneyInput, PortfolioQuantityInput, roundTo } from '@/components/portfolio-money-input';

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

interface RebalanceRowProps {
  tx: EditableTransaction;
  index: number;
  isSell: boolean;
  onToggle: () => void;
  onChange: (field: 'quantity' | 'price', value: number) => void;
}

/** Uma operação editável do ajuste (quantidade, preço e seleção). */
function RebalanceRow({ tx, index, isSell, onToggle, onChange }: RebalanceRowProps) {
  const prefix = isSell ? 'sell' : 'buy';
  return (
    <li className={cn('space-y-3 p-4', !tx.selected && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${prefix}-select-${index}`}
          checked={tx.selected}
          onCheckedChange={onToggle}
          className="mt-0.5"
          aria-label={`${isSell ? 'Incluir venda de' : 'Incluir compra de'} ${tx.ticker}`}
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${prefix}-select-${index}`} className="text-sm text-foreground">
            {isSell ? 'vender' : 'comprar'} <span className="font-medium">{tx.ticker}</span>
          </label>
          {tx.reason && <p className="text-xs text-muted-foreground break-words">{tx.reason}</p>}
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{formatBRL(tx.amount)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 pl-7">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-qty-${index}`} className="text-xs">
            Quantidade
          </Label>
          <PortfolioQuantityInput
            id={`${prefix}-qty-${index}`}
            value={tx.quantity}
            onValueChange={(value) => onChange('quantity', value ?? 0)}
            disabled={!tx.selected}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-price-${index}`} className="text-xs">
            Preço
          </Label>
          <PortfolioMoneyInput
            id={`${prefix}-price-${index}`}
            value={tx.price}
            onValueChange={(value) => onChange('price', value ?? 0)}
            disabled={!tx.selected}
          />
        </div>
      </div>
    </li>
  );
}

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
        amount: roundTo(field === 'quantity' ? value * updated[index].price : updated[index].quantity * value),
      };
      setSellTransactions(updated);
    } else {
      const updated = [...buyTransactions];
      updated[index] = {
        ...updated[index],
        [field]: value,
        amount: roundTo(field === 'quantity' ? value * updated[index].price : updated[index].quantity * value),
      };
      setBuyTransactions(updated);
    }
  };

  // Toggle transaction selection
  const toggleTransaction = (index: number, isSell: boolean) => {
    const toggle = (list: EditableTransaction[]) =>
      list.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx));
    if (isSell) setSellTransactions(toggle);
    else setBuyTransactions(toggle);
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
        title: 'Ajuste registrado',
        description: data.message || 'As operações do ajuste foram registradas na carteira.',
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
        description: error.message || 'Não foi possível registrar o ajuste',
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
        description: 'O ajuste deixaria o caixa negativo. Reduza as compras selecionadas.',
        variant: 'destructive',
      });
      return;
    }

    executeRebalancingMutation.mutate();
  };

  const operationCount = selectedSells.length + selectedBuys.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Ajuste para sua alocação-alvo</DialogTitle>
          <DialogDescription>
            Revise quantidade e preço de cada operação e escolha quais registrar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Vendas selecionadas</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatBRL(totalSold)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Compras selecionadas</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatBRL(totalBought)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Caixa antes</dt>
              <dd className="font-medium tabular-nums text-foreground">{formatBRL(suggestion.cashBalanceBefore)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Caixa depois</dt>
              <dd className={cn('font-medium tabular-nums', hasNegativeCash ? 'text-negative' : 'text-foreground')}>
                {formatBRL(finalCashBalance)}
              </dd>
            </div>
          </dl>

          {sellTransactions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Vendas ({selectedSells.length} de {sellTransactions.length})
              </h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {sellTransactions.map((sell, index) => (
                  <RebalanceRow
                    key={`sell-${sell.ticker}-${index}`}
                    tx={sell}
                    index={index}
                    isSell
                    onToggle={() => toggleTransaction(index, true)}
                    onChange={(field, value) => updateTransaction(index, field, value, true)}
                  />
                ))}
              </ul>
            </section>
          )}

          {buyTransactions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                Compras ({selectedBuys.length} de {buyTransactions.length})
              </h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {buyTransactions.map((buy, index) => (
                  <RebalanceRow
                    key={`buy-${buy.ticker}-${index}`}
                    tx={buy}
                    index={index}
                    isSell={false}
                    onToggle={() => toggleTransaction(index, false)}
                    onChange={(field, value) => updateTransaction(index, field, value, false)}
                  />
                ))}
              </ul>
            </section>
          )}

          {operationCount === 0 && (
            <p className="text-sm text-muted-foreground">Selecione pelo menos uma operação para registrar.</p>
          )}

          {hasNegativeCash && operationCount > 0 && (
            <p role="alert" className="text-sm text-negative">
              O caixa ficaria negativo ({formatBRL(finalCashBalance)}). Reduza as compras ou selecione menos operações.
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
            Cancelar
          </Button>
          <Button onClick={handleExecute} disabled={isExecuting || operationCount === 0 || hasNegativeCash}>
            {isExecuting ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Registrando
              </>
            ) : (
              `Registrar ${operationCount} ${operationCount === 1 ? 'operação' : 'operações'}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
