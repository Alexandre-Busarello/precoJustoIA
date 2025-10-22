'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { portfolioCache } from '@/lib/portfolio-cache';
import { invalidateDashboardPortfoliosCache } from './dashboard-portfolios';
import {
  CheckCircle2,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper to parse date strings as local dates without timezone conversion
const parseLocalDate = (dateString: string): Date => {
  // Remove timezone info and parse as local
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

interface PortfolioTransactionSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTrackingStart?: () => void;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioTransactionSuggestions({
  portfolioId,
  trackingStarted,
  onTrackingStart,
  onTransactionsConfirmed
}: PortfolioTransactionSuggestionsProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [startingTracking, setStartingTracking] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  // Use ref for lock to survive re-renders (React StrictMode safe)
  const isCreatingSuggestionsRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    // Prevent double-loading in React StrictMode (dev mode)
    if (hasLoadedOnceRef.current) {
      console.log('⏭️ Skipping duplicate useEffect call (StrictMode)');
      return;
    }
    
    if (trackingStarted) {
      hasLoadedOnceRef.current = true;
      loadSuggestions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, trackingStarted]);

  const handleRecalculateSuggestions = async () => {
    try {
      setRecalculating(true);
      
      // 1. Delete all pending transactions
      const deleteResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/pending`,
        { method: 'DELETE' }
      );

      if (!deleteResponse.ok) {
        throw new Error('Erro ao deletar transações pendentes');
      }

      const deleteData = await deleteResponse.json();
      
      // 2. Reset locks and reload suggestions
      isCreatingSuggestionsRef.current = false;
      hasLoadedOnceRef.current = false;
      await loadSuggestions();
      
      toast({
        title: 'Sugestões recalculadas',
        description: `${deleteData.deletedCount} transações antigas foram removidas e novas sugestões foram geradas`
      });

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);

      if (onTransactionsConfirmed) {
        onTransactionsConfirmed();
      }
    } catch (error) {
      console.error('Erro ao recalcular sugestões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível recalcular as sugestões',
        variant: 'destructive'
      });
    } finally {
      setRecalculating(false);
    }
  };

  const handleStartTracking = async () => {
    try {
      setStartingTracking(true);
      
      const response = await fetch(
        `/api/portfolio/${portfolioId}/start-tracking`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Erro ao iniciar acompanhamento');
      }

      toast({
        title: 'Acompanhamento Iniciado!',
        description: 'Sugestões automáticas serão geradas mensalmente a partir de agora.'
      });

      if (onTrackingStart) {
        onTrackingStart();
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao iniciar acompanhamento',
        variant: 'destructive'
      });
    } finally {
      setStartingTracking(false);
    }
  };

  const loadSuggestions = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = portfolioCache.suggestions.get(portfolioId) as any;
        if (cached) {
          setSuggestions(cached);
          setLoading(false);
          return;
        }
      }
      
      // First, get pending transactions that are already in the database
      const pendingResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingTx = pendingData.transactions || [];
        
        // If there are pending transactions, check for duplicates
        if (pendingTx.length > 0) {
          // Check for duplicates (same date, type, ticker)
          const seen = new Set<string>();
          let hasDuplicates = false;
          
          for (const tx of pendingTx) {
            const key = `${tx.date}_${tx.type}_${tx.ticker || 'null'}`;
            if (seen.has(key)) {
              hasDuplicates = true;
              break;
            }
            seen.add(key);
          }
          
          // If duplicates found, clean them up
          if (hasDuplicates) {
            console.log('🧹 Duplicates detected, cleaning up...');
            await fetch(
              `/api/portfolio/${portfolioId}/transactions/cleanup-duplicates`,
              { method: 'POST' }
            );
            
            // Reload after cleanup
            const reloadResponse = await fetch(
              `/api/portfolio/${portfolioId}/transactions?status=PENDING`
            );
            
            if (reloadResponse.ok) {
              const reloadData = await reloadResponse.json();
              portfolioCache.suggestions.set(portfolioId, reloadData.transactions || []);
              setSuggestions(reloadData.transactions || []);
            }
          } else {
            portfolioCache.suggestions.set(portfolioId, pendingTx);
            setSuggestions(pendingTx);
          }
          
          setLoading(false);
          return;
        }
      }
      
      // Prevent concurrent creation of suggestions (use ref for React StrictMode)
      if (isCreatingSuggestionsRef.current) {
        console.log('⏳ Already creating suggestions, skipping... (ref lock active)');
        setLoading(false);
        return;
      }
      
      // If no pending transactions, generate new suggestions
      const suggestionsResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions`
      );
      
      if (!suggestionsResponse.ok) {
        throw new Error('Erro ao carregar sugestões');
      }

      const suggestionsData = await suggestionsResponse.json();
      const newSuggestions = suggestionsData.suggestions || [];
      
      // If there are suggestions, create them as PENDING in the database
      if (newSuggestions.length > 0 && !isCreatingSuggestionsRef.current) {
        console.log(`📝 Creating ${newSuggestions.length} new suggestions as PENDING...`);
        isCreatingSuggestionsRef.current = true; // Lock acquired
        
        try {
          const createResponse = await fetch(
            `/api/portfolio/${portfolioId}/transactions/suggestions`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (createResponse.ok) {
            const createData = await createResponse.json();
            console.log(`✅ Created pending transactions:`, createData);
            
            // Reload to get the created PENDING transactions with IDs
            const reloadResponse = await fetch(
              `/api/portfolio/${portfolioId}/transactions?status=PENDING`
            );
            
            if (reloadResponse.ok) {
              const reloadData = await reloadResponse.json();
              portfolioCache.suggestions.set(portfolioId, reloadData.transactions || []);
              setSuggestions(reloadData.transactions || []);
              console.log(`✅ Loaded ${reloadData.transactions?.length || 0} PENDING transactions`);
            }
          } else {
            console.error('❌ Failed to create suggestions:', await createResponse.text());
          }
        } finally {
          isCreatingSuggestionsRef.current = false; // Lock released
          console.log('🔓 Lock released');
        }
      } else if (newSuggestions.length === 0) {
        portfolioCache.suggestions.set(portfolioId, []);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as sugestões',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      loadSuggestions();
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

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      loadSuggestions();
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
    if (!confirm(`Confirmar todas as ${suggestions.length} transações sugeridas?`)) {
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

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      loadSuggestions();
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

  const groupByMonth = () => {
    const groups: Record<string, SuggestedTransaction[]> = {};
    
    suggestions.forEach(tx => {
      const monthKey = format(parseLocalDate(tx.date), 'MMMM yyyy', { locale: ptBR });
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(tx);
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trackingStarted) {
    return (
      <Card className="border-2 border-dashed border-blue-200 dark:border-blue-900">
        <CardContent className="py-12">
          <div className="text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-blue-600 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Acompanhamento não iniciado</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Após alimentar sua carteira com transações retroativas,
              inicie o acompanhamento para receber sugestões mensais automáticas.
            </p>
            <Button 
              onClick={handleStartTracking}
              disabled={startingTracking}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {startingTracking ? 'Iniciando...' : 'Iniciar Acompanhamento Automático'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600 opacity-50" />
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm mt-1">Não há transações pendentes no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const monthGroups = groupByMonth();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <h3 className="font-semibold text-sm sm:text-base">
            {suggestions.length} transaç{suggestions.length !== 1 ? 'ões' : 'ão'} pendente{suggestions.length !== 1 ? 's' : ''}
          </h3>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={handleRecalculateSuggestions}
            disabled={recalculating}
            size="sm"
            variant="ghost"
            title="Recalcular sugestões de transações"
            className="text-xs flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            <span className="ml-2 hidden sm:inline">Recalcular</span>
          </Button>
          {/* {suggestions.length > 10 && (
            <Button
              onClick={handleCleanupDuplicates}
              disabled={cleaningDuplicates}
              size="sm"
              variant="outline"
              title="Remover transações duplicadas"
              className="flex-1 sm:flex-none text-xs sm:text-sm"
            >
              <span className="hidden md:inline">{cleaningDuplicates ? '🧹 Limpando...' : '🧹 Limpar Duplicatas'}</span>
              <span className="md:hidden">{cleaningDuplicates ? 'Limpando...' : '🧹 Limpar'}</span>
            </Button>
          )} */}
          
          {suggestions.length > 1 && (
            <Button
              onClick={handleConfirmAll}
              disabled={confirmingAll}
              size="sm"
              className="flex-1 sm:flex-none text-xs sm:text-sm"
            >
              {confirmingAll ? 'Confirmando...' : 'Confirmar Todas'}
            </Button>
          )}
        </div>
      </div>

      {/* Transactions grouped by month */}
      {Object.entries(monthGroups).map(([month, transactions]) => (
        <Card key={month}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base capitalize">{month}</CardTitle>
              <Badge variant="outline">{transactions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.map(tx => (
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

