'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, Sparkles, ArrowRight } from 'lucide-react';
import { PortfolioSmartInput } from '@/components/portfolio-smart-input';
import { PortfolioMetricsCard } from '@/components/portfolio-metrics-card';
import { PortfolioHoldingsTable } from '@/components/portfolio-holdings-table';
import { PortfolioClosedPositionsTable } from '@/components/portfolio-closed-positions-table';
import { PortfolioAnalytics } from '@/components/portfolio-analytics';
import { usePortfolioSuggestionsAvailable } from '@/hooks/use-portfolio-suggestions-available';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Briefcase } from 'lucide-react';

interface PortfolioDetailPageProps {
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

export function PortfolioDetailPage({ portfolioId }: PortfolioDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: portfolio,
    isLoading,
    error,
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

  // Check if there are suggestions available
  const { hasSuggestions, isLoading: suggestionsLoading } = usePortfolioSuggestionsAvailable(
    portfolioId,
    portfolio?.trackingStarted || false,
    metrics?.cashBalance
  );

  const handleTransactionsApplied = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['portfolio-metrics', portfolioId] });
    queryClient.invalidateQueries({ queryKey: ['portfolio', portfolioId] });
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/carteira')}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {portfolio.name}
              </h1>
              {portfolio.description && (
                <p className="text-muted-foreground mt-1 text-sm sm:text-base break-words">
                  {portfolio.description}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/carteira/${portfolioId}/config`)}
            className="flex-shrink-0"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
        </div>

        {/* Smart Input Zone - Hero Section */}
        <div className="mb-6">
          <PortfolioSmartInput
            portfolioId={portfolioId}
            currentCashBalance={metrics?.cashBalance || 0}
            onTransactionsApplied={handleTransactionsApplied}
            defaultCollapsed={true} // Start collapsed on detail page
          />
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* Metrics Summary */}
          {metrics && (
            <PortfolioMetricsCard
              metrics={metrics}
              loading={metricsLoading}
              startDate={portfolio.startDate}
            />
          )}

          {/* Suggestions Link Card */}
          {portfolio.trackingStarted && !suggestionsLoading && hasSuggestions && (
            <Card className="border-green-200 dark:border-green-900 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100">
                        Sugestões de Transações Disponíveis
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Há sugestões de aportes, rebalanceamento ou dividendos aguardando
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push(`/carteira/${portfolioId}/transacoes`)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Ver Sugestões
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs: Posições e Análise */}
          <Tabs defaultValue="positions" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="positions" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Posições
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análise
              </TabsTrigger>
            </TabsList>

            <TabsContent value="positions" className="space-y-6">
              {/* Holdings Table */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Posições Atuais</h2>
                <PortfolioHoldingsTable
                  portfolioId={portfolioId}
                  onNavigateToTransactions={() => {
                    router.push(`/carteira/${portfolioId}/transacoes`);
                  }}
                />
              </div>

              {/* Closed Positions Table */}
              {portfolio.trackingStarted && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Posições Encerradas</h2>
                  <PortfolioClosedPositionsTable portfolioId={portfolioId} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Analytics Component */}
              {portfolio.trackingStarted ? (
                <PortfolioAnalytics portfolioId={portfolioId} />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Inicie o acompanhamento</h3>
                    <p className="text-muted-foreground mb-4">
                      Para ver as análises da carteira, você precisa iniciar o acompanhamento primeiro.
                    </p>
                    <Button onClick={() => router.push(`/carteira/${portfolioId}/config`)} variant="outline">
                      Ir para Configurações
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

