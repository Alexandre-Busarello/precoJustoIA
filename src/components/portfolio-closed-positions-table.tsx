"use client";

import { useState, useEffect, cache } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import { portfolioCache } from "@/lib/portfolio-cache";

interface ClosedPosition {
  ticker: string;
  averagePrice: number;
  totalInvested: number;
  totalSold: number;
  realizedReturn: number;
  realizedReturnPercentage: number;
  totalDividends: number;
  totalReturn: number;
  totalReturnPercentage: number;
  closedDate: string;
}

interface PortfolioClosedPositionsTableProps {
  portfolioId: string;
}

export function PortfolioClosedPositionsTable({
  portfolioId,
}: PortfolioClosedPositionsTableProps) {
  const { toast } = useToast();
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClosedPositions();
  }, [portfolioId]);

  const loadClosedPositions = async (forceRefresh = false) => {
    try {
      setLoading(true);

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = portfolioCache.closedPositions?.get(portfolioId) as any;
        if (cached) {
          setClosedPositions(cached.closedPositions || []);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await cache(async() => fetch(`/api/portfolio/${portfolioId}/closed-positions`))();

      if (!response.ok) {
        throw new Error("Erro ao carregar posições encerradas");
      }

      const data = await response.json();
      
      // Cache the result
      if (portfolioCache.closedPositions) {
        portfolioCache.closedPositions.set(portfolioId, data);
      }
      
      setClosedPositions(data.closedPositions || []);
    } catch (error) {
      console.error("Erro ao carregar posições encerradas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as posições encerradas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const isPositive = (value: number) => value >= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (closedPositions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma posição encerrada encontrada</p>
            <p className="text-sm mt-1">
              Ativos que saíram da carteira aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <History className="h-5 w-5" />
            Posições Encerradas
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {closedPositions.length} {closedPositions.length === 1 ? 'ativo' : 'ativos'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">Vendido</TableHead>
                <TableHead className="text-right">Retorno Realizado</TableHead>
                <TableHead className="text-right">Dividendos</TableHead>
                <TableHead className="text-right">Retorno Total</TableHead>
                <TableHead className="text-right">Data Encerramento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedPositions.map((position) => (
                <TableRow key={position.ticker}>
                  <TableCell className="font-medium">
                    {position.ticker}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(position.averagePrice)}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(position.totalInvested)}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrency(position.totalSold)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div
                      className={`flex flex-col items-end ${
                        isPositive(position.realizedReturn)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isPositive(position.realizedReturn) ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          {formatPercent(position.realizedReturnPercentage)}
                        </span>
                      </div>
                      <span className="text-xs">
                        {formatCurrency(position.realizedReturn)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    {position.totalDividends > 0 ? (
                      <span className="text-green-600 font-medium">
                        {formatCurrency(position.totalDividends)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        R$ 0,00
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div
                      className={`flex flex-col items-end ${
                        isPositive(position.totalReturn)
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {isPositive(position.totalReturn) ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          {formatPercent(position.totalReturnPercentage)}
                        </span>
                      </div>
                      <span className="text-xs">
                        {formatCurrency(position.totalReturn)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDate(position.closedDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <History className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Histórico Completo da Carteira
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Esta seção mostra todos os ativos que já passaram pela sua carteira,
                incluindo rentabilidade realizada e dividendos recebidos (mesmo após
                sair da posição).
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

