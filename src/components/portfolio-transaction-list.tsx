'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { portfolioCache } from '@/lib/portfolio-cache';
import { invalidateDashboardPortfoliosCache } from '@/components/dashboard-portfolios';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
  DollarSign,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper to parse date strings as local dates without timezone conversion
const parseLocalDate = (dateString: string): Date => {
  // Remove timezone info and parse as local
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};
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
  const [filterType, setFilterType] = useState<string>('all');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    amount: '',
    price: '',
    quantity: '',
    notes: ''
  });
  
  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

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

    console.log('🔄 Transações ordenadas:', sorted.map(t => ({
      date: t.date.split('T')[0],
      type: t.type,
      ticker: t.ticker,
      priority: typePriority[t.type]
    })));

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
    if (transactionsError) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as transações',
        variant: 'destructive'
      });
    }
  }, [transactionsError, toast]);

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      date: transaction.date.split('T')[0],
      amount: transaction.amount.toString(),
      price: transaction.price?.toString() || '',
      quantity: transaction.quantity?.toString() || '',
      notes: transaction.notes || ''
    });
    setShowEditModal(true);
  };

  const editMutation = useMutation({
    mutationFn: async ({ transactionId, updates }: { transactionId: string; updates: any }) => {
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
        title: 'Sucesso',
        description: 'Transação atualizada com sucesso'
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

  const handleEditSave = async () => {
    if (!editingTransaction) return;

    const updates: any = {
      date: editForm.date,
      amount: parseFloat(editForm.amount),
      notes: editForm.notes
    };

    if (editForm.price) {
      updates.price = parseFloat(editForm.price);
    }
    if (editForm.quantity) {
      updates.quantity = parseFloat(editForm.quantity);
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
        title: 'Sucesso',
        description: 'Transação excluída com sucesso'
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

  // Removed handleConfirm and handleReject - PENDING and REJECTED transactions are no longer shown

  // Removed handleRevert and revertMutation - transactions are always executed, no need to revert

  const getTypeIcon = (type: string) => {
    if (type === 'CASH_CREDIT' || type === 'MONTHLY_CONTRIBUTION' || type === 'DIVIDEND') {
      return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
    }
    if (type === 'CASH_DEBIT' || type.includes('SELL')) {
      return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
    }
    return <DollarSign className="h-4 w-4 text-blue-600" />;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'CASH_CREDIT': 'Aporte',
      'MONTHLY_CONTRIBUTION': 'Aporte Mensal',
      'CASH_DEBIT': 'Saque',
      'BUY': 'Compra',
      'SELL_REBALANCE': 'Venda (Rebal.)',
      'BUY_REBALANCE': 'Compra (Rebal.)',
      'SELL_WITHDRAWAL': 'Venda',
      'DIVIDEND': 'Dividendo'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    // CONFIRMED e EXECUTED aparecem como "Executada" na interface
    const variants: Record<string, any> = {
      'CONFIRMED': { variant: 'secondary', label: 'Executada' },
      'EXECUTED': { variant: 'secondary', label: 'Executada' }
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
      </div>

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma transação encontrada</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto max-w-full">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {format(parseLocalDate(tx.date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(tx.type)}
                      <span className="text-sm">{getTypeLabel(tx.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.ticker || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.type === 'DIVIDEND' && tx.quantity && tx.price ? (
                      <div className="flex flex-col items-end">
                        <span>{tx.quantity.toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">
                          × R$ {tx.price.toFixed(4)}/ação
                        </span>
                      </div>
                    ) : (
                      tx.quantity ? tx.quantity.toFixed(0) : '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(tx.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Mais ações"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(tx)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(tx)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Transaction Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>
              Atualize os detalhes da transação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-date">Data *</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit-amount">Valor (R$) *</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value, price: (parseFloat(editForm.amount) / parseFloat(editForm.quantity || '0')).toFixed(2), quantity: (parseFloat(editForm.amount) / parseFloat(editForm.price || '0')).toFixed(2) })}
                required
              />
            </div>

            {editingTransaction?.ticker && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-price">Preço Unitário</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value, amount: (parseFloat(editForm.quantity || '0') * parseFloat(e.target.value)).toFixed(2) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-quantity">Quantidade</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      step="1"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value, amount: (parseFloat(editForm.price || '0') * parseFloat(e.target.value)).toFixed(2) })}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="edit-notes">Observações</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Adicione observações sobre esta transação..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                disabled={editMutation.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação?
              {deletingTransaction && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Data:</strong> {format(parseLocalDate(deletingTransaction.date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  <p><strong>Tipo:</strong> {getTypeLabel(deletingTransaction.type)}</p>
                  {deletingTransaction.ticker && (
                    <p><strong>Ativo:</strong> {deletingTransaction.ticker}</p>
                  )}
                  <p><strong>Valor:</strong> R$ {deletingTransaction.amount.toFixed(2)}</p>
                </div>
              )}
              <p className="mt-3 text-destructive font-medium">
                Esta ação não pode ser desfeita e as métricas serão recalculadas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir Transação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

