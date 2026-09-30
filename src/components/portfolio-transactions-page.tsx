'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PortfolioTransactionList } from '@/components/portfolio-transaction-list';
import { PortfolioSmartInput } from '@/components/portfolio-smart-input';
import {
  PortfolioNotFound,
  PortfolioPageShell,
  PortfolioPageSkeleton,
  usePortfolioSummary,
} from '@/components/portfolio-page-shell';

interface PortfolioTransactionsPageProps {
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

export function PortfolioTransactionsPage({ portfolioId }: PortfolioTransactionsPageProps) {
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading, error } = usePortfolioSummary(portfolioId);

  const { data: metrics } = useQuery({
    queryKey: ['portfolio-metrics', portfolioId],
    queryFn: () => fetchMetrics(portfolioId),
    enabled: !!portfolioId,
  });

  const handleTransactionsApplied = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
  };

  if (isLoading) return <PortfolioPageSkeleton />;
  if (error || !portfolio) return <PortfolioNotFound />;

  return (
    <PortfolioPageShell
      portfolioId={portfolioId}
      portfolioName={portfolio.name}
      title="Transações"
      crumb="Transações"
      description="Aportes, compras, vendas, dividendos e saques registrados na carteira."
    >
      <PortfolioSmartInput
        portfolioId={portfolioId}
        currentCashBalance={metrics?.cashBalance || 0}
        onTransactionsApplied={handleTransactionsApplied}
        defaultCollapsed={false}
      />

      <PortfolioTransactionList portfolioId={portfolioId} onTransactionUpdate={handleTransactionsApplied} />
    </PortfolioPageShell>
  );
}
