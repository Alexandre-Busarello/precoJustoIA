'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTracking } from '@/hooks/use-tracking';
import { EventType } from '@/lib/tracking-types';
import { formatBRL } from '@/lib/format';
import { PortfolioMoneyInput, PortfolioQuantityInput, roundTo } from '@/components/portfolio-money-input';
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';
import { dispatchPortfolioChangeEvent } from '@/hooks/use-cache-invalidation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PortfolioTransactionFormProps {
  portfolioId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    type?: string;
    date?: string;
    ticker?: string;
    amount?: string;
    price?: string;
    quantity?: string;
    notes?: string;
  };
}

const TRANSACTION_TYPES = [
  { value: 'CASH_CREDIT', label: 'Aporte em dinheiro', requiresAsset: false, help: 'O valor fica em caixa, disponível para compras.' },
  { value: 'CASH_DEBIT', label: 'Saque de dinheiro', requiresAsset: false, help: 'Retira o valor do caixa da carteira.' },
  { value: 'BUY', label: 'Compra de ativo', requiresAsset: true, help: 'Informe preço e quantidade; o total é calculado.' },
  { value: 'SELL_WITHDRAWAL', label: 'Venda de ativo', requiresAsset: true, help: 'O valor da venda volta para o caixa.' },
  { value: 'DIVIDEND', label: 'Dividendo recebido', requiresAsset: true, help: 'O valor é creditado no caixa da carteira.' },
];

