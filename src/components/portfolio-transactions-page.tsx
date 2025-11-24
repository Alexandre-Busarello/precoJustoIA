'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PortfolioTransactionList } from '@/components/portfolio-transaction-list';
import { PortfolioSmartInput } from '@/components/portfolio-smart-input';

interface PortfolioTransactionsPageProps {
  portfolioId: string;
}

// Fetch function for portfolio details
const fetchPortfolio = async (portfolioId: string) => {
  const response = await fetch(`/api/portfolio/${portfolioId}`);
  if (!response.ok) {
    throw new Error('Erro ao carregar carteira');
  }
  const data = await response.json();
  return data.portfolio;
};

// Fetch function for metrics
const fetchMetrics = async (portfolioId: string) => {
  const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
  if (!response.ok) {
    throw new Error('Erro ao carregar métricas');
  }
  const data = await response.json();
  return data.metrics;
};

export function PortfolioTransactionsPage({ portfolioId }: PortfolioTransactionsPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: portfolio,
    isLoading: portfolioLoading,
  } = useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => fetchPortfolio(portfolioId),
    enabled: !!portfolioId,
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
  } = useQuery({
    queryKey: ['portfolio-metrics', portfolioId],
    queryFn: () => fetchMetrics(portfolioId),
    enabled: !!portfolioId,
  });

  const handleTransactionsApplied = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio-transactions', portfolioId] });
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/carteira/${portfolioId}`)}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Transações
          </h1>
        </div>

        {/* Smart Input Zone - Expanded by default on transactions page */}
        <div className="mb-6">
          <PortfolioSmartInput
            portfolioId={portfolioId}
            currentCashBalance={metrics?.cashBalance || 0}
            onTransactionsApplied={handleTransactionsApplied}
            defaultCollapsed={false} // Start expanded on transactions page
          />
        </div>

        {/* Transaction List */}
        <Card>
          <CardContent className="p-6">
            <PortfolioTransactionList
              portfolioId={portfolioId}
              onTransactionUpdate={() => {
                handleTransactionsApplied();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

