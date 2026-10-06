'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PortfolioConfigForm } from '@/components/portfolio-config-form';
import { PortfolioAssetManager } from '@/components/portfolio-asset-manager';
import {
  PortfolioNotFound,
  PortfolioPageShell,
  PortfolioPageSkeleton,
  usePortfolioSummary,
} from '@/components/portfolio-page-shell';

interface PortfolioConfigPageProps {
  portfolioId: string;
}

/** `startDate` da API pode vir como ISO string ou Date. */
function toDateInput(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

export function PortfolioConfigPage({ portfolioId }: PortfolioConfigPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading, error } = usePortfolioSummary(portfolioId);

  if (isLoading) return <PortfolioPageSkeleton />;
  if (error || !portfolio) return <PortfolioNotFound />;

  return (
    <PortfolioPageShell
      portfolioId={portfolioId}
      portfolioName={portfolio.name}
      title="Configurações"
      crumb="Configurações"
      description="Dados da carteira, aporte mensal e alocação-alvo dos ativos."
    >
      <PortfolioConfigForm
        mode="edit"
        initialData={{
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description || '',
          startDate: toDateInput(portfolio.startDate),
          monthlyContribution: Number(portfolio.monthlyContribution),
          rebalanceFrequency: portfolio.rebalanceFrequency,
          assets:
            portfolio.assets?.map((a) => ({
              ticker: a.ticker,
              targetAllocation: Number(a.targetAllocation),
            })) || [],
        }}
        onSuccess={() => router.push(`/carteira/${portfolioId}`)}
        onCancel={() => router.push(`/carteira/${portfolioId}`)}
      />

      <PortfolioAssetManager
        portfolioId={portfolioId}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-assets', portfolioId] });
          queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
        }}
      />
    </PortfolioPageShell>
  );
}