/** Converte o valor inicial (string numérica com ponto) em número. */
function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PortfolioTransactionForm({
  portfolioId,
  onSuccess,
  onCancel,
  initialData,
}: PortfolioTransactionFormProps) {
  const { toast } = useToast();
  const { trackEvent } = useTracking();
  const queryClient = useQueryClient();
  const [showCashConfirmDialog, setShowCashConfirmDialog] = useState(false);
  const [insufficientCashData, setInsufficientCashData] = useState<{
    insufficientAmount: number;
    currentCashBalance: number;
    transactionAmount: number;
  } | null>(null);
  const [pendingTransactionData, setPendingTransactionData] = useState<any>(null);

  // Form state - initialize with initialData if provided
  const [type, setType] = useState(initialData?.type || 'CASH_CREDIT');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [ticker, setTicker] = useState(initialData?.ticker || '');
  const [amount, setAmount] = useState<number | undefined>(toNumber(initialData?.amount));
  const [price, setPrice] = useState<number | undefined>(toNumber(initialData?.price));
  const [quantity, setQuantity] = useState<number | undefined>(toNumber(initialData?.quantity));
  const [notes, setNotes] = useState(initialData?.notes || '');

  const selectedType = TRANSACTION_TYPES.find(t => t.value === type);
  const requiresAsset = selectedType?.requiresAsset || false;
  const usesPriceAndQuantity = requiresAsset && type !== 'DIVIDEND';
  // Compra/venda: o total é sempre preço × quantidade.
  const effectiveAmount = usesPriceAndQuantity
    ? price !== undefined && quantity !== undefined
      ? roundTo(price * quantity)
      : undefined
    : amount;

  // Mutation for creating transaction
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Check for insufficient cash error
        if (responseData.code === 'INSUFFICIENT_CASH' && responseData.details) {
          // Store error details to throw later after setting state
          throw { 
            type: 'INSUFFICIENT_CASH',
            details: responseData.details,
            transactionData 
          };
        }
        
        throw new Error(responseData.error || 'Erro ao criar transação');
      }

      return responseData;
    },
    onSuccess: (responseData, variables) => {
      toast({
        title: 'Transação registrada',
        description: responseData.message || 'A transação foi salva na carteira.'
      });

      // Track evento de atualização de carteira (transação adicionada)
      trackEvent(EventType.FEATURE_USED, undefined, {
        feature: 'portfolio_updated',
        portfolioId: portfolioId,
        updateType: 'transaction',
        transactionType: variables.type,
      });

      // Invalidar cache de analytics e dashboard
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      invalidatePortfolioAnalyticsCache(portfolioId);
      invalidateDashboardPortfoliosCache();
      
      // Disparar evento para invalidação inteligente de cache
      dispatchPortfolioChangeEvent('transaction', portfolioId);

      // Dispatch event for cash flow change to trigger suggestion regeneration
      window.dispatchEvent(new CustomEvent('transaction-cash-flow-changed', {
        detail: {
          transactionType: variables.type,
          portfolioId: portfolioId,
          action: 'created'
        }
      }));

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      // Handle insufficient cash error specially
      if (error?.type === 'INSUFFICIENT_CASH') {
        setInsufficientCashData(error.details);
        setPendingTransactionData(error.transactionData);
        setShowCashConfirmDialog(true);
        return;
      }

      console.error('Erro ao criar transação:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar transação',
        variant: 'destructive'
      });
    }
  });

  // Mutation for creating transaction with automatic cash credit
  const createTransactionWithCashCreditMutation = useMutation({
    mutationFn: async ({ transactionData, cashCreditAmount }: { transactionData: any; cashCreditAmount: number }) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transactionData,
          autoAddCashCredit: true,
          cashCreditAmount
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Erro ao criar transação');
      }

      return responseData;
    },
    onSuccess: (responseData, variables) => {
      toast({
        title: 'Aporte e compra registrados',
        description: responseData.message || 'As duas transações foram salvas na carteira.'
      });

      // Invalidar cache de dashboard também
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      invalidateDashboardPortfoliosCache();

      // Dispatch event for cash flow change (both CASH_CREDIT and the transaction type)
      window.dispatchEvent(new CustomEvent('transaction-cash-flow-changed', {
        detail: {
          transactionType: 'CASH_CREDIT',
          portfolioId: portfolioId,
          action: 'created'
        }
      }));
      if (variables.transactionData?.type) {
        window.dispatchEvent(new CustomEvent('transaction-cash-flow-changed', {
          detail: {
            transactionType: variables.transactionData.type,
            portfolioId: portfolioId,
            action: 'created'
          }
        }));
      }

      setShowCashConfirmDialog(false);
      setInsufficientCashData(null);
      setPendingTransactionData(null);

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao criar transação com aporte:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar transação',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (requiresAsset && !ticker) {
      toast({
        title: 'Erro',
        description: 'Ticker do ativo é obrigatório para este tipo de transação',
        variant: 'destructive'
      });
      return;
    }

    if (!effectiveAmount || effectiveAmount <= 0) {
      toast({
        title: 'Erro',
        description: 'Valor da transação deve ser maior que zero',
        variant: 'destructive'
      });
      return;
    }

    if (usesPriceAndQuantity) {
      if (!price || !quantity) {
        toast({
          title: 'Erro',
          description: 'Preço e quantidade são obrigatórios para transações de ativo',
          variant: 'destructive'
        });
        return;
      }
    }

    const transactionData: any = {
      type,
      date,
      amount: effectiveAmount,
      notes: notes || undefined,
    };

    if (requiresAsset) {
      transactionData.ticker = ticker.toUpperCase();
      
      if (usesPriceAndQuantity) {
        transactionData.price = price;
        transactionData.quantity = quantity;
      }
    }

    createTransactionMutation.mutate(transactionData);
  };

  const handleConfirmWithCashCredit = async () => {
    if (!pendingTransactionData || !insufficientCashData) return;

    setShowCashConfirmDialog(false);

    createTransactionWithCashCreditMutation.mutate({
      transactionData: pendingTransactionData,
      cashCreditAmount: insufficientCashData.insufficientAmount
    });
  };

  // Combined loading state from both mutations
  const loading = createTransactionMutation.isPending || createTransactionWithCashCreditMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-type">Tipo de transação</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="tx-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType && <p className="text-xs text-muted-foreground">{selectedType.help}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tx-date">Data</Label>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      {requiresAsset && (
        <div className="space-y-1.5">
          <Label htmlFor="tx-ticker">Ticker</Label>
          <Input
            id="tx-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ex.: PETR4"
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="next"
            required
          />
        </div>
      )}

      {usesPriceAndQuantity ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-price">Preço unitário</Label>
            <PortfolioMoneyInput id="tx-price" value={price} onValueChange={setPrice} enterKeyHint="next" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-quantity">Quantidade</Label>
            <PortfolioQuantityInput
              id="tx-quantity"
              value={quantity}
              onValueChange={setQuantity}
              placeholder="0"
              enterKeyHint="go"
              required
            />
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Total: <span className="font-medium tabular-nums text-foreground">{formatBRL(effectiveAmount ?? 0)}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">Valor</Label>
          <PortfolioMoneyInput id="tx-amount" value={amount} onValueChange={setAmount} enterKeyHint="go" required />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tx-notes">
          Observações <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="tx-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalhes sobre esta transação"
          rows={2}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Registrando' : 'Registrar transação'}
        </Button>
      </div>

      <AlertDialog open={showCashConfirmDialog} onOpenChange={setShowCashConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldo insuficiente em caixa</AlertDialogTitle>
            <AlertDialogDescription>
              O caixa da carteira não cobre esta compra. Podemos registrar um aporte com a diferença antes da compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {insufficientCashData && (
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Caixa atual</dt>
                <dd className="tabular-nums text-foreground">{formatBRL(insufficientCashData.currentCashBalance)}</dd>
              </div>
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Valor da compra</dt>
                <dd className="tabular-nums text-foreground">{formatBRL(insufficientCashData.transactionAmount)}</dd>
              </div>
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="font-medium text-foreground">Aporte necessário</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatBRL(insufficientCashData.insufficientAmount)}
                </dd>
              </div>
            </dl>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmWithCashCredit}
              disabled={createTransactionWithCashCreditMutation.isPending}
            >
              {createTransactionWithCashCreditMutation.isPending ? 'Registrando' : 'Registrar aporte e compra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
