'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Briefcase,
  Plus,
  BarChart3,
  Crown,
  TrendingUp,
  Receipt,
  Settings,
  ArrowRight,
  LineChart,
} from 'lucide-react';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { PortfolioTutorialBanner } from '@/components/portfolio-tutorial-banner';
import { PortfolioEmptyState } from '@/components/portfolio-empty-state';
import { ConvertBacktestModal } from '@/components/convert-backtest-modal';
import { PortfolioCardSuggestionsButton } from '@/components/portfolio-card-suggestions-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  monthlyContribution: number;
  rebalanceFrequency: string;
  trackingStarted: boolean;
  createdAt: Date;
  assetCount: number;
  metrics?: {
    currentValue: number;
    totalInvested: number;
    totalWithdrawn: number;
    netInvested: number;
    totalReturn: number;
    cashBalance: number;
  } | null;
}

// Fetch function for portfolios
const fetchPortfolios = async (): Promise<Portfolio[]> => {
  try {
    const response = await fetch('/api/portfolio');
    if (!response.ok) {
      throw new Error('Erro ao carregar carteiras');
    }
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      console.warn('API retornou dados inválidos:', data);
      return [];
    }
    
    const portfolios = data.portfolios;
    if (!Array.isArray(portfolios)) {
      console.warn('API retornou portfolios que não é um array:', portfolios);
      return [];
    }
    return portfolios;
  } catch (error) {
    console.error('Erro ao buscar portfolios:', error);
    return [];
  }
};

export function PortfolioListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const queryClient = useQueryClient();

  const {
    data: portfoliosData,
    isLoading: loading,
    error: portfoliosError,
    refetch,
  } = useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const portfolios = Array.isArray(portfoliosData) ? portfoliosData : [];
  const [showConvertBacktestModal, setShowConvertBacktestModal] = useState(false);
  const hasRefetchedRef = useRef(false);

  useEffect(() => {
    if (portfoliosError) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar suas carteiras',
        variant: 'destructive',
      });
    }
  }, [portfoliosError, toast]);

  useEffect(() => {
    if (!loading && portfolios.length === 0 && !portfoliosError && !hasRefetchedRef.current) {
      console.log('🔄 [PORTFOLIO LIST] Portfolios vazio após carregamento inicial, forçando refetch...');
      hasRefetchedRef.current = true;
      refetch();
    }
  }, [loading, portfolios.length, portfoliosError, refetch]);

  const handleCreatePortfolio = async () => {
    if (!isPremium && portfolios.length >= 1) {
      toast({
        title: 'Upgrade Necessário',
        description: 'Usuários gratuitos estão limitados a 1 carteira. Faça upgrade para Premium.',
        variant: 'destructive',
      });
      router.push('/planos');
      return;
    }

    router.push('/carteira/nova');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && portfolios.length === 0) {
    return (
      <>
        <PortfolioTutorialBanner />
        <PortfolioEmptyState
          onCreateClick={handleCreatePortfolio}
          onConvertBacktestClick={() => setShowConvertBacktestModal(true)}
          isPremium={isPremium!}
        />
        <Dialog open={showConvertBacktestModal} onOpenChange={setShowConvertBacktestModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Criar Carteira a partir de Backtest</DialogTitle>
              <DialogDescription>
                Converta um backtest existente em uma carteira para acompanhamento real
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <ConvertBacktestModal
                onSuccess={(portfolioId) => {
                  setShowConvertBacktestModal(false);
                  queryClient.invalidateQueries({ queryKey: ['portfolios'] });
                  router.push(`/carteira/${portfolioId}`);
                }}
                onCancel={() => setShowConvertBacktestModal(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <PortfolioTutorialBanner />
      
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
                <span>Minhas Carteiras</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Gerencie seus investimentos com acompanhamento completo
              </p>
            </div>

            <Button onClick={handleCreatePortfolio} className="w-full sm:w-auto flex-shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Nova Carteira
            </Button>
          </div>

          {/* Premium CTA */}
          {!isPremium && portfolios.length >= 1 && (
            <Card className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                        Desbloqueie Carteiras Ilimitadas
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Faça upgrade para Premium e crie quantas carteiras quiser
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push('/planos')}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Fazer Upgrade
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid de Carteiras */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {portfolios.map((portfolio) => (
              <Card
                key={portfolio.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/carteira/${portfolio.id}`)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate mb-1">
                        {portfolio.name}
                      </h3>
                      {portfolio.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {portfolio.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/carteira/${portfolio.id}/config`);
                      }}
                      title="Configurações"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Métricas */}
                  {portfolio.metrics && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Patrimônio</span>
                        <span className="font-semibold">
                          {formatCurrency(portfolio.metrics.currentValue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Retorno</span>
                        <Badge
                          variant={portfolio.metrics.totalReturn >= 0 ? 'default' : 'destructive'}
                        >
                          {formatPercentage(portfolio.metrics.totalReturn)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Caixa</span>
                        <span className="text-sm font-medium">
                          {formatCurrency(portfolio.metrics.cashBalance)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="text-xs">
                      {portfolio.assetCount} {portfolio.assetCount === 1 ? 'ativo' : 'ativos'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {portfolio.rebalanceFrequency === 'monthly'
                        ? 'Mensal'
                        : portfolio.rebalanceFrequency === 'quarterly'
                        ? 'Trimestral'
                        : 'Anual'}
                    </Badge>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {portfolio.trackingStarted && (
                      <PortfolioCardSuggestionsButton
                        portfolioId={portfolio.id}
                        trackingStarted={portfolio.trackingStarted}
                        cashBalance={portfolio.metrics?.cashBalance}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/carteira/${portfolio.id}`);
                      }}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/carteira/${portfolio.id}/transacoes`);
                      }}
                    >
                      <Receipt className="h-3 w-3 mr-1" />
                      Transações
                    </Button>
                    {portfolio.trackingStarted && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/carteira/${portfolio.id}/analise`);
                        }}
                      >
                        <LineChart className="h-3 w-3 mr-1" />
                        Análise
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/carteira/${portfolio.id}/config`);
                      }}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Convert Backtest Modal */}
      <Dialog open={showConvertBacktestModal} onOpenChange={setShowConvertBacktestModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Criar Carteira a partir de Backtest</DialogTitle>
            <DialogDescription>
              Converta um backtest existente em uma carteira para acompanhamento real
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <ConvertBacktestModal
              onSuccess={(portfolioId) => {
                setShowConvertBacktestModal(false);
                queryClient.invalidateQueries({ queryKey: ['portfolios'] });
                router.push(`/carteira/${portfolioId}`);
              }}
              onCancel={() => setShowConvertBacktestModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

