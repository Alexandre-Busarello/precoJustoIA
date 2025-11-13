'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { portfolioCache } from '@/lib/portfolio-cache';
import {
  CheckCircle2,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight
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
  console.log('🎯 [COMPONENT_RENDER] PortfolioTransactionSuggestions rendered', { 
    portfolioId, 
    trackingStarted,
    timestamp: new Date().toISOString()
  });
  
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [startingTracking, setStartingTracking] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [confirmingMonth, setConfirmingMonth] = useState<string | null>(null);
  const [rejectingMonth, setRejectingMonth] = useState<string | null>(null);
  
  // State to check if suggestions were generated recently
  const [suggestionStatus, setSuggestionStatus] = useState<{
    isRecent: boolean;
    needsRegeneration: boolean;
    cashBalance: number;
    hasCashAvailable: boolean;
  } | null>(null);
  
  // Use ref for lock to survive re-renders (React StrictMode safe)
  const isCreatingSuggestionsRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const lastPortfolioIdRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('🔄 [USE_EFFECT] Component mounted/updated', { 
      portfolioId, 
      trackingStarted, 
      hasLoadedOnce: hasLoadedOnceRef.current,
      lastPortfolioId: lastPortfolioIdRef.current
    });
    
    // Reset hasLoadedOnce if portfolioId changed
    if (lastPortfolioIdRef.current !== portfolioId) {
      console.log('🔄 [PORTFOLIO_CHANGED] Portfolio ID changed, resetting load flag');
      hasLoadedOnceRef.current = false;
      lastPortfolioIdRef.current = portfolioId;
    }
    
    // Prevent double-loading in React StrictMode (dev mode) - but only for same portfolio
    if (hasLoadedOnceRef.current && lastPortfolioIdRef.current === portfolioId) {
      console.log('⏭️ [STRICT_MODE] Skipping duplicate useEffect call (StrictMode)');
      return;
    }
    
    if (trackingStarted) {
      console.log('✅ [TRACKING_STARTED] Loading suggestions...');
      hasLoadedOnceRef.current = true;
      lastPortfolioIdRef.current = portfolioId;
      loadSuggestions();
    } else {
      console.log('⏸️ [TRACKING_NOT_STARTED] Tracking not started, skipping suggestions');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, trackingStarted]);

  // Safety filter: Ensure suggestions state never contains rebalancing transactions
  useEffect(() => {
    const hasRebalancing = suggestions.some(
      (tx) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
    );
    
    if (hasRebalancing) {
      console.warn('⚠️ Found rebalancing transactions in contribution suggestions, filtering out...');
      const filtered = suggestions.filter(
        (tx) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
      );
      setSuggestions(filtered);
    }
  }, [suggestions]);

  // Check suggestion status when component mounts or when suggestions are empty
  useEffect(() => {
    if (suggestions.length === 0) {
      const checkStatus = async () => {
        try {
          const statusResponse = await fetch(
            `/api/portfolio/${portfolioId}/transactions/suggestions/status`
          );
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setSuggestionStatus({
              isRecent: statusData.isRecent,
              needsRegeneration: statusData.needsRegeneration,
              cashBalance: statusData.cashBalance || 0,
              hasCashAvailable: statusData.hasCashAvailable || false
            });
          }
        } catch (error) {
          console.error('Error checking suggestion status:', error);
        }
      };
      checkStatus();
    }
  }, [portfolioId, suggestions.length]);

  const handleRecalculateSuggestions = async () => {
    try {
      setRecalculating(true);
      
      // 1. Delete all pending transactions (including rebalancing ones)
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
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      
      // Force refresh to reload from API
      await loadSuggestions(true);
      
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
      console.log('🔄 [LOAD_SUGGESTIONS] Starting...', { portfolioId, forceRefresh, trackingStarted });
      setLoading(true);
      
      // Try cache first (unless force refresh)
      // IMPORTANT: Don't use cache if it's empty - we need to try generating suggestions
      if (!forceRefresh) {
        const cached = portfolioCache.suggestions.get(portfolioId) as any;
        console.log('📦 [CACHE_CHECK] Cache check', { 
          hasCache: !!cached, 
          isArray: Array.isArray(cached), 
          length: Array.isArray(cached) ? cached.length : 0 
        });
        
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log('📦 [CACHE] Found cached suggestions, using them');
          // Filter out rebalancing transactions from cache
          const filteredCached = cached.filter(
            (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
          );
          if (filteredCached.length > 0) {
            console.log(`📦 [CACHE] Using ${filteredCached.length} cached suggestions`);
            setSuggestions(filteredCached);
            setLoading(false);
            return;
          } else {
            console.log('📦 [CACHE] Cached suggestions filtered out (all rebalancing), will fetch from API');
          }
        } else {
          console.log('📦 [CACHE] No cached suggestions or cache is empty, will fetch from API');
        }
      } else {
        console.log('🔄 [FORCE_REFRESH] Skipping cache, will fetch from API');
      }
      
      // First, get pending transactions that are already in the database
      // Filter only contribution-related transactions (exclude rebalancing)
      try {
        const pendingResponse = await fetch(
          `/api/portfolio/${portfolioId}/transactions?status=PENDING`
        );

        console.log('🔄 Pending response status:', pendingResponse.status);
        
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          const allPendingTx = pendingData.transactions || [];
          
          console.log(`📊 Found ${allPendingTx.length} total pending transactions`);
          
          // Separate rebalancing transactions to delete them
          const rebalancingTx = allPendingTx.filter(
            (tx: any) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
          );
          
          // Delete rebalancing transactions if found (they should be in their own component)
          if (rebalancingTx.length > 0) {
            console.log(`🧹 Found ${rebalancingTx.length} rebalancing transactions in contribution section, deleting...`);
            await Promise.all(
              rebalancingTx.map((tx: any) =>
                fetch(`/api/portfolio/${portfolioId}/transactions/${tx.id}`, {
                  method: 'DELETE'
                }).catch(() => {})
              )
            );
          }
          
          // Filter out rebalancing transactions (they have their own component)
          const pendingTx = allPendingTx.filter(
            (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
          );
          
          console.log(`📊 Found ${pendingTx.length} contribution-related pending transactions`);
          
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
                // Filter out rebalancing transactions
                const filteredTx = (reloadData.transactions || []).filter(
                  (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
                );
                portfolioCache.suggestions.set(portfolioId, filteredTx);
                setSuggestions(filteredTx);
              }
            } else {
              portfolioCache.suggestions.set(portfolioId, pendingTx);
              setSuggestions(pendingTx);
            }
            
            setLoading(false);
            return;
          }
        } else {
          console.warn('⚠️ Failed to fetch pending transactions, will try to generate suggestions anyway');
        }
      } catch (error) {
        console.error('❌ Error fetching pending transactions:', error);
        // Continue to generate suggestions even if fetch fails
      }
      
      // If we reach here, there are no pending contribution transactions
      // Check if we need to generate suggestions based on lastSuggestionsGeneratedAt
      console.log('🔄 [NO_PENDING] No pending contribution transactions found, checking if we need to generate...');
      
      // Check suggestion status first
      const statusResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/status`
      );
      
      let needsRegeneration = true;
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        needsRegeneration = statusData.needsRegeneration;
        const hasCashAvailable = statusData.hasCashAvailable || false;
        const cashBalance = statusData.cashBalance || 0;
        
        console.log(`📅 [STATUS] lastSuggestionsGeneratedAt: ${statusData.lastSuggestionsGeneratedAt}, needsRegeneration: ${needsRegeneration}, isRecent: ${statusData.isRecent}, hasCashAvailable: ${hasCashAvailable}, cashBalance: R$ ${cashBalance.toFixed(2)}`);
        
        // If suggestions were generated recently (< 30 days) AND no cash available, just show empty state
        // BUT if there's cash available, we should always generate buy suggestions
        if (!needsRegeneration && !hasCashAvailable) {
          console.log('✅ [RECENT] Suggestions were generated recently and no cash available, no need to regenerate');
          portfolioCache.suggestions.set(portfolioId, []);
          setSuggestions([]);
          setLoading(false);
          return;
        }
        
        if (hasCashAvailable) {
          console.log(`💰 [CASH_AVAILABLE] R$ ${cashBalance.toFixed(2)} available, will generate buy suggestions even if recently generated`);
        }
      }
      
      // Prevent concurrent creation of suggestions (use ref for React StrictMode)
      if (isCreatingSuggestionsRef.current) {
        console.log('⏳ [LOCK] Already creating suggestions, skipping... (ref lock active)');
        setLoading(false);
        return;
      }

      console.log('🔄 [GENERATE] Starting to generate suggestions (needsRegeneration=true)...');
      
      // Generate suggestions if needed (> 30 days since last generation)
      console.log(`📡 [API_CALL] Calling GET /api/portfolio/${portfolioId}/transactions/suggestions/contributions`);
      
      // Use the new contributions endpoint (separate from rebalancing)
      const suggestionsResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/contributions`
      );

      console.log('📡 [API_RESPONSE] Suggestions response status:', suggestionsResponse.status, suggestionsResponse.ok);
      
      if (!suggestionsResponse.ok) {
        const errorText = await suggestionsResponse.text();
        console.error('❌ Error generating suggestions:', errorText);
        throw new Error('Erro ao carregar sugestões');
      }

      const suggestionsData = await suggestionsResponse.json();
      const newSuggestions = suggestionsData.suggestions || [];
      
      console.log(`📊 [SUGGESTIONS] Generated ${newSuggestions.length} new suggestions`, newSuggestions);
      
      // If there are suggestions, create them as PENDING in the database
      if (newSuggestions.length > 0 && !isCreatingSuggestionsRef.current) {
        console.log(`📝 [CREATE] Creating ${newSuggestions.length} new contribution suggestions as PENDING...`);
        isCreatingSuggestionsRef.current = true; // Lock acquired
        
        console.log(`📡 [API_CALL] Calling POST /api/portfolio/${portfolioId}/transactions/suggestions/contributions`);
        
        try {
          const createResponse = await fetch(
            `/api/portfolio/${portfolioId}/transactions/suggestions/contributions`,
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
              // Filter out rebalancing transactions (they have their own component)
              const filteredTx = (reloadData.transactions || []).filter(
                (tx: any) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
              );
              portfolioCache.suggestions.set(portfolioId, filteredTx);
              setSuggestions(filteredTx);
              console.log(`✅ Loaded ${filteredTx.length} contribution PENDING transactions (excluded rebalancing)`);
            }
          } else {
            console.error('❌ Failed to create suggestions:', await createResponse.text());
          }
        } finally {
          isCreatingSuggestionsRef.current = false; // Lock released
          console.log('🔓 Lock released');
        }
      } else if (newSuggestions.length === 0) {
        console.log('ℹ️ No suggestions generated (may be waiting for monthly contribution decision or no cash available)');
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
      // Get transaction type before confirming to check if it's MONTHLY_CONTRIBUTION
      const txToConfirm = suggestions.find(tx => tx.id === transactionId);
      const isMonthlyContribution = txToConfirm?.type === 'MONTHLY_CONTRIBUTION';
      
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
      portfolioCache.suggestions.remove(portfolioId); // Clear suggestions cache specifically

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      
      // If monthly contribution was confirmed, wait a bit then reload to get buy suggestions
      if (isMonthlyContribution) {
        console.log('💰 [MONTHLY_CONFIRMED] Monthly contribution confirmed, will reload to get buy suggestions');
        setTimeout(() => {
          loadSuggestions(true); // Force refresh to get buy suggestions
        }, 1000);
      } else {
        loadSuggestions(true);
      }
      
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
      portfolioCache.suggestions.remove(portfolioId); // Clear suggestions cache specifically

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      loadSuggestions(true); // Force refresh
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
    // Filter out rebalancing transactions before confirming
    const contributionOnly = suggestions.filter(
      (tx) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
    );
    
    if (!confirm(`Confirmar todas as ${contributionOnly.length} transações de aportes e compras?`)) {
      return;
    }

    try {
      setConfirmingAll(true);
      
      const transactionIds = contributionOnly.map(s => s.id);
      
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
        description: `${contributionOnly.length} transações confirmadas`
      });

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);
      portfolioCache.suggestions.remove(portfolioId); // Clear suggestions cache specifically

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      
      // Check if any confirmed transaction is MONTHLY_CONTRIBUTION
      const hasMonthlyContribution = contributionOnly.some(
        tx => tx.type === 'MONTHLY_CONTRIBUTION'
      );
      
      // If monthly contribution was confirmed, wait a bit then reload to get buy suggestions
      if (hasMonthlyContribution) {
        console.log('💰 [BATCH_MONTHLY_CONFIRMED] Monthly contribution confirmed in batch, will reload to get buy suggestions');
        setTimeout(() => {
          loadSuggestions(true); // Force refresh to get buy suggestions
        }, 1500); // Wait longer for batch processing
      } else {
        loadSuggestions(true); // Force refresh
      }
      
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

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  const handleConfirmMonth = async (month: string, transactions: SuggestedTransaction[]) => {
    if (!confirm(`Confirmar todas as ${transactions.length} transações de ${month}?`)) {
      return;
    }

    try {
      setConfirmingMonth(month);
      
      const transactionIds = transactions.map(tx => tx.id);
      
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
        description: `${transactions.length} transações de ${month} confirmadas`
      });

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);
      portfolioCache.suggestions.remove(portfolioId); // Clear suggestions cache specifically

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      loadSuggestions(true); // Force refresh
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: `Erro ao confirmar transações de ${month}`,
        variant: 'destructive'
      });
    } finally {
      setConfirmingMonth(null);
    }
  };

  const handleRejectMonth = async (month: string, transactions: SuggestedTransaction[]) => {
    if (!confirm(`Rejeitar todas as ${transactions.length} transações de ${month}?`)) {
      return;
    }

    try {
      setRejectingMonth(month);
      
      // Reject each transaction individually
      const rejectPromises = transactions.map(tx =>
        fetch(`/api/portfolio/${portfolioId}/transactions/${tx.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: `Rejeitado em lote - ${month}` })
        })
      );

      const results = await Promise.allSettled(rejectPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        toast({
          title: 'Sucesso',
          description: `${successCount} transações de ${month} rejeitadas${failCount > 0 ? ` (${failCount} falharam)` : ''}`
        });
      }

      if (failCount > 0 && successCount === 0) {
        throw new Error('Todas as rejeições falharam');
      }

      // Invalidar todos os caches da carteira
      portfolioCache.invalidateAll(portfolioId);
      portfolioCache.suggestions.remove(portfolioId); // Clear suggestions cache specifically

      // Reset lock before reloading
      isCreatingSuggestionsRef.current = false;
      hasAutoExpandedRef.current = false; // Reset auto-expand flag
      loadSuggestions(true); // Force refresh
      if (onTransactionsConfirmed) onTransactionsConfirmed();
    } catch {
      toast({
        title: 'Erro',
        description: `Erro ao rejeitar transações de ${month}`,
        variant: 'destructive'
      });
    } finally {
      setRejectingMonth(null);
    }
  };

  const groupByMonth = () => {
    const groups: Record<string, SuggestedTransaction[]> = {};
    
    // Filter out rebalancing transactions (safety check)
    const contributionOnly = suggestions.filter(
      (tx) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
    );
    
    contributionOnly.forEach(tx => {
      const monthKey = format(parseLocalDate(tx.date), 'MMMM yyyy', { locale: ptBR });
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(tx);
    });

    return groups;
  };

  // Auto-expand first month on initial load only
  const hasAutoExpandedRef = useRef(false);
  
  useEffect(() => {
    if (suggestions.length > 0 && !hasAutoExpandedRef.current) {
      const groups: Record<string, SuggestedTransaction[]> = {};
      
      suggestions.forEach(tx => {
        const monthKey = format(parseLocalDate(tx.date), 'MMMM yyyy', { locale: ptBR });
        if (!groups[monthKey]) {
          groups[monthKey] = [];
        }
        groups[monthKey].push(tx);
      });
      
      const firstMonth = Object.keys(groups)[0];
      if (firstMonth) {
        setExpandedMonths(new Set([firstMonth]));
        hasAutoExpandedRef.current = true; // Mark as auto-expanded to prevent future auto-expansions
      }
    }
  }, [suggestions]);

  console.log('🎯 [RENDER_CHECK] Component render check', { 
    loading, 
    trackingStarted, 
    suggestionsCount: suggestions.length 
  });

  if (loading) {
    console.log('⏳ [LOADING] Showing loading spinner');
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trackingStarted) {
    console.log('⏸️ [TRACKING_NOT_STARTED] Showing tracking not started card');
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
    // Show "Tudo em dia" only if:
    // 1. Suggestions were generated recently (< 30 days) AND
    // 2. No cash available (if there's cash, we should suggest buys)
    const shouldShowAllUpToDate = (suggestionStatus?.isRecent ?? false) && 
      !(suggestionStatus?.hasCashAvailable ?? false);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <CardTitle className="text-lg">Aportes e Compras</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            {shouldShowAllUpToDate ? (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600 opacity-50" />
                <p className="font-medium">Tudo em dia!</p>
                <p className="text-sm mt-1">Não há aportes ou compras pendentes no momento</p>
              </>
            ) : (
              <>
                <p className="font-medium mb-2">Nenhuma sugestão encontrada</p>
                <p className="text-sm mt-1 mb-4">Clique no botão abaixo para gerar novas sugestões</p>
                <Button
                  onClick={() => {
                    console.log('🔄 [MANUAL_REFRESH] User clicked to refresh suggestions');
                    hasLoadedOnceRef.current = false;
                    portfolioCache.suggestions.remove(portfolioId);
                    loadSuggestions(true);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Gerar Sugestões
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out rebalancing transactions before rendering (final safety check)
  const contributionSuggestions = suggestions.filter(
    (tx) => tx.type !== 'SELL_REBALANCE' && tx.type !== 'BUY_REBALANCE'
  );
  
  const monthGroups = groupByMonth();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <h3 className="font-semibold text-sm sm:text-base">
            Aportes e Compras
          </h3>
          {contributionSuggestions.length > 0 && (
            <Badge variant="outline" className="ml-2">
              {contributionSuggestions.length} pendente{contributionSuggestions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            onClick={handleRecalculateSuggestions}
            disabled={recalculating}
            size="sm"
            variant="ghost"
            title="Recalcular sugestões de transações"
            className="text-xs flex-shrink-0 cursor-pointer hover:no-underline"
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            <span className="ml-2 hidden sm:inline">Recalcular</span>
          </Button>
          
          {contributionSuggestions.length > 1 && (
            <Button
              onClick={handleConfirmAll}
              disabled={confirmingAll}
              size="sm"
              className="flex-shrink-0 text-xs sm:text-sm cursor-pointer hover:no-underline"
            >
              {confirmingAll ? 'Confirmando...' : 'Confirmar Todas'}
            </Button>
          )}
        </div>
      </div>

      {/* Transactions grouped by month */}
      {Object.entries(monthGroups).map(([month, transactions]) => {
        const isExpanded = expandedMonths.has(month);
        const isConfirmingThisMonth = confirmingMonth === month;
        const isRejectingThisMonth = rejectingMonth === month;
        
        return (
          <Card key={month}>
            <Collapsible open={isExpanded} onOpenChange={() => toggleMonth(month)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <CardTitle className="text-base capitalize truncate">{month}</CardTitle>
                      <Badge variant="outline" className="flex-shrink-0">{transactions.length}</Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Month Actions - Only show when expanded */}
                      {isExpanded && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmMonth(month, transactions);
                            }}
                            disabled={isConfirmingThisMonth || isRejectingThisMonth}
                            className="text-xs px-1.5 py-1 h-7 min-w-0 cursor-pointer hover:no-underline"
                          >
                            {isConfirmingThisMonth ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectMonth(month, transactions);
                            }}
                            disabled={isConfirmingThisMonth || isRejectingThisMonth}
                            className="text-xs px-1.5 py-1 h-7 min-w-0 cursor-pointer hover:no-underline"
                          >
                            {isRejectingThisMonth ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                          </Button>
                        </div>
                      )}
                      {/* Expand/Collapse Icon */}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
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
                            className="h-8 w-8 sm:h-9 sm:w-9 p-0 cursor-pointer hover:no-underline"
                            disabled={isConfirmingThisMonth || isRejectingThisMonth}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRejectSingle(tx.id)}
                            title="Rejeitar"
                            className="h-8 w-8 sm:h-9 sm:w-9 p-0 cursor-pointer hover:no-underline"
                            disabled={isConfirmingThisMonth || isRejectingThisMonth}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}

