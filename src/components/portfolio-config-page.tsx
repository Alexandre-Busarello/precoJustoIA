'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PortfolioConfigForm } from '@/components/portfolio-config-form';
import { PortfolioAssetManager } from '@/components/portfolio-asset-manager';

interface PortfolioConfigPageProps {
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

export function PortfolioConfigPage({ portfolioId }: PortfolioConfigPageProps) {
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

  const handleSuccess = () => {
    router.push(`/carteira/${portfolioId}`);
  };

  const handleCancel = () => {
    router.push(`/carteira/${portfolioId}`);
  };

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
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              Carteira não encontrada ou erro ao carregar
            </p>
            <Button onClick={() => router.push('/carteira')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Listagem
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto">
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
            Configurações da Carteira
          </h1>
        </div>

        {/* Config Form */}
        <div className="mb-6">
          <PortfolioConfigForm
            mode="edit"
            initialData={{
              id: portfolio.id,
              name: portfolio.name,
              description: portfolio.description || '',
              startDate: portfolio.startDate instanceof Date 
                ? portfolio.startDate.toISOString().split('T')[0]
                : typeof portfolio.startDate === 'string'
                ? portfolio.startDate.split('T')[0]
                : new Date(portfolio.startDate).toISOString().split('T')[0],
              monthlyContribution: Number(portfolio.monthlyContribution),
              rebalanceFrequency: portfolio.rebalanceFrequency,
              assets: portfolio.assets?.map((a: any) => ({
                ticker: a.ticker,
                targetAllocation: Number(a.targetAllocation),
              })) || [],
            }}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>

        {/* Asset Manager */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Gerenciar Ativos e Alocações</h2>
          <PortfolioAssetManager
            portfolioId={portfolioId}
            onUpdate={() => {
              // Refresh portfolio data
              window.location.reload();
            }}
          />
        </div>
      </div>
    </div>
  );
}

