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
import { DollarSign, AlertTriangle, Plus } from 'lucide-react';
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';
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
}

const TRANSACTION_TYPES = [
  { value: 'CASH_CREDIT', label: 'Aporte em Dinheiro', requiresAsset: false },
  { value: 'CASH_DEBIT', label: 'Saque de Dinheiro', requiresAsset: false },
  { value: 'BUY', label: 'Compra de Ativo', requiresAsset: true },
  { value: 'SELL_WITHDRAWAL', label: 'Venda de Ativo', requiresAsset: true },
  { value: 'DIVIDEND', label: 'Dividendo Recebido', requiresAsset: true },
];

export function PortfolioTransactionForm({
  portfolioId,
  onSuccess,
  onCancel
}: PortfolioTransactionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCashConfirmDialog, setShowCashConfirmDialog] = useState(false);
  const [insufficientCashData, setInsufficientCashData] = useState<{
    insufficientAmount: number;
    currentCashBalance: number;
    transactionAmount: number;
  } | null>(null);
  const [pendingTransactionData, setPendingTransactionData] = useState<any>(null);

  // Form state
  const [type, setType] = useState('CASH_CREDIT');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ticker, setTicker] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const selectedType = TRANSACTION_TYPES.find(t => t.value === type);
  const requiresAsset = selectedType?.requiresAsset || false;

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
        title: 'Sucesso!',
        description: responseData.message || 'Transação registrada com sucesso'
      });

      // Invalidar cache de analytics e dashboard
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      invalidatePortfolioAnalyticsCache(portfolioId);
      invalidateDashboardPortfoliosCache();

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
        title: 'Sucesso!',
        description: responseData.message || 'Aporte e compra criados com sucesso'
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

  // Auto-calculate amount when price or quantity changes
  const handlePriceChange = (value: string) => {
    setPrice(value);
    if (quantity && value) {
      const calc = parseFloat(quantity) * parseFloat(value);
      if (!isNaN(calc) && calc > 0) {
        setAmount(calc.toFixed(2));
      }
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (price && value) {
      const calc = parseFloat(value) * parseFloat(price);
      if (!isNaN(calc) && calc > 0) {
        setAmount(calc.toFixed(2));
      }
    }
  };

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

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Erro',
        description: 'Valor da transação deve ser maior que zero',
        variant: 'destructive'
      });
      return;
    }

    if (requiresAsset && type !== 'DIVIDEND') {
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
      amount: parseFloat(amount),
      notes: notes || undefined,
    };

    if (requiresAsset) {
      transactionData.ticker = ticker.toUpperCase();
      
      if (type !== 'DIVIDEND') {
        transactionData.price = parseFloat(price);
        transactionData.quantity = parseFloat(quantity);
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
      {/* Transaction Type */}
      <div>
        <Label htmlFor="type">Tipo de Transação *</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
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
      </div>

      {/* Date */}
      <div>
        <Label htmlFor="date">Data *</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* Ticker (conditional) */}
      {requiresAsset && (
        <div>
          <Label htmlFor="ticker">Ticker do Ativo *</Label>
          <Input
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ex: PETR4"
            required
          />
        </div>
      )}

      {/* Amount */}
      <div>
        <Label htmlFor="amount">
          Valor (R$) * {requiresAsset && type !== 'DIVIDEND' && '(calculado automaticamente)'}
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-9"
            placeholder="0.00"
            required
            readOnly={requiresAsset && type !== 'DIVIDEND'}
            disabled={requiresAsset && type !== 'DIVIDEND'}
          />
        </div>
      </div>

      {/* Price and Quantity (for asset transactions, except dividends) */}
      {requiresAsset && type !== 'DIVIDEND' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Preço Unitário (R$) *</Label>
            <Input
              id="price"
              type="number"
              step="0.0001"
              min="0.0001"
              value={price}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantidade *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.000001"
              min="0.000001"
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Adicione detalhes sobre esta transação..."
          rows={3}
        />
      </div>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Dica:</p>
        {type === 'CASH_CREDIT' && (
          <p>Registre aportes de dinheiro na carteira. Este valor ficará disponível para compra de ativos.</p>
        )}
        {type === 'CASH_DEBIT' && (
          <p>Registre saques de dinheiro da carteira.</p>
        )}
        {type === 'BUY' && (
          <p>Registre compras de ativos. Preencha preço e quantidade, ou apenas valor total.</p>
        )}
        {type === 'SELL_WITHDRAWAL' && (
          <p>Registre vendas de ativos com retirada do valor da carteira.</p>
        )}
        {type === 'DIVIDEND' && (
          <p>Registre dividendos recebidos. O valor será adicionado ao caixa da carteira.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? 'Registrando...' : 'Registrar Transação'}
        </Button>
      </div>

      {/* Insufficient Cash Dialog */}
      <AlertDialog open={showCashConfirmDialog} onOpenChange={setShowCashConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Saldo Insuficiente em Caixa
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 mt-4">
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-4 rounded-lg">
                  <p className="text-sm text-foreground mb-2">
                    Você não possui saldo suficiente em caixa para esta compra.
                  </p>
                  {insufficientCashData && (
                    <div className="space-y-1 text-sm">
                      <p><strong>Caixa atual:</strong> R$ {insufficientCashData.currentCashBalance.toFixed(2)}</p>
                      <p><strong>Valor da compra:</strong> R$ {insufficientCashData.transactionAmount.toFixed(2)}</p>
                      <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                        <strong>Faltam:</strong> R$ {insufficientCashData.insufficientAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Deseja adicionar o aporte automaticamente?
                      </p>
                      <p className="text-blue-800 dark:text-blue-200">
                        Criaremos duas transações:
                      </p>
                      <ol className="list-decimal list-inside mt-2 space-y-1 text-blue-800 dark:text-blue-200">
                        <li>Crédito de Caixa: R$ {insufficientCashData?.insufficientAmount.toFixed(2)}</li>
                        <li>Compra do Ativo: R$ {insufficientCashData?.transactionAmount.toFixed(2)}</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmWithCashCredit}
              disabled={createTransactionWithCashCreditMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createTransactionWithCashCreditMutation.isPending ? 'Criando...' : 'Sim, Adicionar Aporte'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

