'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Trash2, Calculator } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { SectionHeader } from '@/components/ui/section-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast as sonnerToast } from 'sonner';
import { portfolioCache } from '@/lib/portfolio-cache';
import { formatBRL, formatDate, formatDeltaPct, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';
import { RecoveryCalculatorSheet } from '@/components/recovery-calculator-sheet';
import { PortfolioMoneyInput, PortfolioQuantityInput, roundTo } from '@/components/portfolio-money-input';
import { calculateRecovery } from '@/lib/recovery-calculator-utils';

/** "YYYY-MM-DD..." → data local ao meio-dia (sem trocar o dia por fuso). */
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12);
};

const TYPE_LABELS: Record<string, string> = {
  CASH_CREDIT: 'Aporte',
  MONTHLY_CONTRIBUTION: 'Aporte mensal',
  CASH_DEBIT: 'Saque',
  BUY: 'Compra',
  SELL_REBALANCE: 'Venda (ajuste)',
  BUY_REBALANCE: 'Compra (ajuste)',
  SELL_WITHDRAWAL: 'Venda',
  DIVIDEND: 'Dividendo',
};

const getTypeLabel = (type: string) => TYPE_LABELS[type] || type;

/** Transações exibidas por vez (o restante vem com "Mostrar mais"). */
const PAGE_SIZE = 30;

interface EditFormState {
  date: string;
  amount: number | undefined;
  price: number | undefined;
  quantity: number | undefined;
  notes: string;
}

interface Transaction {
  id: string;
  date: string;
  type: string;
  status: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  cashBalanceAfter: number;
  notes?: string;
  rejectionReason?: string;
}

interface PortfolioTransactionListProps {
  portfolioId: string;
  onTransactionUpdate?: () => void;
}

