'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stat } from '@/components/ui/stat';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatBRL, formatNumber } from '@/lib/format';
import { PortfolioTransactionFormSuggested } from './portfolio-transaction-form-suggested';
import { PortfolioRebalancingCombinedForm } from './portfolio-rebalancing-combined-form';
import {
  PortfolioNotFound,
  PortfolioPageShell,
  PortfolioPageSkeleton,
  usePortfolioSummary,
} from '@/components/portfolio-page-shell';

/** Quantos dividendos aparecem antes de "Mostrar mais". */
const DIVIDENDS_PREVIEW = 10;

interface PortfolioSuggestionsPageProps {
  portfolioId: string;
}

interface Suggestion {
  date: string;
  type: string;
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
  reason: string;
  cashBalanceBefore: number;
  cashBalanceAfter: number;
  /** Legado: preço justo técnico das sugestões antigas. */
  fairPrice?: number;
  /** Desconto mediano positivo vs. valor estimado (motor do "Onde aportar"). */
  isAttractivePrice?: boolean;
  // For combined rebalancing
  sellTransaction?: Suggestion | null;
  sellTransactions?: Suggestion[]; // Support multiple sell transactions
  buyTransactions?: Suggestion[];
  totalSold?: number;
  totalBought?: number;
  netCashChange?: number;
  // ID da transação se for uma transação PENDING existente (para permitir rejeição)
  transactionId?: string;
}

interface SuggestionsResponse {
  type: string;
  suggestions: Suggestion[];
  count: number;
}

