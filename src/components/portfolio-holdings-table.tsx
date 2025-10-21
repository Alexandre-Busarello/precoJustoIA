'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { portfolioCache } from '@/lib/portfolio-cache';

interface Holding {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalInvested: number;
  return: number;
  returnPercentage: number;
  targetAllocation: number;
  actualAllocation: number;
  allocationDiff: number;
  needsRebalancing: boolean;
}

interface PortfolioHoldingsTableProps {
  portfolioId: string;
}

export function PortfolioHoldingsTable({ portfolioId }: PortfolioHoldingsTableProps) {
  const { toast } = useToast();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    loadHoldings();
  }, [portfolioId]);

  const loadHoldings = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = portfolioCache.holdings.get(portfolioId) as any;
        if (cached) {
          setHoldings(cached.holdings || []);
          setTotalValue(cached.totalValue || 0);
          setLoading(false);
          return;
        }
      }
      
      // Fetch from API
      const response = await fetch(`/api/portfolio/${portfolioId}/holdings`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar posições');
      }

      const data = await response.json();
      portfolioCache.holdings.set(portfolioId, data);
      setHoldings(data.holdings || []);
      setTotalValue(data.totalValue || 0);
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as posições',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const isPositive = (value: number) => value >= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>Nenhuma posição encontrada</p>
            <p className="text-sm mt-1">
              Confirme suas primeiras transações para ver suas posições
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasRebalancingNeeded = holdings.some(h => h.needsRebalancing);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg sm:text-xl">Posições Atuais</CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Total: {formatCurrency(totalValue)}
            </span>
            {hasRebalancingNeeded && (
              <Badge variant="outline" className="gap-1 text-xs flex-shrink-0">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                <span className="hidden sm:inline">Rebalanceamento sugerido</span>
                <span className="sm:hidden">Rebalancear</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Preço Atual</TableHead>
                <TableHead className="text-right">Valor Atual</TableHead>
                <TableHead className="text-right">Retorno</TableHead>
                <TableHead className="text-right">Alocação</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map(holding => (
                <TableRow key={holding.ticker}>
                  <TableCell className="font-medium">
                    {holding.ticker}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {holding.quantity.toFixed(0)}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {formatCurrency(holding.averagePrice)}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    {formatCurrency(holding.currentPrice)}
                  </TableCell>
                  
                  <TableCell className="text-right font-medium">
                    {formatCurrency(holding.currentValue)}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className={`flex flex-col items-end ${
                      isPositive(holding.return) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <div className="flex items-center gap-1">
                        {isPositive(holding.return) ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          {formatPercent(holding.returnPercentage)}
                        </span>
                      </div>
                      <span className="text-xs">
                        {formatCurrency(holding.return)}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatPercent(holding.actualAllocation)}
                        </span>
                        {holding.needsRebalancing && (
                          <AlertTriangle className="h-3 w-3 text-orange-600" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Meta: {formatPercent(holding.targetAllocation)}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {holding.needsRebalancing ? (
                      <Badge variant="outline" className="text-xs">
                        {holding.allocationDiff > 0 ? 'Sobrepeso' : 'Subpeso'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {hasRebalancingNeeded && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Rebalanceamento Recomendado
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Alguns ativos estão fora da alocação alvo. Considere rebalancear sua carteira.
                </p>
              </div>
              <Button size="sm" variant="outline" className="w-full sm:w-auto flex-shrink-0 text-xs sm:text-sm">
                Rebalancear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

