'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PortfolioSmartInput } from '@/components/portfolio-smart-input';
import { PortfolioMetricsCard } from '@/components/portfolio-metrics-card';
import { PortfolioHoldingsTable } from '@/components/portfolio-holdings-table';
import { PortfolioClosedPositionsTable } from '@/components/portfolio-closed-positions-table';
import {
  PortfolioNotFound,
  PortfolioPageShell,
  PortfolioPageSkeleton,
  usePortfolioSummary,
} from '@/components/portfolio-page-shell';
import { usePortfolioSuggestionsAvailable } from '@/hooks/use-portfolio-suggestions-available';
import { useToast } from '@/hooks/use-toast';

interface PortfolioDetailPageProps {
  portfolioId: string;
}

const fetchMetrics = async (portfolioId: string) => {
  const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
  if (!response.ok) {
    throw new Error('Erro ao carregar métricas');
  }
  const data = await response.json();
  return data.metrics;
};

/** Faixa neutra de aviso com uma ação (sem cor de fundo chamativa). */
function Notice({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function PortfolioDetailPage({ portfolioId }: PortfolioDetailPageProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: portfolio, isLoading, error } = usePortfolioSummary(portfolioId);

  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['portfolio-metrics', portfolioId],
    queryFn: () => fetchMetrics(portfolioId),
    enabled: !!portfolioId,
  });

  const { hasSuggestions, isLoading: suggestionsLoading } = usePortfolioSuggestionsAvailable(
    portfolioId,
    portfolio?.trackingStarted || false,
    metrics?.cashBalance
  );

  const startTrackingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/start-tracking`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao iniciar acompanhamento');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Acompanhamento iniciado',
        description: 'As sugestões de aporte e ajuste passam a ser geradas a partir de agora.',
      });
      queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao iniciar acompanhamento',
        variant: 'destructive',
      });
    },
  });

  const handleTransactionsApplied = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
  };

  if (isLoading) return <PortfolioPageSkeleton />;
  if (error || !portfolio) return <PortfolioNotFound />;

  return (
    <PortfolioPageShell
      portfolioId={portfolioId}
      portfolioName={portfolio.name}
      title={portfolio.name}
      description={portfolio.description || undefined}
    >
      <div className="space-y-4">
        <PortfolioMetricsCard
          metrics={metrics}
          loading={metricsLoading}
          error={metricsError}
          onRetry={() => void refetchMetrics()}
          startDate={portfolio.startDate}
        />

        {!portfolio.trackingStarted && (
          <Notice
            title="Acompanhamento não iniciado"
            description="Inicie o acompanhamento para receber sugestões de aporte, ajuste de alocação e dividendos."
            action={
              <Button onClick={() => startTrackingMutation.mutate()} disabled={startTrackingMutation.isPending}>
                {startTrackingMutation.isPending ? 'Iniciando' : 'Iniciar acompanhamento'}
              </Button>
            }
          />
        )}

        {portfolio.trackingStarted && !suggestionsLoading && hasSuggestions && (
          <Notice
            title="Há sugestões para a carteira"
            description="Aportes, ajustes para a sua alocação-alvo ou dividendos aguardando registro."
            action={
              <Button asChild variant="outline">
                <Link href={`/carteira/${portfolioId}/sugestoes`}>Ver sugestões</Link>
              </Button>
            }
          />
        )}

        <PortfolioSmartInput
          portfolioId={portfolioId}
          currentCashBalance={metrics?.cashBalance || 0}
          onTransactionsApplied={handleTransactionsApplied}
          defaultCollapsed
        />
      </div>

      <PortfolioHoldingsTable portfolioId={portfolioId} />

      {portfolio.trackingStarted && <PortfolioClosedPositionsTable portfolioId={portfolioId} />}
    </PortfolioPageShell>
  );
}
