"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Calendar } from "lucide-react";
import { portfolioCache } from "@/lib/portfolio-cache";

interface PortfolioPendingTransactionsCTAProps {
  portfolioId: string;
  trackingStarted: boolean;
  onGoToTransactions: () => void;
  refreshKey?: number; // Para forçar atualização quando necessário
}

export function PortfolioPendingTransactionsCTA({
  portfolioId,
  trackingStarted,
  onGoToTransactions,
  refreshKey = 0,
}: PortfolioPendingTransactionsCTAProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPendingCount = useCallback(async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = portfolioCache.suggestions.get(portfolioId) as any;
      if (cached && Array.isArray(cached)) {
        setPendingCount(cached.length);
        setLoading(false);
        return;
      }

      // Fetch pending transactions count
      const response = await fetch(
        `/api/portfolio/${portfolioId}/transactions?status=PENDING`
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar transações pendentes");
      }

      const data = await response.json();
      const count = data.transactions?.length || 0;
      
      setPendingCount(count);
      
      // Cache the result
      if (data.transactions) {
        portfolioCache.suggestions.set(portfolioId, data.transactions);
      }
    } catch (error) {
      console.error("Erro ao carregar contagem de transações pendentes:", error);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (trackingStarted) {
      loadPendingCount();
    } else {
      setLoading(false);
    }
  }, [trackingStarted, refreshKey, loadPendingCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trackingStarted) {
    return (
      <Card className="border-2 border-dashed border-blue-200 dark:border-blue-900">
        <CardContent className="py-8">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-blue-600 opacity-50" />
            <h3 className="text-base font-semibold mb-2">Acompanhamento não iniciado</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Inicie o acompanhamento para receber sugestões mensais automáticas de transações.
            </p>
            <Button 
              onClick={onGoToTransactions}
              size="sm"
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
            >
              Ver Transações
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingCount === null || pendingCount === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <p className="text-sm font-medium">Tudo em dia!</p>
            </div>
            <p className="text-xs">Não há transações pendentes no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
      <CardContent className="py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm sm:text-base">
                  Transações Pendentes
                </h3>
                <Badge variant="outline" className="bg-white dark:bg-gray-900 border-orange-300 dark:border-orange-700">
                  {pendingCount}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Você tem {pendingCount} {pendingCount === 1 ? 'transação pendente' : 'transações pendentes'} aguardando sua ação
              </p>
            </div>
          </div>
          <Button
            onClick={onGoToTransactions}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0 w-full sm:w-auto"
          >
            Ver Transações
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

