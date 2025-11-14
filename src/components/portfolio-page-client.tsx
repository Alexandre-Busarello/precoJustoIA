"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  Plus,
  TrendingUp,
  Receipt,
  Settings,
  BarChart3,
  Crown,
  Trash2,
} from "lucide-react";
import { usePremiumStatus } from "@/hooks/use-premium-status";
import { PortfolioMetricsCard } from "@/components/portfolio-metrics-card";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings-table";
import { PortfolioClosedPositionsTable } from "@/components/portfolio-closed-positions-table";
import { PortfolioTransactionList } from "@/components/portfolio-transaction-list";
import { PortfolioTransactionSuggestions } from "@/components/portfolio-transaction-suggestions";
import { PortfolioRebalancingSuggestions } from "@/components/portfolio-rebalancing-suggestions";
import { PortfolioDividendSuggestions } from "@/components/portfolio-dividend-suggestions";
import { PortfolioPendingTransactionsCTA } from "@/components/portfolio-pending-transactions-cta";
import { PortfolioConfigForm } from "@/components/portfolio-config-form";
import { PortfolioTransactionForm } from "@/components/portfolio-transaction-form";
import { ConvertBacktestModal } from "@/components/convert-backtest-modal";
import { GenerateBacktestModal } from "@/components/generate-backtest-modal";
import { PortfolioAssetManager } from "@/components/portfolio-asset-manager";
import { PortfolioNegativeCashAlert } from "@/components/portfolio-negative-cash-alert";
import { PortfolioAnalytics } from "@/components/portfolio-analytics";
import { PortfolioAICTA } from "@/components/portfolio-ai-cta";
import { PortfolioTransactionAI } from "@/components/portfolio-transaction-ai";
import { PortfolioTransactionAICTA } from "@/components/portfolio-transaction-ai-cta";
import { DeletePortfolioDialog } from "@/components/delete-portfolio-dialog";
import { invalidateDashboardPortfoliosCache } from "@/components/dashboard-portfolios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Types
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
    totalReturn: number;
    cashBalance: number;
  } | null;
}

/**
 * Portfolio Page Client Component
 */
// Fetch function for portfolios
const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const response = await fetch("/api/portfolio");
  if (!response.ok) {
    throw new Error("Erro ao carregar carteiras");
  }
  const data = await response.json();
  return data.portfolios || [];
};

