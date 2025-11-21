"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  ArrowRight,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useDashboardPortfolios } from "@/hooks/use-dashboard-data";
import { useQueryClient } from "@tanstack/react-query";

interface Portfolio {
  id: string;
  name: string;
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  netInvested: number; // Capital líquido investido (totalInvested - totalWithdrawn)
  totalReturn: number;
  evolutionData: Array<{
    date: string;
    value: number;
  }>;
}

/**
 * Invalidate dashboard portfolios cache
 * Call this when portfolio data changes (transactions, config updates, etc.)
 * This invalidates both React Query cache and old localStorage cache
 */
export function invalidateDashboardPortfoliosCache() {
  // Remove old localStorage cache if it exists
  if (typeof window !== 'undefined') {
    localStorage.removeItem('dashboard_portfolios');
    
    // Invalidate React Query cache
    // Note: This will work if called from a component with access to QueryClient
    // For components without QueryClient, they should use useQueryClient hook
    const event = new CustomEvent('invalidate-dashboard-portfolios');
    window.dispatchEvent(event);
  }
  console.log('🗑️ [DASHBOARD PORTFOLIOS] Cache invalidated');
}

export function DashboardPortfolios() {
  const queryClient = useQueryClient();
  const { data, isLoading: loading, refetch, dataUpdatedAt } = useDashboardPortfolios();
  
  const portfolios = data?.portfolios || [];
  
  // Check if data is from cache (if dataUpdatedAt is old, it's likely from cache)
  const isFromCache = dataUpdatedAt && (Date.now() - dataUpdatedAt) > 1000;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-portfolios'] });
    refetch();
  };

  // Listen for cache invalidation events
  useEffect(() => {
    const handleInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-portfolios'] });
    };
    
    window.addEventListener('invalidate-dashboard-portfolios', handleInvalidate);
    return () => {
      window.removeEventListener('invalidate-dashboard-portfolios', handleInvalidate);
    };
  }, [queryClient]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <BarChart3 className="h-8 w-8 animate-pulse opacity-50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (portfolios.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <Wallet className="h-12 w-12 mx-auto opacity-50" />
            <div>
              <h3 className="font-semibold text-lg">Nenhuma carteira criada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Crie sua primeira carteira para começar a acompanhar seus investimentos
              </p>
            </div>
            <Button asChild>
              <Link href="/carteira">
                <Plus className="mr-2 h-4 w-4" />
                Criar Carteira
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bestPortfolio = portfolios[0];
  const otherPortfolios = portfolios.slice(1);

  return (
    <div className="space-y-4">
      {/* Header com botão de refresh */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Suas Carteiras</h3>
        <div className="flex items-center gap-2">
          {isFromCache && (
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Cache
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            title="Atualizar carteiras"
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Best Performing Portfolio - Featured */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-primary">
                  Melhor Performance
                </Badge>
              </div>
              <CardTitle className="text-2xl">{bestPortfolio.name}</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/carteira?id=${bestPortfolio.id}`}>
                Ver Detalhes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metrics */}
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Atual</p>
                <p className="text-3xl font-bold">
                  R$ {bestPortfolio.currentValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Caixa: R$ {bestPortfolio.cashBalance.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Retorno Total</p>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      bestPortfolio.totalReturn >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {bestPortfolio.totalReturn >= 0 ? "+" : ""}
                    {(bestPortfolio.totalReturn * 100).toFixed(2)}%
                  </p>
                  {bestPortfolio.totalReturn >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Investido líquido: R$ {bestPortfolio.netInvested.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {bestPortfolio.totalWithdrawn > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    (Aportes: R$ {bestPortfolio.totalInvested.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} - Saques: R$ {bestPortfolio.totalWithdrawn.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })})
                  </p>
                )}
              </div>
            </div>

            {/* Mini Chart */}
            <div className="flex items-center justify-center">
              {bestPortfolio.evolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={bestPortfolio.evolutionData}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <RechartsTooltip
                      formatter={(value: any) =>
                        `R$ ${Number(value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      }
                      labelFormatter={(label) => {
                        if (typeof label === 'string' && label.includes('-')) {
                          const [year, month] = label.split("-");
                          return `${month}/${year}`;
                        }
                        return String(label);
                      }}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={bestPortfolio.totalReturn >= 0 ? "#16a34a" : "#dc2626"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  Dados insuficientes
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Portfolios - Compact Grid */}
      {otherPortfolios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherPortfolios.map((portfolio) => (
            <Card key={portfolio.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-base line-clamp-1">
                  {portfolio.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Atual</p>
                  <p className="text-lg font-bold">
                    R$ {portfolio.currentValue.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Retorno</p>
                  <div className="flex items-center gap-1">
                    <p
                      className={`text-base font-semibold ${
                        portfolio.totalReturn >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {portfolio.totalReturn >= 0 ? "+" : ""}
                      {(portfolio.totalReturn * 100).toFixed(2)}%
                    </p>
                    {portfolio.totalReturn >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>

                {/* Mini Chart */}
                {portfolio.evolutionData.length > 0 && (
                  <div className="h-16">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={portfolio.evolutionData}>
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={portfolio.totalReturn >= 0 ? "#16a34a" : "#dc2626"}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/carteira?id=${portfolio.id}`}>
                    Ver Carteira
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create New Portfolio Button */}
      <Card className="border-dashed hover:border-primary/50 transition-colors">
        <CardContent className="py-8">
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/carteira">
              <Plus className="mr-2 h-5 w-5" />
              Criar Nova Carteira
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
