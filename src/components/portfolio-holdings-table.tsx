"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, TrendingUp, TrendingDown, Scale, RefreshCw } from "lucide-react";
import { portfolioCache } from "@/lib/portfolio-cache";

interface Holding {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalInvested: number;
  return: number;
  returnPercentage: number;
  totalDividends: number;
  returnWithDividends: number;
  returnWithDividendsPercentage: number;
  targetAllocation: number;
  actualAllocation: number;
  allocationDiff: number;
  needsRebalancing: boolean;
}

interface PortfolioHoldingsTableProps {
  portfolioId: string;
  onNavigateToTransactions?: () => void;
}

export function PortfolioHoldingsTable({
  portfolioId,
  onNavigateToTransactions,
}: PortfolioHoldingsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for loading holdings
  const fetchHoldings = async () => {
    const response = await fetch(`/api/portfolio/${portfolioId}/holdings`);
    
    if (!response.ok) {
      throw new Error("Erro ao carregar posições");
    }

    const data = await response.json();
    return data;
  };

  const {
    data: holdingsData,
    isLoading: loadingHoldings,
    error: holdingsError
  } = useQuery({
    queryKey: ['portfolio-holdings', portfolioId],
    queryFn: fetchHoldings,
  });

  const holdings = holdingsData?.holdings || [];

  // Query for checking pending contributions
  const fetchPendingContributions = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions?status=PENDING`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao verificar transações pendentes');
    }

    const data = await response.json();
    const contributionTx = (data.transactions || []).filter(
      (tx: any) => 
        tx.type !== 'SELL_REBALANCE' && 
        tx.type !== 'BUY_REBALANCE' &&
        (tx.type === 'MONTHLY_CONTRIBUTION' || 
         tx.type === 'CASH_CREDIT' || 
         tx.type === 'BUY' || 
         tx.type === 'DIVIDEND')
    );
    
    return {
      hasPending: contributionTx.length > 0,
      count: contributionTx.length
    };
  };

  const {
    data: pendingContributionsData,
  } = useQuery({
    queryKey: ['portfolio-pending-contributions', portfolioId],
    queryFn: fetchPendingContributions,
  });

  const hasPendingContributions = pendingContributionsData?.hasPending || false;
  const pendingContributionsCount = pendingContributionsData?.count || 0;

  // Query for checking rebalancing needed
  const fetchRebalancingCheck = async () => {
    const response = await fetch(
      `/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing/check`
    );
    
    if (!response.ok) {
      throw new Error('Erro ao verificar necessidade de rebalanceamento');
    }

    const data = await response.json();
    return {
      shouldShow: data.shouldShow || false,
      maxDeviation: data.maxDeviation || 0
    };
  };

  const {
    data: rebalancingCheckData,
  } = useQuery({
    queryKey: ['portfolio-rebalancing-check', portfolioId],
    queryFn: fetchRebalancingCheck,
  });

  const shouldShowRebalancing = rebalancingCheckData?.shouldShow || false;
  const maxDeviation = rebalancingCheckData?.maxDeviation || 0;

  // Re-check when transactions change
  useEffect(() => {
    const handleTransactionUpdate = () => {
      // Small delay to ensure backend has processed the transaction
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings', portfolioId] });
      }, 500);
    };

    // Listen for transaction updates
    window.addEventListener('transaction-updated', handleTransactionUpdate);
    window.addEventListener('reload-suggestions', handleTransactionUpdate);
    window.addEventListener('transaction-cash-flow-changed', handleTransactionUpdate);

    return () => {
      window.removeEventListener('transaction-updated', handleTransactionUpdate);
      window.removeEventListener('reload-suggestions', handleTransactionUpdate);
      window.removeEventListener('transaction-cash-flow-changed', handleTransactionUpdate);
    };
  }, [portfolioId, queryClient]);

  // Mutation for generating rebalancing suggestions
  const generateRebalancingMutation = useMutation({
    mutationFn: async () => {
      // Delete existing rebalancing suggestions first
      const pendingResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const rebalancingTx = (pendingData.transactions || []).filter(
          (tx: any) => tx.type === 'SELL_REBALANCE' || tx.type === 'BUY_REBALANCE'
        );
        
        // Delete each rebalancing transaction
        await Promise.all(
          rebalancingTx.map((tx: any) =>
            fetch(`/api/portfolio/${portfolioId}/transactions/${tx.id}`, {
              method: 'DELETE'
            }).catch(() => {})
          )
        );
      }

      // Generate new rebalancing suggestions
      const generateResponse = await fetch(
        `/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing`,
        { method: 'POST' }
      );

      if (!generateResponse.ok) {
        throw new Error('Erro ao gerar sugestões de rebalanceamento');
      }

      return generateResponse.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sugestões geradas',
        description: 'Sugestões de rebalanceamento geradas com sucesso'
      });

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-holdings', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-pending-contributions', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-check', portfolioId] });
      portfolioCache.invalidateAll(portfolioId);

      // Navigate to transactions tab
      if (onNavigateToTransactions) {
        // Small delay to ensure transactions are created
        setTimeout(() => {
          onNavigateToTransactions();
        }, 300);
      } else {
        // Fallback: navigate using URL
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'transactions');
        window.history.pushState({}, '', url.toString());
        // Trigger page reload or tab change
        window.location.reload();
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao gerar sugestões:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar sugestões de rebalanceamento',
        variant: 'destructive'
      });
    }
  });

  const handleGenerateRebalancing = () => {
    // Don't allow if there are pending contributions
    if (hasPendingContributions) {
      toast({
        title: 'Atenção',
        description: `Complete primeiro as ${pendingContributionsCount} transação(ões) pendente(s) em "Aportes e Compras"`,
        variant: 'destructive'
      });
      return;
    }

    generateRebalancingMutation.mutate();
  };

  // Show error toast if holdings query fails
  useEffect(() => {
    if (holdingsError) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as posições",
        variant: "destructive",
      });
    }
  }, [holdingsError, toast]);

  const loading = loadingHoldings;
  const generatingRebalancing = generateRebalancingMutation.isPending;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const isPositive = (value: number) => value >= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>Nenhuma posição encontrada</p>
            <p className="text-sm mt-1">
              Confirme suas primeiras transações para ver suas posições
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use the same logic as rebalancing suggestions section
  const hasRebalancingNeeded = shouldShowRebalancing;

  // Função para determinar a prioridade de ordenação por status
  const getStatusPriority = (holding: Holding) => {
    if (!holding.needsRebalancing) return 2; // OK - prioridade média
    if (holding.allocationDiff > 0) return 1; // Sobrepeso - prioridade alta
    return 3; // Subpeso - prioridade baixa
  };

  // Ordenar holdings por status: Sobrepeso (1) -> OK (2) -> Subpeso (3)
  // Em caso de empate, ordenar por valor atual (maior primeiro)
  const sortedHoldings = [...holdings].sort((a, b) => {
    const priorityA = getStatusPriority(a);
    const priorityB = getStatusPriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Se mesmo status, ordenar por valor atual (maior primeiro)
    return b.currentValue - a.currentValue;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg sm:text-xl">Posições Atuais</CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            {hasRebalancingNeeded && (
              <Badge variant="outline" className="gap-1 text-xs flex-shrink-0">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                <span className="hidden sm:inline">
                  Rebalanceamento sugerido
                </span>
                <span className="sm:hidden">Rebalancear</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Preço Atual</TableHead>
                <TableHead className="text-right">Valor Atual</TableHead>
                <TableHead className="text-right">Retorno</TableHead>
                <TableHead className="text-right">
                  Retorno c/ Dividendos
                </TableHead>
                <TableHead className="text-right">Alocação</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHoldings.map((holding) => (
                <TableRow key={holding.ticker}>
                  <TableCell className="font-medium">
                    {holding.ticker}
                  </TableCell>

                  <TableCell className="text-right">
                    {holding.quantity.toFixed(0)}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(holding.averagePrice)}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(holding.currentPrice)}
                  </TableCell>

                  <TableCell className="text-right font-medium">
                    {formatCurrency(holding.currentValue)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div
                      className={`flex flex-col items-end ${
                        isPositive(holding.return)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isPositive(holding.return) ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          {formatPercent(holding.returnPercentage)}
                        </span>
                      </div>
                      <span className="text-xs">
                        {formatCurrency(holding.return)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div
                      className={`flex flex-col items-end ${
                        isPositive(holding.returnWithDividends)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isPositive(holding.returnWithDividends) ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          {formatPercent(holding.returnWithDividendsPercentage)}
                        </span>
                      </div>
                      <span className="text-xs">
                        {formatCurrency(holding.returnWithDividends)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPercent(holding.actualAllocation)}
                        </span>
                        {holding.needsRebalancing && (
                          <AlertTriangle className="h-3 w-3 text-orange-600" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Meta: {formatPercent(holding.targetAllocation)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    {holding.needsRebalancing ? (
                      <Badge variant="outline" className="text-xs">
                        {holding.allocationDiff > 0 ? "Sobrepeso" : "Subpeso"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {hasRebalancingNeeded && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {hasPendingContributions ? (
                  <>
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      ⚠️ Atenção
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Você tem <strong>{pendingContributionsCount} transação(ões) pendente(s)</strong> na seção &quot;Aportes e Compras&quot;. 
                      Complete todas as transações de aportes e compras antes de gerar sugestões de rebalanceamento.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                      Rebalanceamento Recomendado
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      {maxDeviation > 0 && (
                        <>Desvio máximo detectado: <strong>{(maxDeviation * 100).toFixed(1)}%</strong>. </>
                      )}
                      Alguns ativos estão fora da alocação alvo. Considere
                      rebalancear sua carteira.
                    </p>
                  </>
                )}
              </div>
              <Button
                onClick={handleGenerateRebalancing}
                disabled={generatingRebalancing || hasPendingContributions}
                size="sm"
                variant="default"
                className="w-full sm:w-auto flex-shrink-0 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={hasPendingContributions ? `Complete primeiro as ${pendingContributionsCount} transação(ões) pendente(s) em "Aportes e Compras"` : ''}
              >
                {generatingRebalancing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4 mr-2" />
                    Gerar Sugestões
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
