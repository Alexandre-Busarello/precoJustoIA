'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PortfolioTransactionFormSuggested } from '@/components/portfolio-transaction-form-suggested';

interface SuggestedTransaction {
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  notes?: string;
  reason?: string;
}

interface PortfolioDividendSuggestionsProps {
  portfolioId: string;
  trackingStarted: boolean;
  onTransactionsConfirmed?: () => void;
}

export function PortfolioDividendSuggestions({
  portfolioId,
  trackingStarted,
  onTransactionsConfirmed,
}: PortfolioDividendSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedTransaction | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Query for dynamic dividend suggestions (not saved in DB)
  const fetchDynamicSuggestions = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/suggestions?type=dividends`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao carregar sugestões de dividendos');
    }

    const data = await response.json();
    return data.suggestions || [];
  };

  const {
    data: suggestions = [],
    isLoading: loading,
  } = useQuery({
    queryKey: ['portfolio-dividend-suggestions-dynamic', portfolioId],
    queryFn: fetchDynamicSuggestions,
    enabled: trackingStarted,
  });

  const handleSuggestionClick = (suggestion: SuggestedTransaction) => {
    setSelectedSuggestion(suggestion);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedSuggestion(null);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['portfolio-dividend-suggestions-dynamic', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
    if (onTransactionsConfirmed) {
      onTransactionsConfirmed();
    }
    toast({
      title: 'Dividendo registrado',
      description: 'O dividendo foi registrado com sucesso',
    });
  };

  if (!trackingStarted) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Carregando sugestões de dividendos...</p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't show card if no suggestions
  }

  return (
    <>
      <Card className="border-2 border-green-200 dark:border-green-900 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Sugestões de Dividendos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Dividendos detectados para seus ativos em custódia
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
            {suggestions.length} {suggestions.length === 1 ? 'dividendo' : 'dividendos'}
          </Badge>
        </CardHeader>
        <CardContent className="overflow-x-hidden">
          <div className="space-y-3">
            {suggestions
              .sort((a: SuggestedTransaction, b: SuggestedTransaction) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateB - dateA; // Most recent first
              })
              .map((suggestion: SuggestedTransaction, index: number) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors gap-3 overflow-hidden cursor-pointer"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base">
                        {suggestion.ticker || 'N/A'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(suggestion.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-green-600 dark:text-green-400">
                        R$ {suggestion.amount.toFixed(2)}
                      </span>
                      {suggestion.quantity && (
                        <span className="ml-2">
                          ({suggestion.quantity} {suggestion.quantity === 1 ? 'ação' : 'ações'})
                        </span>
                      )}
                    </div>
                    {suggestion.reason && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {suggestion.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 sm:flex-shrink-0 justify-end sm:justify-start">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSuggestionClick(suggestion);
                      }}
                      className="flex-shrink-0"
                    >
                      Registrar Dividendo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      {selectedSuggestion && (
        <PortfolioTransactionFormSuggested
          portfolioId={portfolioId}
          suggestion={selectedSuggestion}
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </>
  );
}