export function PortfolioSuggestionsPage({ portfolioId }: PortfolioSuggestionsPageProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showAllDividends, setShowAllDividends] = useState(false);
  const previousCashBalanceRef = useRef<number | undefined>(undefined);

  const { data: portfolioData, isLoading: portfolioLoading, error: portfolioError } = usePortfolioSummary(portfolioId);

  // Fetch metrics to monitor cash balance changes
  const { data: metricsData } = useQuery({
    queryKey: ['portfolio-metrics', portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
      if (!response.ok) throw new Error('Erro ao carregar métricas');
      const data = await response.json();
      return data.metrics;
    },
  });

  // Fetch contribution suggestions
  const {
    data: contributionData,
    isLoading: loadingContributions,
    refetch: refetchContributions,
  } = useQuery<SuggestionsResponse>({
    queryKey: ['portfolio-suggestions', portfolioId, 'contribution'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=contribution`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  // Fetch rebalancing suggestions
  const {
    data: rebalancingData,
    isLoading: loadingRebalancing,
    refetch: refetchRebalancing,
  } = useQuery<SuggestionsResponse & { message?: string }>({
    queryKey: ['portfolio-suggestions', portfolioId, 'rebalancing'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=rebalancing`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  // Fetch dividend suggestions
  const {
    data: dividendData,
    isLoading: loadingDividends,
    refetch: refetchDividends,
  } = useQuery<SuggestionsResponse>({
    queryKey: ['portfolio-suggestions', portfolioId, 'dividends'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=dividends`);
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      return response.json();
    },
  });

  const handleRefresh = () => {
    refetchContributions();
    refetchRebalancing();
    refetchDividends();
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // For MONTHLY_CONTRIBUTION and DIVIDEND with transactionId, don't open modal - use inline buttons instead
    if ((suggestion.type === 'MONTHLY_CONTRIBUTION' || suggestion.type === 'DIVIDEND') && suggestion.transactionId) {
      return; // Don't open modal, use inline buttons
    }
    
    // Check if this is a combined rebalancing suggestion
    const isCombined = suggestion.type === 'REBALANCING_COMBINED' || 
                       (suggestion.sellTransaction !== undefined && suggestion.buyTransactions !== undefined);
    
    if (isCombined) {
      // Use combined form for rebalancing
      setSelectedSuggestion(suggestion);
    } else {
      // Use regular form for other suggestions
      setSelectedSuggestion(suggestion);
    }
  };

  // Mutation to reject a transaction
  const rejectMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejeitado pelo usuário' }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao rejeitar transação');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sugestão rejeitada',
        description: 'Ela não será sugerida de novo neste mês.',
      });
      handleRefresh();
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao rejeitar transação',
        variant: 'destructive',
      });
    },
  });

  // Mutation to confirm a transaction
  const confirmMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao confirmar transação');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Transação registrada',
        description: 'A sugestão foi registrada na carteira.',
      });
      handleRefresh();
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao confirmar transação',
        variant: 'destructive',
      });
    },
  });

  // Descarta uma compra registrada pelo "Onde aportar" (transação PENDENTE criada pelo usuário).
  const discardMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/${transactionId}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Erro ao descartar transação');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Transação descartada' });
      handleRefresh();
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message || 'Erro ao descartar transação', variant: 'destructive' });
    },
  });

  const handleDiscard = (e: MouseEvent, suggestion: Suggestion) => {
    e.stopPropagation();
    if (suggestion.transactionId) discardMutation.mutate(suggestion.transactionId);
  };

  const handleReject = (e: MouseEvent, suggestion: Suggestion) => {
    e.stopPropagation();
    if (suggestion.transactionId) {
      rejectMutation.mutate(suggestion.transactionId);
    }
  };

  const handleConfirm = (e: MouseEvent, suggestion: Suggestion) => {
    e.stopPropagation();
    if (suggestion.transactionId) {
      confirmMutation.mutate(suggestion.transactionId);
    } else {
      // If no transactionId, open modal to create new transaction
      setSelectedSuggestion(suggestion);
    }
  };

  const handleTransactionConfirmed = () => {
    setSelectedSuggestion(null);
    handleRefresh();
    // Invalidate portfolio data to refresh cash balance
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    window.dispatchEvent(
      new CustomEvent('portfolio-config-updated', {
        detail: { action: 'transaction' },
      })
    );
  };

  // Monitor cash balance changes and auto-refresh suggestions
  useEffect(() => {
    const currentCashBalance = metricsData?.cashBalance;
    const previousCashBalance = previousCashBalanceRef.current;

    // If cash balance changed, refresh contribution suggestions
    if (
      previousCashBalance !== undefined &&
      currentCashBalance !== undefined &&
      currentCashBalance !== previousCashBalance
    ) {
      // Refetch contribution suggestions when cash changes
      refetchContributions();
      
      // Also refetch rebalancing and dividends in case they're affected
      refetchRebalancing();
      refetchDividends();
    }

    // Update ref
    previousCashBalanceRef.current = currentCashBalance;
  }, [metricsData?.cashBalance, refetchContributions, refetchRebalancing, refetchDividends]);

  // Listen for transaction events to auto-refresh
  useEffect(() => {
    const handleTransactionEvent = () => {
      // Small delay to ensure backend has processed the transaction
      setTimeout(() => {
        refetchContributions();
        refetchRebalancing();
        refetchDividends();
        queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
      }, 500);
    };

    // Listen for various transaction-related events
    window.addEventListener('portfolio-transaction-updated', handleTransactionEvent);
    window.addEventListener('portfolio-config-updated', handleTransactionEvent);
    window.addEventListener('transaction-cash-flow-changed', handleTransactionEvent);

    return () => {
      window.removeEventListener('portfolio-transaction-updated', handleTransactionEvent);
      window.removeEventListener('portfolio-config-updated', handleTransactionEvent);
      window.removeEventListener('transaction-cash-flow-changed', handleTransactionEvent);
    };
  }, [refetchContributions, refetchRebalancing, refetchDividends, queryClient, portfolioId]);

  const contributionSuggestions = contributionData?.suggestions || [];
  const rebalancingSuggestions = rebalancingData?.suggestions || [];
  const dividendSuggestions = dividendData?.suggestions || [];
  const totalSuggestions = contributionSuggestions.length + rebalancingSuggestions.length + dividendSuggestions.length;
  const cashBalance = metricsData?.cashBalance || portfolioData?.metrics?.cashBalance || 0;

  const isLoading = loadingContributions || loadingRebalancing || loadingDividends;

  if (portfolioLoading) return <PortfolioPageSkeleton />;
  if (portfolioError || !portfolioData) return <PortfolioNotFound />;

  const isCombinedSuggestion = (suggestion: Suggestion) =>
    suggestion.type === 'REBALANCING_COMBINED' ||
    (suggestion.sellTransaction !== undefined && suggestion.buyTransactions !== undefined);

  const inlineActions = (suggestion: Suggestion) => (
    <div className="flex gap-2">
      <Button size="sm" onClick={(e) => handleConfirm(e, suggestion)} disabled={confirmMutation.isPending}>
        Registrar
      </Button>
      <Button size="sm" variant="outline" onClick={(e) => handleReject(e, suggestion)} disabled={rejectMutation.isPending}>
        Rejeitar
      </Button>
    </div>
  );

  const pendingActions = (suggestion: Suggestion) => (
    <div className="flex gap-2">
      <Button size="sm" onClick={(e) => handleConfirm(e, suggestion)} disabled={confirmMutation.isPending}>
        Confirmar
      </Button>
      <Button size="sm" variant="outline" onClick={(e) => handleDiscard(e, suggestion)} disabled={discardMutation.isPending}>
        Descartar
      </Button>
    </div>
  );

  const reviewButton = (suggestion: Suggestion) => (
    <Button size="sm" variant="outline" onClick={() => handleSuggestionClick(suggestion)}>
      Revisar e registrar
    </Button>
  );

  return (
    <PortfolioPageShell
      portfolioId={portfolioId}
      portfolioName={portfolioData.name}
      title="Sugestões"
      crumb="Sugestões"
      description="Aportes, ajustes para a sua alocação-alvo e dividendos a registrar."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/onde-aportar?carteira=${portfolioId}`}>Simular um aporte</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={isLoading ? 'animate-spin' : undefined} strokeWidth={1.75} aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      }
    >
      <section aria-label="Resumo das sugestões" className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
          <Stat label="Caixa disponível" value={formatBRL(cashBalance)} />
          <Stat label="Aportes e compras" value={isLoading ? '—' : formatNumber(contributionSuggestions.length)} />
          <Stat label="Ajustes de alocação" value={isLoading ? '—' : formatNumber(rebalancingSuggestions.length)} />
          <Stat label="Dividendos" value={isLoading ? '—' : formatNumber(dividendSuggestions.length)} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          As compras seguem a alocação-alvo e o aporte mensal que você definiu, priorizando os ativos mais distantes do alvo, com
          desconto em relação ao valor estimado e boa nota de qualidade (o motivo aparece em cada linha).{' '}
          <Link href={`/onde-aportar?carteira=${portfolioId}`} className="text-brand underline-offset-4 hover:underline">
            Ver a distribuição completa
          </Link>
          . Não são recomendação de investimento.
        </p>
      </section>

      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          <span className="sr-only">Carregando sugestões</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isLoading && totalSuggestions === 0 && (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma sugestão no momento</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A carteira está alinhada à sua alocação-alvo e não há aportes ou dividendos pendentes.
          </p>
          {rebalancingData?.message && <p className="mt-2 text-xs text-muted-foreground">{rebalancingData.message}</p>}
        </div>
      )}

      {!isLoading && contributionSuggestions.length > 0 && (
        <section aria-labelledby="contributions-title" className="space-y-3">
          <SectionHeader id="contributions-title" title={`Aportes e compras (${contributionSuggestions.length})`} />
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {contributionSuggestions.map((suggestion, index) => {
              const isMonthlyContribution = suggestion.type === 'MONTHLY_CONTRIBUTION';
              const showActionButtons = isMonthlyContribution && !!suggestion.transactionId;
              const fromOndeAportar = !isMonthlyContribution && !!suggestion.transactionId;
              return (
                <SuggestionItem
                  key={`contribution-${index}`}
                  label={
                    isMonthlyContribution ? (
                      <Badge variant="brand">Aporte mensal</Badge>
                    ) : fromOndeAportar && suggestion.type === 'CASH_CREDIT' ? (
                      <Badge variant="brand">Aporte registrado</Badge>
                    ) : (
                      <AllocationAdjustment action="comprar" quantity={suggestion.quantity} ticker={suggestion.ticker} />
                    )
                  }
                  extraBadge={
                    fromOndeAportar ? (
                      <Badge variant="neutral">Pendente do Onde aportar</Badge>
                    ) : suggestion.isAttractivePrice ? (
                      <Badge variant="neutral">Abaixo do valor estimado</Badge>
                    ) : undefined
                  }
                  reason={suggestion.reason}
                  details={
                    <>
                      {suggestion.quantity && suggestion.price ? (
                        <span>
                          {formatNumber(suggestion.quantity)} × {formatBRL(suggestion.price)}
                        </span>
                      ) : null}
                      {suggestion.fairPrice ? <span>Preço justo (estimativa): {formatBRL(suggestion.fairPrice)}</span> : null}
                    </>
                  }
                  amount={suggestion.amount}
                  cashAfter={suggestion.cashBalanceAfter}
                  action={showActionButtons ? inlineActions(suggestion) : fromOndeAportar ? pendingActions(suggestion) : reviewButton(suggestion)}
                />
              );
            })}
          </ul>
        </section>
      )}

      {!isLoading && (rebalancingSuggestions.length > 0 || (totalSuggestions > 0 && rebalancingData?.message)) && (
        <section aria-labelledby="rebalancing-title" className="space-y-3">
          <SectionHeader
            id="rebalancing-title"
            title={`Ajustes para sua alocação-alvo (${rebalancingSuggestions.length})`}
            description={rebalancingData?.message}
          />
          {rebalancingSuggestions.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {rebalancingSuggestions.map((suggestion, index) => {
                if (!isCombinedSuggestion(suggestion)) {
                  const isBuy = suggestion.type.includes('BUY');
                  return (
                    <SuggestionItem
                      key={`rebalancing-${index}`}
                      label={
                        <AllocationAdjustment
                          action={isBuy ? 'comprar' : 'vender'}
                          quantity={suggestion.quantity}
                          ticker={suggestion.ticker}
                        />
                      }
                      reason={suggestion.reason}
                      details={
                        suggestion.quantity && suggestion.price ? (
                          <span>
                            {formatNumber(suggestion.quantity)} × {formatBRL(suggestion.price)}
                          </span>
                        ) : null
                      }
                      amount={Math.abs(suggestion.amount)}
                      cashAfter={suggestion.cashBalanceAfter}
                      action={reviewButton(suggestion)}
                    />
                  );
                }

                const sells =
                  suggestion.sellTransactions && suggestion.sellTransactions.length > 0
                    ? suggestion.sellTransactions
                    : suggestion.sellTransaction
                      ? [suggestion.sellTransaction]
                      : [];
                const buys = suggestion.buyTransactions ?? [];

                return (
                  <li key={`rebalancing-combined-${index}`} className="space-y-3 p-4">
                    <div>
                      <Badge variant="neutral">Ajuste para sua alocação-alvo</Badge>
                      <p className="mt-2 text-sm text-muted-foreground break-words">
                        {suggestion.reason || 'Vendas e compras combinadas para aproximar a carteira da alocação-alvo.'}
                      </p>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {sells.map((sell, sellIndex) => (
                        <AdjustmentLine key={`sell-${sellIndex}`} action="vender" line={sell} />
                      ))}
                      {buys.map((buy, buyIndex) => (
                        <AdjustmentLine key={`buy-${buyIndex}`} action="comprar" line={buy} />
                      ))}
                    </ul>
                    <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
                      <dl className="grid grid-cols-3 gap-4 text-xs">
                        {suggestion.totalSold ? (
                          <div>
                            <dt className="text-muted-foreground">Total de vendas</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatBRL(suggestion.totalSold)}</dd>
                          </div>
                        ) : null}
                        {suggestion.totalBought ? (
                          <div>
                            <dt className="text-muted-foreground">Total de compras</dt>
                            <dd className="text-sm font-medium tabular-nums text-foreground">{formatBRL(suggestion.totalBought)}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="text-muted-foreground">Caixa final</dt>
                          <dd className="text-sm font-medium tabular-nums text-foreground">{formatBRL(suggestion.cashBalanceAfter)}</dd>
                        </div>
                      </dl>
                      {reviewButton(suggestion)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {!isLoading && dividendSuggestions.length > 0 && (
        <section aria-labelledby="dividends-title" className="space-y-3">
          <SectionHeader id="dividends-title" title={`Dividendos (${dividendSuggestions.length})`} />
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {(showAllDividends ? dividendSuggestions : dividendSuggestions.slice(0, DIVIDENDS_PREVIEW)).map((suggestion, index) => {
              const showActionButtons = suggestion.type === 'DIVIDEND' && !!suggestion.transactionId;
              return (
                <SuggestionItem
                  key={`dividend-${index}`}
                  label={
                    <span className="flex items-center gap-2">
                      <Badge variant="neutral">Dividendo</Badge>
                      {suggestion.ticker && <span className="text-sm font-medium text-foreground">{suggestion.ticker}</span>}
                    </span>
                  }
                  reason={suggestion.reason}
                  amount={suggestion.amount}
                  cashAfter={suggestion.cashBalanceAfter}
                  action={showActionButtons ? inlineActions(suggestion) : reviewButton(suggestion)}
                />
              );
            })}
          </ul>
          {!showAllDividends && dividendSuggestions.length > DIVIDENDS_PREVIEW && (
            <Button variant="outline" className="w-full" onClick={() => setShowAllDividends(true)}>
              Mostrar mais {dividendSuggestions.length - DIVIDENDS_PREVIEW} dividendos
            </Button>
          )}
        </section>
      )}

      {selectedSuggestion &&
        (isCombinedSuggestion(selectedSuggestion) ? (
          <PortfolioRebalancingCombinedForm
            portfolioId={portfolioId}
            suggestion={{ ...selectedSuggestion, sellTransaction: selectedSuggestion.sellTransaction ?? null }}
            open={!!selectedSuggestion}
            onOpenChange={(open) => {
              if (!open) setSelectedSuggestion(null);
            }}
            onSuccess={handleTransactionConfirmed}
          />
        ) : (
          <PortfolioTransactionFormSuggested
            portfolioId={portfolioId}
            suggestion={selectedSuggestion}
            open={!!selectedSuggestion}
            onOpenChange={(open) => {
              if (!open) setSelectedSuggestion(null);
            }}
            onSuccess={handleTransactionConfirmed}
          />
        ))}
    </PortfolioPageShell>
  );
}

/** "Ajuste para sua alocação-alvo: comprar 10 PETR4" — o alvo é do próprio usuário. */
function AllocationAdjustment({
  action,
  quantity,
  ticker,
}: {
  action: 'comprar' | 'vender';
  quantity?: number;
  ticker?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="neutral">Ajuste para sua alocação-alvo</Badge>
      <span className="text-sm text-foreground">
        {action}
        {quantity ? ` ${formatNumber(quantity)}` : ''}
        {ticker ? <span className="font-medium"> {ticker}</span> : null}
      </span>
    </span>
  );
}

interface AdjustmentLineData {
  ticker?: string;
  amount: number;
  price?: number;
  quantity?: number;
}

function AdjustmentLine({ action, line }: { action: 'comprar' | 'vender'; line: AdjustmentLineData }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-foreground">
        {action} {line.quantity ? formatNumber(line.quantity) : ''} <span className="font-medium">{line.ticker}</span>
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {line.quantity ? `${formatNumber(line.quantity)} × ${formatBRL(line.price ?? 0)} = ` : ''}
        {formatBRL(line.amount)}
      </span>
    </li>
  );
}

interface SuggestionItemProps {
  label: ReactNode;
  extraBadge?: ReactNode;
  reason?: string;
  details?: ReactNode;
  amount: number;
  cashAfter: number;
  action: ReactNode;
}

/** Linha de sugestão: rótulo, motivo, valor, caixa após e ação. */
function SuggestionItem({ label, extraBadge, reason, details, amount, cashAfter, action }: SuggestionItemProps) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {label}
          {extraBadge}
        </div>
        {reason && <p className="text-sm text-muted-foreground break-words">{reason}</p>}
        {details && (
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">{details}</p>
        )}
      </div>
      <div className="flex shrink-0 items-end justify-between gap-3 sm:flex-col">
        <div className="sm:text-right">
          <p className="text-base font-semibold tabular-nums text-foreground">{formatBRL(amount)}</p>
          <p className="text-xs tabular-nums text-muted-foreground">Caixa após {formatBRL(cashAfter)}</p>
        </div>
        {action}
      </div>
    </li>
  );
}