export function PortfolioPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const queryClient = useQueryClient();

  // Use React Query for portfolios
  const {
    data: portfolios = [],
    isLoading: loading,
    error: portfoliosError,
  } = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
  });

  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(
    null
  );

  // Show error toast if portfolios query fails
  useEffect(() => {
    if (portfoliosError) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas carteiras",
        variant: "destructive",
      });
    }
  }, [portfoliosError, toast]);

  // Auto-select portfolio from URL or first one
  useEffect(() => {
    const portfolioId = searchParams.get("id");
    if (portfolioId && portfolios.some((p) => p.id === portfolioId)) {
      setSelectedPortfolio(portfolioId);
    } else if (portfolios.length > 0 && !selectedPortfolio) {
      setSelectedPortfolio(portfolios[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, portfolios]);

  // Reload portfolios function (for use by child components)
  const reloadPortfolios = () => {
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConvertBacktestModal, setShowConvertBacktestModal] =
    useState(false);

  const handleCreatePortfolio = async () => {
    // Check if user can create more portfolios
    if (!isPremium && portfolios.length >= 1) {
      toast({
        title: "Upgrade Necessário",
        description:
          "Usuários gratuitos estão limitados a 1 carteira. Faça upgrade para Premium.",
        variant: "destructive",
      });
      router.push("/planos");
      return;
    }

    setShowCreateModal(true);
  };

  const handleSelectPortfolio = (portfolioId: string) => {
    setSelectedPortfolio(portfolioId);
    router.push(`/carteira?id=${portfolioId}`);
  };

  // No portfolios yet - show welcome screen
  if (!loading && portfolios.length === 0) {
    return (
      <>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">
                  Comece sua Jornada de Investimentos
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Crie sua primeira carteira para acompanhar seus investimentos,
                  receber sugestões de transações e monitorar seu desempenho.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleCreatePortfolio} size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Criar Nova Carteira
                  </Button>
                  <Button
                    onClick={() => setShowConvertBacktestModal(true)}
                    size="lg"
                    variant="outline"
                  >
                    <BarChart3 className="mr-2 h-5 w-5" />A partir de Backtest
                  </Button>
                </div>

                {!isPremium && (
                  <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg max-w-md">
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      <strong>Nota:</strong> Usuários gratuitos podem criar 1
                      carteira. Faça upgrade para Premium para carteiras
                      ilimitadas.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Create Portfolio Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Criar Nova Carteira</DialogTitle>
              <DialogDescription>
                Configure sua carteira de investimentos
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <PortfolioConfigForm
                mode="create"
                onSuccess={() => {
                  setShowCreateModal(false);
                  reloadPortfolios();
                }}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Convert Backtest Modal */}
        <Dialog
          open={showConvertBacktestModal}
          onOpenChange={setShowConvertBacktestModal}
        >
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Criar Carteira a partir de Backtest</DialogTitle>
              <DialogDescription>
                Converta um backtest existente em uma carteira para
                acompanhamento real
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <ConvertBacktestModal
                onSuccess={(portfolioId) => {
                  setShowConvertBacktestModal(false);
                  reloadPortfolios();
                  router.push(`/carteira?id=${portfolioId}`);
                }}
                onCancel={() => setShowConvertBacktestModal(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  const currentPortfolio = portfolios.find((p) => p.id === selectedPortfolio);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
              <span className="truncate">Minhas Carteiras</span>
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

        {/* Portfolio Selector */}
        {portfolios.length > 1 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            {portfolios.map((portfolio) => (
              <Button
                key={portfolio.id}
                variant={
                  selectedPortfolio === portfolio.id ? "default" : "outline"
                }
                onClick={() => handleSelectPortfolio(portfolio.id)}
                className="flex-shrink-0 text-xs sm:text-sm"
              >
                <span className="truncate max-w-[120px] sm:max-w-none">
                  {portfolio.name}
                </span>
                {portfolio.metrics && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {portfolio.metrics.totalReturn >= 0 ? "+" : ""}
                    {(portfolio.metrics.totalReturn * 100).toFixed(1)}%
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}

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
                  onClick={() => router.push("/planos")}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Fazer Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portfolio Details */}
        {currentPortfolio ? (
          <PortfolioDetails
            portfolio={currentPortfolio}
            onUpdate={() => reloadPortfolios()}
          />
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                Selecione uma carteira para visualizar os detalhes
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Portfolio Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Carteira</DialogTitle>
            <DialogDescription>
              Configure sua carteira de investimentos
            </DialogDescription>
          </DialogHeader>
          <PortfolioConfigForm
            mode="create"
            onSuccess={() => {
              setShowCreateModal(false);
              reloadPortfolios();
            }}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Convert Backtest Modal */}
      <Dialog
        open={showConvertBacktestModal}
        onOpenChange={setShowConvertBacktestModal}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Carteira a partir de Backtest</DialogTitle>
            <DialogDescription>
              Converta um backtest existente em uma carteira para acompanhamento
              real
            </DialogDescription>
          </DialogHeader>
          <ConvertBacktestModal
            onSuccess={(portfolioId) => {
              setShowConvertBacktestModal(false);
              reloadPortfolios();
              router.push(`/carteira?id=${portfolioId}`);
            }}
            onCancel={() => setShowConvertBacktestModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Portfolio Details Component with Tabs
 */
function PortfolioDetails({
  portfolio,
  onUpdate,
}: {
  portfolio: Portfolio;
  onUpdate: () => void;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get("tab");
    const hashParam = typeof window !== "undefined" ? window.location.hash : "";

    // Se tem hash #ai-assistant, vai para aba config
    if (hashParam === "#ai-assistant") {
      return "config";
    }

    // Se tem hash #transaction-ai, vai para aba transactions
    if (hashParam === "#transaction-ai") {
      return "transactions";
    }

    return tabParam &&
      ["overview", "transactions", "analytics", "config"].includes(tabParam)
      ? tabParam
      : "overview";
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl sm:text-2xl">
              {portfolio.name}
            </CardTitle>
            {portfolio.description && (
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {portfolio.description}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-xs sm:text-sm flex-shrink-0"
            >
              {portfolio.assetCount}{" "}
              {portfolio.assetCount === 1 ? "ativo" : "ativos"}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs sm:text-sm flex-shrink-0"
            >
              {portfolio.rebalanceFrequency === "monthly"
                ? "Mensal"
                : portfolio.rebalanceFrequency === "quarterly"
                ? "Trimestral"
                : "Anual"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile: Scroll horizontal | Desktop: Grid */}
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex sm:grid w-max sm:w-full sm:grid-cols-4 gap-1">
              <TabsTrigger
                value="overview"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <Receipt className="h-4 w-4 flex-shrink-0" />
                <span>Transações</span>
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span>Análises</span>
              </TabsTrigger>
              <TabsTrigger
                value="config"
                className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span>Configuração</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <PortfolioOverview
              portfolioId={portfolio.id}
              startDate={portfolio.startDate}
              trackingStarted={portfolio.trackingStarted}
              onUpdate={onUpdate}
              setActiveTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4 mt-6">
            <PortfolioTransactions
              portfolioId={portfolio.id}
              trackingStarted={portfolio.trackingStarted}
              onUpdate={onUpdate}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-6">
            <PortfolioAnalytics portfolioId={portfolio.id} />
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-6">
            <PortfolioConfiguration portfolio={portfolio} onUpdate={onUpdate} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * Tab Content Components
 */
function PortfolioOverview({
  portfolioId,
  startDate,
  trackingStarted,
  onUpdate,
  setActiveTab,
}: {
  portfolioId: string;
  startDate: Date;
  trackingStarted: boolean;
  onUpdate: () => void;
  setActiveTab: (tab: string) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const queryClient = useQueryClient();

  // Fetch function for metrics
  const fetchMetrics = async () => {
    const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
    if (!response.ok) {
      throw new Error("Erro ao carregar métricas");
    }
    const data = await response.json();
    return data.metrics;
  };

  // Use React Query for metrics
  const {
    data: metrics,
    isLoading: loading,
  } = useQuery({
    queryKey: ["portfolio-metrics", portfolioId],
    queryFn: fetchMetrics,
    enabled: !!portfolioId,
  });

  // Reactive update - only reloads local data without full page refresh
  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
    // Invalidate metrics query to reload
    queryClient.invalidateQueries({ queryKey: ["portfolio-metrics", portfolioId] });
    onUpdate(); // Notify parent to update portfolio selector badges
    invalidateDashboardPortfoliosCache(); // Invalidate dashboard cache
  };

  // Reload metrics when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      queryClient.invalidateQueries({ queryKey: ["portfolio-metrics", portfolioId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {metrics && (
        <PortfolioMetricsCard
          metrics={metrics}
          loading={loading}
          startDate={startDate}
        />
      )}

      {/* AI CTAs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Portfolio Optimization CTA */}
        <PortfolioAICTA
          portfolioId={portfolioId}
          currentAssets={
            metrics?.holdings?.map((h: any) => ({
              ticker: h.ticker,
              targetAllocation: h.targetAllocation || 0,
            })) || []
          }
          onScrollToAI={() => {
            // Navegar para a aba config
            setActiveTab("config");

            // Atualizar URL para incluir hash
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "config");
            url.hash = "#ai-assistant";
            window.history.replaceState({}, "", url.toString());

            // Aguardar carregamento da aba e dados HTTP
            setTimeout(() => {
              const replaceSection = document.querySelector(
                '[data-replace-section="true"]'
              );
              if (replaceSection) {
                replaceSection.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });

                // Adicionar highlight temporário
                replaceSection.classList.add(
                  "ring-2",
                  "ring-blue-500",
                  "ring-opacity-50",
                  "rounded-lg"
                );
                setTimeout(() => {
                  replaceSection.classList.remove(
                    "ring-2",
                    "ring-blue-500",
                    "ring-opacity-50",
                    "rounded-lg"
                  );
                }, 2000);
              }
            }, 500);
          }}
        />

        {/* Transaction AI CTA */}
        <PortfolioTransactionAICTA
          portfolioId={portfolioId}
          onScrollToTransactionAI={() => {
            // Navegar para a aba transactions
            setActiveTab("transactions");

            // Atualizar URL para incluir hash
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "transactions");
            url.hash = "#transaction-ai";
            window.history.replaceState({}, "", url.toString());

            // Aguardar carregamento da aba
            setTimeout(() => {
              const transactionAISection = document.querySelector(
                '[data-transaction-ai-section="true"]'
              );
              if (transactionAISection) {
                transactionAISection.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });

                // Adicionar highlight temporário
                transactionAISection.classList.add(
                  "ring-2",
                  "ring-green-500",
                  "ring-opacity-50",
                  "rounded-lg"
                );
                setTimeout(() => {
                  transactionAISection.classList.remove(
                    "ring-2",
                    "ring-green-500",
                    "ring-opacity-50",
                    "rounded-lg"
                  );
                }, 2000);
              }
            }, 500);
          }}
        />
      </div>

      {/* Negative Cash Alert */}
      {metrics && metrics.cashBalance < 0 && (
        <PortfolioNegativeCashAlert
          portfolioId={portfolioId}
          cashBalance={metrics.cashBalance}
          onFixed={handleUpdate}
        />
      )}

      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Transações Pendentes</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransactionForm(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
        <PortfolioPendingTransactionsCTA
          key={`overview-pending-cta-${portfolioId}-${refreshKey}`}
          portfolioId={portfolioId}
          trackingStarted={trackingStarted}
          onGoToTransactions={() => setActiveTab("transactions")}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Posições Atuais</h3>
        <PortfolioHoldingsTable
          key={`overview-holdings-${portfolioId}-${refreshKey}`}
          portfolioId={portfolioId}
          onNavigateToTransactions={() => {
            setActiveTab("transactions");
            // Update URL to include tab parameter
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "transactions");
            window.history.replaceState({}, "", url.toString());
          }}
        />
      </div>

      <div className="mt-6">
        <PortfolioClosedPositionsTable
          key={`overview-closed-${portfolioId}-${refreshKey}`}
          portfolioId={portfolioId}
        />
      </div>

      {/* Transaction Form Modal */}
      <Dialog open={showTransactionForm} onOpenChange={setShowTransactionForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Registrar Transação Manual</DialogTitle>
            <DialogDescription>
              Adicione uma transação manualmente à sua carteira
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <PortfolioTransactionForm
              portfolioId={portfolioId}
              onSuccess={() => {
                setShowTransactionForm(false);
                handleUpdate();
              }}
              onCancel={() => setShowTransactionForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PortfolioTransactions({
  portfolioId,
  trackingStarted,
  onUpdate,
}: {
  portfolioId: string;
  trackingStarted: boolean;
  onUpdate: () => void;
}) {
  const { isPremium } = usePremiumStatus();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const queryClient = useQueryClient();

  // Fetch function for metrics
  const fetchMetrics = async () => {
    const response = await fetch(`/api/portfolio/${portfolioId}/metrics`);
    if (!response.ok) {
      throw new Error("Erro ao carregar métricas");
    }
    const data = await response.json();
    return data.metrics;
  };

  // Use React Query for metrics
  const {
    data: metrics,
    isLoading: loading,
  } = useQuery({
    queryKey: ["portfolio-metrics", portfolioId],
    queryFn: fetchMetrics,
    enabled: !!portfolioId,
  });

  // Reactive update - only refreshes local components without full page reload
  const handleTransactionUpdate = async () => {
    setRefreshKey((prev) => prev + 1);
    // Invalidate metrics query to reload
    queryClient.invalidateQueries({ queryKey: ["portfolio-metrics", portfolioId] });
    onUpdate(); // Notify parent to update portfolio selector badges only
    invalidateDashboardPortfoliosCache(); // Invalidate dashboard cache
  };

  // Detectar hash e fazer scroll quando dados carregarem
  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && window.location.hash === '#transaction-ai') {
      // Aguardar um pouco mais para garantir que a seção foi renderizada
      setTimeout(() => {
        const transactionAISection = document.querySelector('[data-transaction-ai-section="true"]');
        if (transactionAISection) {
          transactionAISection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Adicionar highlight temporário
          transactionAISection.classList.add('ring-2', 'ring-green-500', 'ring-opacity-50', 'rounded-lg');
          setTimeout(() => {
            transactionAISection.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-50', 'rounded-lg');
          }, 2000);
        }
      }, 300);
    }
  }, [loading]);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Transações Sugeridas</h3>
          <PortfolioTransactionSuggestions
            key={`suggestions-${portfolioId}-${refreshKey}`}
            portfolioId={portfolioId}
            trackingStarted={trackingStarted}
            onTrackingStart={handleTransactionUpdate}
            onTransactionsConfirmed={handleTransactionUpdate}
          />
        </div>

        {/* Rebalancing Suggestions Section */}
        <div>
          <PortfolioRebalancingSuggestions
            key={`rebalancing-${portfolioId}-${refreshKey}`}
            portfolioId={portfolioId}
            trackingStarted={trackingStarted}
            onTransactionsConfirmed={handleTransactionUpdate}
          />
        </div>

        {/* Dividend Suggestions Section */}
        <div>
          <PortfolioDividendSuggestions
            key={`dividends-${portfolioId}-${refreshKey}`}
            portfolioId={portfolioId}
            trackingStarted={trackingStarted}
            onTransactionsConfirmed={handleTransactionUpdate}
          />
        </div>
      </div>

      {/* AI Transaction Assistant */}
      <div data-transaction-ai-section="true">
        <h3 className="text-lg font-semibold mb-4">Cadastro Inteligente de Transações</h3>
        <PortfolioTransactionAI
          portfolioId={portfolioId}
          onTransactionsGenerated={(transactions) => {
            // TODO: Implementar aplicação das transações
            console.log('Transações geradas:', transactions);
            handleTransactionUpdate();
          }}
          disabled={!isPremium}
          currentCashBalance={metrics?.cashBalance || 0}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Histórico de Transações</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransactionForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
        <PortfolioTransactionList
          key={`list-${refreshKey}`}
          portfolioId={portfolioId}
          onTransactionUpdate={handleTransactionUpdate}
        />
      </div>

      {/* Transaction Form Modal */}
      <Dialog open={showTransactionForm} onOpenChange={setShowTransactionForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Transação Manual</DialogTitle>
            <DialogDescription>
              Adicione uma transação manualmente à sua carteira
            </DialogDescription>
          </DialogHeader>
          <PortfolioTransactionForm
            portfolioId={portfolioId}
            onSuccess={() => {
              setShowTransactionForm(false);
              handleTransactionUpdate();
            }}
            onCancel={() => setShowTransactionForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PortfolioConfiguration({
  portfolio,
  onUpdate,
}: {
  portfolio: Portfolio;
  onUpdate: () => void;
}) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGenerateBacktestModal, setShowGenerateBacktestModal] =
    useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Informações da Carteira</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerateBacktestModal(true)}
                className="w-full sm:w-auto"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Gerar Backtest
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="w-full sm:w-auto"
              >
                <Settings className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium break-words">{portfolio.name}</p>
            </div>
            {portfolio.description && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="font-medium break-words">{portfolio.description}</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Data de Início</p>
              <p className="font-medium">
                {new Date(portfolio.startDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Aporte Mensal</p>
              <p className="font-medium">
                R$ {portfolio.monthlyContribution.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Rebalanceamento</p>
              <p className="font-medium capitalize">
                {portfolio.rebalanceFrequency === "monthly" && "Mensal"}
                {portfolio.rebalanceFrequency === "quarterly" && "Trimestral"}
                {portfolio.rebalanceFrequency === "yearly" && "Anual"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Management */}
      <PortfolioAssetManager portfolioId={portfolio.id} onUpdate={onUpdate} />

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Editar Carteira</DialogTitle>
            <DialogDescription>
              Atualize as configurações da sua carteira
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <PortfolioConfigForm
              mode="edit"
              initialData={{
                id: portfolio.id,
                name: portfolio.name,
                description: portfolio.description,
                startDate: new Date(portfolio.startDate)
                  .toISOString()
                  .split("T")[0],
                monthlyContribution: portfolio.monthlyContribution,
                rebalanceFrequency: portfolio.rebalanceFrequency,
                assets: [],
              }}
              onSuccess={() => {
                setShowEditModal(false);
                onUpdate();
              }}
              onCancel={() => setShowEditModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Backtest Modal */}
      <Dialog
        open={showGenerateBacktestModal}
        onOpenChange={setShowGenerateBacktestModal}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Gerar Backtest da Carteira</DialogTitle>
            <DialogDescription>
              Crie um backtest com a composição atual da sua carteira
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <GenerateBacktestModal
              portfolioId={portfolio.id}
              portfolioName={portfolio.name}
              onSuccess={() => {
                setShowGenerateBacktestModal(false);
              }}
              onCancel={() => setShowGenerateBacktestModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Portfolio Dialog */}
      <DeletePortfolioDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
      />
    </div>
  );
}
