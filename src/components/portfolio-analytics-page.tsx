'use client';

import { PortfolioAnalytics } from '@/components/portfolio-analytics';
import {
  PortfolioNotFound,
  PortfolioPageShell,
  PortfolioPageSkeleton,
  usePortfolioSummary,
} from '@/components/portfolio-page-shell';

interface PortfolioAnalyticsPageProps {
  portfolioId: string;
}

export function PortfolioAnalyticsPage({ portfolioId }: PortfolioAnalyticsPageProps) {
  const { data: portfolio, isLoading, error } = usePortfolioSummary(portfolioId);

  if (isLoading) return <PortfolioPageSkeleton />;
  if (error || !portfolio) return <PortfolioNotFound />;

  return (
    <PortfolioPageShell
      portfolioId={portfolioId}
      portfolioName={portfolio.name}
      title="Análise"
      crumb="Análise"
      description="Evolução do patrimônio, comparação com CDI e Ibovespa, quedas e retornos mensais."
    >
      <PortfolioAnalytics portfolioId={portfolioId} />
    </PortfolioPageShell>
  );
}
