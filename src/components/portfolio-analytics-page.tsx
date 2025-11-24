'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PortfolioAnalytics } from '@/components/portfolio-analytics';

interface PortfolioAnalyticsPageProps {
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

export function PortfolioAnalyticsPage({ portfolioId }: PortfolioAnalyticsPageProps) {
  const router = useRouter();

  const {
    data: portfolio,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => fetchPortfolio(portfolioId),
    enabled: !!portfolioId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Carteira não encontrada ou erro ao carregar
          </p>
          <Button onClick={() => router.push('/carteira')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Listagem
          </Button>
        </div>
      </div>
    );
  }

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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Análise da Carteira
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {portfolio.name}
            </p>
          </div>
        </div>

        {/* Analytics Component */}
        <PortfolioAnalytics portfolioId={portfolioId} />
      </div>
    </div>
  );
}

