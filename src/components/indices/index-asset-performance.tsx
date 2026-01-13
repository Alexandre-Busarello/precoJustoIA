/**
 * Componente: Performance Individual de Ativos do Índice
 * Mostra tabela com todos os ativos que passaram pelo índice e suas performances
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import Link from 'next/link';

interface AssetPerformance {
  ticker: string;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  daysInIndex: number;
  totalReturn: number | null;
  contributionToIndex: number;
  averageWeight: number;
  status: 'ACTIVE' | 'EXITED';
  firstSnapshotDate: string;
  lastSnapshotDate: string;
}

interface IndexAssetPerformanceProps {
  ticker: string;
}

async function fetchAssetPerformance(ticker: string): Promise<AssetPerformance[]> {
  const response = await fetch(`/api/indices/${ticker}/asset-performance`);
  if (!response.ok) {
    throw new Error('Erro ao buscar performance de ativos');
  }
  const data = await response.json();
  return data.performances || [];
}

export function IndexAssetPerformance({ ticker }: IndexAssetPerformanceProps) {
  const { isPremium } = usePremiumStatus();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'EXITED'>('ALL');
  const [sortBy, setSortBy] = useState<'entryDate' | 'totalReturn' | 'contribution' | 'days'>('entryDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: performances, isLoading, error } = useQuery({
    queryKey: ['index-asset-performance', ticker],
    queryFn: () => fetchAssetPerformance(ticker),
    refetchOnWindowFocus: false
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Individual dos Ativos</CardTitle>
          <CardDescription>Rastreamento de rentabilidade de cada ativo que passou pelo índice</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Individual dos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Erro ao carregar performance dos ativos</p>
        </CardContent>
      </Card>
    );
  }

  if (!performances || performances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Individual dos Ativos</CardTitle>
          <CardDescription>Rastreamento de rentabilidade de cada ativo que passou pelo índice</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum dado de performance disponível ainda.</p>
        </CardContent>
      </Card>
    );
  }

  // Filtrar performances
  const filteredPerformances = performances.filter(perf => {
    if (filter === 'ACTIVE') return perf.status === 'ACTIVE';
    if (filter === 'EXITED') return perf.status === 'EXITED';
    return true;
  });

  // Ordenar performances
  const sortedPerformances = [...filteredPerformances].sort((a, b) => {
    let aValue: number | string | null = null;
    let bValue: number | string | null = null;

    switch (sortBy) {
      case 'entryDate':
        aValue = a.entryDate;
        bValue = b.entryDate;
        break;
      case 'totalReturn':
        aValue = a.totalReturn ?? -Infinity;
        bValue = b.totalReturn ?? -Infinity;
        break;
      case 'contribution':
        aValue = a.contributionToIndex;
        bValue = b.contributionToIndex;
        break;
      case 'days':
        aValue = a.daysInIndex;
        bValue = b.daysInIndex;
        break;
    }

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Mostrar apenas 3 ativos para usuários Free, resto com blur
  const visiblePerformances = isPremium ? sortedPerformances : sortedPerformances.slice(0, 3);
  const blurredPerformances = isPremium ? [] : sortedPerformances.slice(3);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getReturnColor = (value: number | null) => {
    if (value === null) return 'text-muted-foreground';
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getReturnIcon = (value: number | null) => {
    if (value === null) return <Minus className="h-4 w-4" />;
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Performance Individual dos Ativos</span>
          {!isPremium && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Contribuição histórica de cada ativo para a rentabilidade acumulada do índice
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtrar:</span>
            <Button
              variant={filter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('ALL')}
            >
              Todos ({performances.length})
            </Button>
            <Button
              variant={filter === 'ACTIVE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('ACTIVE')}
            >
              Ativos ({performances.filter(p => p.status === 'ACTIVE').length})
            </Button>
            <Button
              variant={filter === 'EXITED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('EXITED')}
            >
              Removidos ({performances.filter(p => p.status === 'EXITED').length})
            </Button>
          </div>

          {/* Controles de ordenação */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="entryDate">Data de Entrada</option>
              <option value="contribution">Contribuição</option>
              <option value="days">Dias no Índice</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
            </Button>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className="text-right">Contribuição</TableHead>
                  <TableHead className="text-right">Peso Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePerformances.map((perf) => (
                  <TableRow key={perf.ticker}>
                    <TableCell className="font-medium">{perf.ticker}</TableCell>
                    <TableCell>
                      <Badge variant={perf.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {perf.status === 'ACTIVE' ? 'Ativo' : 'Removido'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(perf.entryDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {perf.exitDate ? new Date(perf.exitDate).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>{perf.daysInIndex}</TableCell>
                    <TableCell className={`text-right font-medium ${getReturnColor(perf.contributionToIndex)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getReturnIcon(perf.contributionToIndex)}
                        {formatPercent(perf.contributionToIndex)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {(perf.averageWeight * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                {blurredPerformances.map((perf, index) => (
                  <TableRow 
                    key={`blurred-${perf.ticker}-${index}`} 
                    className="relative overflow-hidden"
                    style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
                  >
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-16 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-5 w-16 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-12 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-16 rounded ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="bg-gray-300 h-4 w-12 rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {sortedPerformances.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum ativo encontrado com o filtro selecionado.
            </p>
          )}

          {!isPremium && blurredPerformances.length > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">Desbloqueie a Performance Completa</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Veja todos os {sortedPerformances.length} ativos que passaram pelo índice e suas performances detalhadas.
                  </p>
                  <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                    <Link href="/checkout">
                      Fazer Upgrade para Premium
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