export function PortfolioTransactionList({
  portfolioId,
  onTransactionUpdate
}: PortfolioTransactionListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRecovery, setFilterRecovery] = useState<'all' | 'recovery'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    date: '',
    amount: undefined,
    price: undefined,
    quantity: undefined,
    notes: '',
  });
  
  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  // Recovery sheet - transação selecionada para ver aporte
  const [recoveryTransaction, setRecoveryTransaction] = useState<Transaction | null>(null);

  // Fetch holdings para preços atuais (recuperação por transação).
  // A chave é compartilhada com PortfolioHoldingsTable: o cache guarda sempre o JSON inteiro
  // da API ({ holdings, ... }), nunca só o array, para as duas telas lerem o mesmo formato.
  const { data: holdingsData } = useQuery({
    queryKey: ['portfolio-holdings', portfolioId],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/${portfolioId}/holdings`);
      if (!res.ok) throw new Error('Erro ao carregar posições');
      return res.json();
    },
  });
  const holdings: { ticker: string; currentPrice: number }[] =
    (holdingsData as { holdings?: { ticker: string; currentPrice: number }[] } | undefined)?.holdings ?? [];
  const priceByTicker = Object.fromEntries(
    holdings.map((h: { ticker: string; currentPrice: number }) => [h.ticker, h.currentPrice])
  );

  // Sort transactions by date (DESC) and type priority
  const sortAndGroupTransactions = (txs: Transaction[]): Transaction[] => {
    // Type priority order (DESC - última transação aparece primeiro):
    // Ordem cronológica: Aporte → Dividendo → Vendas → Compras → Saques
    // Ordem na tela (DESC): Saques → Compras → Vendas → Dividendo → Aporte
    const typePriority: Record<string, number> = {
      'CASH_DEBIT': 1,           // Saque (última operação do dia)
      'BUY_REBALANCE': 2,        // Compra de rebalanceamento
      'BUY': 3,                  // Compra regular
      'SELL_WITHDRAWAL': 4,      // Venda para saque
      'SELL_REBALANCE': 5,       // Venda de rebalanceamento
      'DIVIDEND': 6,             // Dividendo
      'MONTHLY_CONTRIBUTION': 7, // Aporte Mensal
      'CASH_CREDIT': 8           // Aporte (primeira operação do dia, aparece por último na lista DESC)
    };

    const sorted = [...txs].sort((a, b) => {
      // First, sort by date (newest first)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      
      // Then, sort by type priority within the same date
      const priorityA = typePriority[a.type] || 999;
      const priorityB = typePriority[b.type] || 999;
      return priorityA - priorityB;
    });

    return sorted;
  };

  // Fetch transactions with React Query
  const fetchTransactions = async (): Promise<Transaction[]> => {
    const params = new URLSearchParams();
    // Sempre buscar apenas CONFIRMED e EXECUTED
    params.append('status', 'CONFIRMED,EXECUTED');
    if (filterType !== 'all') params.append('type', filterType);
    
    const response = await fetch(`/api/portfolio/${portfolioId}/transactions?${params}`);
    
    if (!response.ok) {
      throw new Error('Erro ao carregar transações');
    }

    const data = await response.json();
    // Filtrar PENDING e REJECTED mesmo que venham da API (segurança extra)
    const filtered = (data.transactions || []).filter((tx: Transaction) => 
      tx.status !== 'PENDING' && tx.status !== 'REJECTED'
    );
    return filtered;
  };

  const {
    data: transactionsData = [],
    isLoading: loading,
    error: transactionsError
  } = useQuery({
    queryKey: ['portfolio-transactions', portfolioId, filterType],
    queryFn: fetchTransactions,
    // Configurações globais do query-provider.tsx já aplicam:
    // staleTime: 5 minutos, gcTime: 10 minutos, refetchOnMount: false, refetchOnWindowFocus: false
  });

  // Sort and group transactions
  const transactions = sortAndGroupTransactions(transactionsData);

  // Show error toast if query fails
  useEffect(() => {
    // toast do sonner direto: o de useToast muda a cada render e repetiria o aviso.
    if (transactionsError) sonnerToast.error('Erro', { description: 'Não foi possível carregar as transações' });
  }, [transactionsError]);

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      date: transaction.date.split('T')[0],
      amount: transaction.amount,
      price: transaction.price ?? undefined,
      quantity: transaction.quantity ?? undefined,
      notes: transaction.notes || '',
    });
    setShowEditModal(true);
  };

  const editMutation = useMutation({
    mutationFn: async ({ transactionId, updates }: { transactionId: string; updates: Record<string, unknown> }) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar transação');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Transação atualizada',
        description: 'As métricas da carteira serão recalculadas.'
      });

      // Invalidar todos os caches da carteira e dashboard
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();

      // Dispatch event for cash flow change to trigger suggestion regeneration
      if (editingTransaction) {
        window.dispatchEvent(new CustomEvent('transaction-cash-flow-changed', {
          detail: {
            transactionType: editingTransaction.type,
            portfolioId: portfolioId,
            action: 'updated'
          }
        }));
      }

      setShowEditModal(false);
      setEditingTransaction(null);
      if (onTransactionUpdate) onTransactionUpdate();
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar transação',
        variant: 'destructive'
      });
    }
  });

  const handleEditSave = (event: FormEvent) => {
    event.preventDefault();
    if (!editingTransaction) return;
    if (!editForm.amount || editForm.amount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor deve ser maior que zero.', variant: 'destructive' });
      return;
    }

    const updates: { date: string; amount: number; notes: string; price?: number; quantity?: number } = {
      date: editForm.date,
      amount: editForm.amount,
      notes: editForm.notes,
    };

    if (editForm.price) {
      updates.price = editForm.price;
    }
    if (editForm.quantity) {
      updates.quantity = editForm.quantity;
    }

    editMutation.mutate({
      transactionId: editingTransaction.id,
      updates
    });
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteDialog(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir transação');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Transação excluída',
        description: 'As métricas da carteira serão recalculadas.'
      });

      // Invalidar todos os caches da carteira e dashboard
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();

      // Dispatch event for cash flow change to trigger suggestion regeneration
      if (deletingTransaction) {
        window.dispatchEvent(new CustomEvent('transaction-cash-flow-changed', {
          detail: {
            transactionType: deletingTransaction.type,
            portfolioId: portfolioId,
            action: 'deleted'
          }
        }));
      }

      setShowDeleteDialog(false);
      setDeletingTransaction(null);
      if (onTransactionUpdate) onTransactionUpdate();
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir transação:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir transação',
        variant: 'destructive'
      });
    }
  });

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    deleteMutation.mutate(deletingTransaction.id);
  };

  const getRecoveryForTransaction = (
    tx: Transaction
  ): { qtyToBuy: number; investment: number; pricePaid: number; currentPrice: number } | null => {
    if (!tx.ticker || !['BUY', 'BUY_REBALANCE'].includes(tx.type) || !tx.quantity) return null;
    const pricePaid = tx.price ?? tx.amount / tx.quantity;
    const currentPrice = priceByTicker[tx.ticker];
    if (!currentPrice || currentPrice >= pricePaid) return null;
    const drop = ((pricePaid - currentPrice) / pricePaid) * 100;
    const result = calculateRecovery({
      currentQty: tx.quantity,
      avgPrice: pricePaid,
      currentPrice,
      targetRise: drop,
      targetProfit: 0,
    });
    return result.success
      ? { qtyToBuy: result.qtyToBuy, investment: result.investmentRequired, pricePaid, currentPrice }
      : null;
  };

  const displayedTransactions =
    filterRecovery === 'recovery'
      ? transactions.filter((tx) => getRecoveryForTransaction(tx) !== null)
      : transactions;

  const recoveryHolding = (() => {
    if (!recoveryTransaction?.ticker || !recoveryTransaction.quantity) return null;
    const averagePrice = recoveryTransaction.price ?? recoveryTransaction.amount / recoveryTransaction.quantity;
    const currentPrice = priceByTicker[recoveryTransaction.ticker] ?? 0;
    return {
      ticker: recoveryTransaction.ticker,
      quantity: recoveryTransaction.quantity,
      averagePrice,
      currentPrice,
      returnPercentage: averagePrice > 0 ? currentPrice / averagePrice - 1 : 0,
    };
  })();

  const baseColumns: DataTableColumn<Transaction>[] = [
    {
      key: 'date',
      header: 'Data',
      cell: (tx) => (
        <div className="whitespace-nowrap leading-tight">
          <span className="block tabular-nums text-foreground">{formatDate(parseLocalDate(tx.date))}</span>
          <span className="block text-xs text-muted-foreground">{getTypeLabel(tx.type)}</span>
        </div>
      ),
    },
    {
      key: 'ticker',
      header: 'Ativo',
      cell: (tx) => (tx.ticker ? <span className="font-medium">{tx.ticker}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      cell: (tx) => <span className="font-medium">{formatBRL(tx.amount)}</span>,
    },
    {
      key: 'quantity',
      header: 'Qtd.',
      align: 'right',
      cell: (tx) => (tx.quantity ? formatNumber(tx.quantity) : '—'),
    },
    {
      key: 'price',
      header: 'Preço',
      align: 'right',
      cell: (tx) =>
        tx.price
          ? tx.type === 'DIVIDEND'
            ? `${formatBRL(tx.price, { digits: 4 })}/ação`
            : formatBRL(tx.price)
          : '—',
    },
    {
      key: 'recovery',
      header: 'Preço pago vs atual',
      align: 'right',
      hint: 'Compras cujo preço atual está abaixo do preço pago. Simule o aporte que traria o preço médio de volta.',
      cell: (tx) => {
        const recovery = getRecoveryForTransaction(tx);
        if (!recovery) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-negative">{formatDeltaPct(recovery.currentPrice / recovery.pricePaid - 1)}</span>
            <Button variant="ghost" size="sm" onClick={() => setRecoveryTransaction(tx)}>
              <Calculator strokeWidth={1.75} aria-hidden="true" />
              Simular
            </Button>
          </div>
        );
      },
    },
  ];

  const actionsColumn: DataTableColumn<Transaction> = {
    key: 'actions',
    header: <span className="sr-only">Ações</span>,
    align: 'right',
    cell: (tx) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`Ações da transação de ${formatDate(parseLocalDate(tx.date))}`}>
            <MoreHorizontal strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleEditClick(tx)}>
            <Edit className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDeleteClick(tx)} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  // No mobile o menu Editar/Excluir vem logo após a data (coluna fixa), para não exigir
  // rolagem horizontal até a última coluna. No desktop fica no fim da linha.
  const columns: DataTableColumn<Transaction>[] = isMobile
    ? [baseColumns[0], actionsColumn, ...baseColumns.slice(1)]
    : [...baseColumns, actionsColumn];

  const hasTicker = !!editingTransaction?.ticker;
  // Preço unitário com 4 casas quando o valor salvo não cabe em 2 (dividendos por ação e
  // compras cujo preço veio de total ÷ quantidade, ex.: 274,88 ÷ 7 = 39,2686). Assim o campo
  // mostra exatamente o número usado no recálculo do total.
  const storedPrice = editingTransaction?.price;
  const priceDigits =
    editingTransaction?.type === 'DIVIDEND' ||
    (typeof storedPrice === 'number' && Math.abs(roundTo(storedPrice, 2) - storedPrice) > 1e-9)
      ? 4
      : 2;

  return (
    <section aria-labelledby="transactions-title" className="space-y-4">
      <SectionHeader
        id="transactions-title"
        title="Histórico"
        description={loading ? undefined : `${displayedTransactions.length} ${displayedTransactions.length === 1 ? 'transação' : 'transações'}`}
      />

      <div className="grid gap-2 sm:flex">
        <Select
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value);
            setVisibleCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="CASH_CREDIT,MONTHLY_CONTRIBUTION">Aportes</SelectItem>
            <SelectItem value="BUY,BUY_REBALANCE">Compras</SelectItem>
            <SelectItem value="SELL_REBALANCE,SELL_WITHDRAWAL">Vendas</SelectItem>
            <SelectItem value="DIVIDEND">Dividendos</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterRecovery}
          onValueChange={(v) => {
            setFilterRecovery(v as 'all' | 'recovery');
            setVisibleCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por preço pago">
            <SelectValue placeholder="Preço pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as transações</SelectItem>
            <SelectItem value="recovery">Compras abaixo do preço pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && displayedTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {filterRecovery === 'recovery' ? 'Nenhuma compra abaixo do preço pago' : 'Nenhuma transação encontrada'}
          </p>
          {filterRecovery !== 'recovery' && (
            <p className="mt-1 text-sm text-muted-foreground">Registre aportes e compras para montar o histórico.</p>
          )}
        </div>
      ) : (
        <DataTable
          caption="Transações da carteira"
          columns={columns}
          rows={displayedTransactions.slice(0, visibleCount)}
          getRowId={(tx) => tx.id}
          stickyFirstColumn
          loading={loading}
        />
      )}
      {!loading && displayedTransactions.length > visibleCount && (
        <Button variant="outline" className="w-full" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          Mostrar mais {Math.min(PAGE_SIZE, displayedTransactions.length - visibleCount)} de{' '}
          {displayedTransactions.length - visibleCount} restantes
        </Button>
      )}

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
            <DialogDescription>
              {editingTransaction
                ? `${getTypeLabel(editingTransaction.type)}${editingTransaction.ticker ? ` · ${editingTransaction.ticker}` : ''}`
                : 'Atualize os detalhes da transação'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                required
              />
            </div>

            {hasTicker && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price">Preço unitário</Label>
                  <PortfolioMoneyInput
                    id="edit-price"
                    value={editForm.price}
                    digits={priceDigits}
                    enterKeyHint="next"
                    onValueChange={(price) =>
                      setEditForm((form) => ({
                        ...form,
                        price,
                        amount: price !== undefined && form.quantity ? roundTo(price * form.quantity) : form.amount,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-quantity">Quantidade</Label>
                  <PortfolioQuantityInput
                    id="edit-quantity"
                    value={editForm.quantity}
                    allowFraction={editForm.quantity !== undefined && !Number.isInteger(editForm.quantity)}
                    enterKeyHint="next"
                    onValueChange={(quantity) =>
                      setEditForm((form) => ({
                        ...form,
                        quantity,
                        amount: quantity !== undefined && form.price ? roundTo(form.price * quantity) : form.amount,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Valor total</Label>
              <PortfolioMoneyInput
                id="edit-amount"
                value={editForm.amount}
                enterKeyHint="go"
                required
                onValueChange={(amount) =>
                  setEditForm((form) => ({
                    ...form,
                    amount,
                    price:
                      hasTicker && amount !== undefined && form.quantity
                        ? roundTo(amount / form.quantity, priceDigits)
                        : form.price,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">
                Observações <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Detalhes sobre esta transação"
                rows={2}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={editMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Salvando' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecoveryCalculatorSheet
        holding={recoveryHolding}
        open={!!recoveryTransaction}
        onOpenChange={(open) => !open && setRecoveryTransaction(null)}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As métricas da carteira serão recalculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletingTransaction && (
            <dl className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Data</dt>
                <dd className="text-foreground">{formatDate(parseLocalDate(deletingTransaction.date))}</dd>
              </div>
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="text-foreground">
                  {getTypeLabel(deletingTransaction.type)}
                  {deletingTransaction.ticker ? ` · ${deletingTransaction.ticker}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">Valor</dt>
                <dd className="tabular-nums text-foreground">{formatBRL(deletingTransaction.amount)}</dd>
              </div>
            </dl>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {deleteMutation.isPending ? 'Excluindo' : 'Excluir transação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
