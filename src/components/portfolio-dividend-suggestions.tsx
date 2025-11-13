'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { portfolioCache } from '@/lib/portfolio-cache';
import {
  CheckCircle2,
  XCircle,
  DollarSign,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface PortfolioDividendSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioDividendSuggestions({
  portfolioId,
  trackingStarted,
  onTransactionsConfirmed
}: PortfolioDividendSuggestionsProps) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  useEffect(() => {
    if (trackingStarted) {
      loadSuggestions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, trackingStarted]);

  const loadSuggestions = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = portfolioCache.dividends.get(portfolioId) as SuggestedTransaction[] | null;
        if (cached && Array.isArray(cached) && cached.length >= 0) {
          console.log('✅ [DIVIDENDS CACHE] Using cached data');
          setSuggestions(cached);
          setLoading(false);
          return;
        }
      }
      
      // First, fetch pending DIVIDEND transactions
      const pendingResponse = await fetch(`/api/portfolio/${portfolioId}/transactions?status=PENDING&type=DIVIDEND`);
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingDividends = (pendingData.transactions || []).filter((tx: any) => tx.type === 'DIVIDEND');
        
        if (pendingDividends.length > 0) {
          // Cache pending transactions
          portfolioCache.dividends.set(portfolioId, pendingDividends);
          setSuggestions(pendingDividends);
          setLoading(false);
          return;
        }
      }

      // If no pending transactions, try to get suggestions
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/dividends`);
      if (!response.ok) {
        throw new Error('Erro ao carregar sugestões de dividendos');
      }

      const data = await response.json();
      const fetchedSuggestions = data.suggestions || [];
      
      // Map suggestions to include id (for pending transactions)
      // If suggestions don't have id, they're not yet created as pending transactions
      const mappedSuggestions = fetchedSuggestions.map((s: any, index: number) => ({
        ...s,
        id: s.id || `suggestion-${index}` // Temporary id for display
      }));
      
      // Cache suggestions (TTL 24 horas)
      portfolioCache.dividends.set(portfolioId, mappedSuggestions);
      setSuggestions(mappedSuggestions);
    } catch (error) {
      console.error('Erro ao carregar sugestões de dividendos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar sugestões de dividendos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/dividends`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar sugestões');
      }

      const data = await response.json();
      
      if (data.transactionIds && data.transactionIds.length > 0) {
        toast({
          title: 'Sucesso',
          description: `${data.transactionIds.length} sugestão(ões) de dividendo criada(s)`,
        });
        
        // Clear cache and reload (force refresh to get new pending transactions)
        portfolioCache.dividends.remove(portfolioId);
        portfolioCache.suggestions.remove(portfolioId);
        await loadSuggestions(true);
        
        if (onTransactionsConfirmed) {
          onTransactionsConfirmed();
        }
      } else {
        toast({
          title: 'Info',
          description: data.message || 'Nenhuma sugestão de dividendo para criar',
        });
      }
    } catch (error) {
      console.error('Erro ao gerar sugestões:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao gerar sugestões',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const confirmAll = async () => {
    if (suggestions.length === 0) return;

    try {
      setConfirmingAll(true);
      const transactionIds = suggestions.map(s => s.id);

      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/confirm-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds })
      });

      if (!response.ok) {
        throw new Error('Erro ao confirmar transações');
      }

      toast({
        title: 'Sucesso',
        description: `${transactionIds.length} transação(ões) confirmada(s)`,
      });

      // Clear cache and reload
      portfolioCache.suggestions.remove(portfolioId);
      portfolioCache.transactions.remove(portfolioId);
      await loadSuggestions();

      if (onTransactionsConfirmed) {
        onTransactionsConfirmed();
      }
    } catch (error) {
      console.error('Erro ao confirmar transações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar as transações',
        variant: 'destructive'
      });
    } finally {
      setConfirmingAll(false);
    }
  };

  const confirmTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/confirm`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Erro ao confirmar transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação confirmada',
      });

      // Clear cache and reload (force refresh)
      portfolioCache.dividends.remove(portfolioId);
      portfolioCache.suggestions.remove(portfolioId);
      portfolioCache.transactions.remove(portfolioId);
      await loadSuggestions(true);

      if (onTransactionsConfirmed) {
        onTransactionsConfirmed();
      }
    } catch (error) {
      console.error('Erro ao confirmar transação:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar a transação',
        variant: 'destructive'
      });
    }
  };

  const rejectTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/reject`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Erro ao rejeitar transação');
      }

      toast({
        title: 'Sucesso',
        description: 'Transação rejeitada',
      });

      // Clear cache and reload (force refresh)
      portfolioCache.dividends.remove(portfolioId);
      portfolioCache.suggestions.remove(portfolioId);
      await loadSuggestions(true);
    } catch (error) {
      console.error('Erro ao rejeitar transação:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível rejeitar a transação',
        variant: 'destructive'
      });
    }
  };

  if (!trackingStarted) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Dividendos
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateSuggestions}
              disabled={generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Sugestões
                </>
              )}
            </Button>
            {suggestions.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={confirmAll}
                disabled={confirmingAll}
              >
                {confirmingAll ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Todas
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma sugestão de dividendo pendente</p>
            <p className="text-sm mt-2">Clique em &quot;Gerar Sugestões&quot; para buscar dividendos disponíveis</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {suggestion.ticker}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(suggestion.date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    R$ {suggestion.amount.toFixed(2)}
                  </p>
                  {/* Show calculation: quantity x dividend per share */}
                  {suggestion.quantity && suggestion.price && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.quantity.toFixed(0)} ações × R$ {suggestion.price.toFixed(4)}/ação = R$ {suggestion.amount.toFixed(2)}
                    </p>
                  )}
                  {suggestion.notes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmTransaction(suggestion.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectTransaction(suggestion.id)}
                  >
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

