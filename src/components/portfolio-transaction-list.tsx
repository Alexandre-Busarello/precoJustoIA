'use client';

import { useState, useEffect } from 'react';
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
  Check,
  X,
  RotateCcw,
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, filterStatus, filterType]);

  const loadTransactions = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);
      
      // Cache key includes filters
      const cacheKey = `${portfolioId}_${filterStatus}_${filterType}`;
      
      // Try cache first (unless force refresh or filters applied)
      if (!forceRefresh && filterStatus === 'all' && filterType === 'all') {
        const cached = portfolioCache.transactions.get(portfolioId) as any;
        if (cached) {
          const sortedTransactions = sortAndGroupTransactions(cached);
          setTransactions(sortedTransactions);
          setLoading(false);
          return;
        }
      }
      
      // Fetch from API
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar transações');
      }

      const data = await response.json();
      
      // Only cache if no filters
      if (filterStatus === 'all' && filterType === 'all') {
        portfolioCache.transactions.set(portfolioId, data.transactions || []);
      }
      
      const sortedTransactions = sortAndGroupTransactions(data.transactions || []);
      setTransactions(sortedTransactions);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as transações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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
      'CASH_CREDIT': 7           // Aporte (primeira operação do dia, aparece por último na lista DESC)
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

  const handleEditSave = async () => {
    if (!editingTransaction) return;

    try {
      setSaving(true);

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

      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${editingTransaction.id}`,
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

      toast({
        title: 'Sucesso',
        description: 'Transação atualizada com sucesso'
      });

      // Invalidar todos os caches da carteira e dashboard
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();

      setShowEditModal(false);
      setEditingTransaction(null);
      loadTransactions();
      if (onTransactionUpdate) onTransactionUpdate();
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar transação',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${deletingTransaction.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação excluída com sucesso'
      });

      // Invalidar todos os caches da carteira e dashboard
      portfolioCache.invalidateAll(portfolioId);
      invalidateDashboardPortfoliosCache();

      setShowDeleteDialog(false);
      setDeletingTransaction(null);
      loadTransactions();
      if (onTransactionUpdate) onTransactionUpdate();
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir transação',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirm = async (transactionId: string) => {
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

      // Invalidar cache do dashboard
      invalidateDashboardPortfoliosCache();
      
      loadTransactions();
      if (onTransactionUpdate) onTransactionUpdate();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar transação',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async (transactionId: string) => {
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

      // Invalidar cache do dashboard
      invalidateDashboardPortfoliosCache();
      
      loadTransactions();
      if (onTransactionUpdate) onTransactionUpdate();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao rejeitar transação',
        variant: 'destructive'
      });
    }
  };

  const handleRevert = async (transactionId: string) => {
    try {
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions/${transactionId}/revert`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Erro ao reverter transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação revertida para pendente'
      });

      // Invalidar cache do dashboard
      invalidateDashboardPortfoliosCache();
      portfolioCache.invalidateAll(portfolioId);
      
      await loadTransactions();
      if (onTransactionUpdate) onTransactionUpdate();
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao reverter transação',
        variant: 'destructive'
      });
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'CASH_CREDIT' || type === 'DIVIDEND') {
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
    const variants: Record<string, any> = {
      'PENDING': { variant: 'outline', label: 'Pendente' },
      'CONFIRMED': { variant: 'default', label: 'Confirmada' },
      'EXECUTED': { variant: 'secondary', label: 'Executada' },
      'REJECTED': { variant: 'destructive', label: 'Rejeitada' }
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
            <SelectItem value="EXECUTED">Executadas</SelectItem>
            <SelectItem value="CONFIRMED,EXECUTED">Confirmadas e Executadas</SelectItem>
            <SelectItem value="REJECTED">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="CASH_CREDIT">Aportes</SelectItem>
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
        <div className="border rounded-lg overflow-x-auto">
          <Table>
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
                    {tx.quantity ? tx.quantity.toFixed(0) : '-'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(tx.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {tx.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleConfirm(tx.id)}
                            title="Confirmar"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(tx.id)}
                            title="Rejeitar"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {(tx.status === 'CONFIRMED' || tx.status === 'REJECTED') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevert(tx.id)}
                          title="Reverter"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
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
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
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
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir Transação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

