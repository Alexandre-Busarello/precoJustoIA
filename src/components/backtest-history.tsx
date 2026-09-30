'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { BacktestLoadingOverlay } from '@/components/backtest-loading-overlay';
import { formatDate, formatDeltaPct, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dateFromApi } from '@/app/backtest/backtest-utils';

interface BacktestHistoryItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  assets: Array<{
    ticker: string;
    targetAllocation: number;
    averageDividendYield?: number;
  }>;
  results?: Array<{
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    volatility: number;
    sharpeRatio: number | null;
    positiveMonths: number;
    negativeMonths: number;
    totalInvested: number;
    finalCashReserve: number;
    totalDividendsReceived: number;
    finalValue: number;
    monthlyReturns: any[];
    assetPerformance: any[];
    portfolioEvolution: any[];
    calculatedAt: string;
  }>;
  transactions?: any[];
  startDate: string;
  endDate: string;
  initialCapital?: number;
  monthlyContribution: number;
  rebalanceFrequency: string;
}

interface BacktestHistoryProps {
  onShowDetails?: (result: any, config: any, transactions?: any[]) => void;
}

const ITEMS_PER_PAGE = 10;

const REBALANCE_LABEL: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

function toneClass(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'text-foreground';
  return value > 0 ? 'text-positive' : 'text-negative';
}

/** Aba "Minhas configurações": configurações salvas com o último resultado de cada uma. */
export function BacktestHistory({ onShowDetails }: BacktestHistoryProps = {}) {
  const router = useRouter();
  const { toast } = useToast();
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConfigs, setTotalConfigs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningBacktest, setRunningBacktest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/backtest/configs?page=${page}&limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) {
        throw new Error('Não foi possível carregar suas configurações');
      }

      const data = await response.json();
      setHistory(data.configs || []);
      setTotalPages(data.totalPages || 1);
      setTotalConfigs(data.total || 0);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const response = await fetch(`/api/backtest/configs/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Erro ao excluir a configuração');
      }

      setHistory(prev => prev.filter(item => item.id !== id));
      toast({ title: 'Configuração excluída' });

      if (history.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadHistory();
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : 'Erro ao excluir a configuração',
        variant: 'destructive'
      });
    }
  };

  const rerunBacktest = async (config: BacktestHistoryItem) => {
    try {
      setRunningBacktest(config.id);

      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config.id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar o backtest');
      }

      await response.json();
      router.push(`/backtest?view=results&configId=${config.id}`);
    } catch (err) {
      console.error('Erro ao executar:', err);
      toast({
        title: 'Erro ao executar o backtest',
        description: err instanceof Error ? err.message : 'Erro ao executar o backtest',
        variant: 'destructive'
      });
    } finally {
      setRunningBacktest(null);
    }
  };

  const showDetails = (item: BacktestHistoryItem) => {
    // Sem resultado: abre a configuração no formulário
    if (!item.results || item.results.length === 0) {
      router.push(`/backtest?view=configure&configId=${item.id}`);
      return;
    }
    if (!onShowDetails) return;

    const result = item.results[0];
    const configData = {
      name: item.name,
      description: item.description,
      assets: item.assets.map(asset => ({
        ticker: asset.ticker,
        companyName: asset.ticker,
        allocation: asset.targetAllocation,
        averageDividendYield: asset.averageDividendYield || undefined
      })),
      startDate: dateFromApi(item.startDate),
      endDate: dateFromApi(item.endDate),
      initialCapital: item.initialCapital || 10000,
      monthlyContribution: item.monthlyContribution,
      rebalanceFrequency: item.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly',
      id: item.id
    };

    const completeResult = {
      totalReturn: result.totalReturn,
      annualizedReturn: result.annualizedReturn,
      volatility: result.volatility,
      sharpeRatio: result.sharpeRatio,
      maxDrawdown: result.maxDrawdown,
      positiveMonths: result.positiveMonths,
      negativeMonths: result.negativeMonths,
      totalInvested: result.totalInvested,
      finalValue: result.finalValue,
      finalCashReserve: result.finalCashReserve || 0,
      totalDividendsReceived: result.totalDividendsReceived || 0,
      monthlyReturns: result.monthlyReturns || [],
      assetPerformance: result.assetPerformance || [],
      portfolioEvolution: result.portfolioEvolution || [],
      dataValidation: null,
      dataQualityIssues: [],
      effectiveStartDate: dateFromApi(item.startDate),
      effectiveEndDate: dateFromApi(item.endDate),
      actualInvestment: result.totalInvested,
      plannedInvestment: result.totalInvested,
      missedContributions: 0,
      missedAmount: 0
    };

    onShowDetails(completeResult, configData, item.transactions || []);
  };

  const header = (
    <SectionHeader
      title="Minhas configurações"
      description={loading ? 'Carregando' : `${totalConfigs} ${totalConfigs === 1 ? 'configuração salva' : 'configurações salvas'}`}
      actions={
        <Button onClick={loadHistory} variant="outline" size="sm" disabled={loading}>
          <RefreshCw strokeWidth={1.75} aria-hidden="true" />
          Atualizar
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="space-y-2" aria-busy="true" aria-label="Carregando configurações">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-lg border border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar as configurações</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadHistory} variant="outline" className="mt-4">
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma configuração salva</p>
          <p className="mt-1 text-sm text-muted-foreground">Cada backtest executado ou salvo aparece aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {runningBacktest && (
        <BacktestLoadingOverlay title="Executando backtest" description="Processando os dados históricos e as métricas" />
      )}

      <div className="space-y-4">
        {header}

        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {history.map((item) => {
            const latest = item.results?.[0];
            return (
              <li key={item.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(item.createdAt)} · {item.assets.length} {item.assets.length === 1 ? 'ativo' : 'ativos'} ·{' '}
                      {REBALANCE_LABEL[item.rebalanceFrequency] ?? item.rebalanceFrequency}
                    </p>
                  </div>
                  <Badge variant={latest ? 'neutral' : 'warning'}>{latest ? 'Executada' : 'Sem resultado'}</Badge>
                </div>

                <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {item.assets.slice(0, 8).map((asset) => (
                    <span key={asset.ticker} className="tabular-nums">
                      {asset.ticker} {formatPct(asset.targetAllocation, { digits: 0 })}
                    </span>
                  ))}
                  {item.assets.length > 8 && <span>+{item.assets.length - 8}</span>}
                </p>

                {latest && (
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Retorno total</dt>
                      <dd className={cn('font-medium tabular-nums', toneClass(latest.totalReturn))}>{formatDeltaPct(latest.totalReturn)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Retorno anual</dt>
                      <dd className={cn('font-medium tabular-nums', toneClass(latest.annualizedReturn))}>
                        {formatDeltaPct(latest.annualizedReturn)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Drawdown</dt>
                      <dd className="font-medium tabular-nums text-foreground">{formatPct(-latest.maxDrawdown)}</dd>
                    </div>
                  </dl>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => showDetails(item)}>
                    {latest ? 'Ver resultado' : 'Abrir configuração'}
                  </Button>
                  {latest && (
                    <Button variant="outline" size="sm" onClick={() => rerunBacktest(item)} disabled={runningBacktest === item.id}>
                      {runningBacktest === item.id ? (
                        <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <RefreshCw strokeWidth={1.75} aria-hidden="true" />
                      )}
                      Executar de novo
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(item.id)}
                    disabled={runningBacktest === item.id}
                    aria-label={`Excluir ${item.name}`}
                    className="ml-auto text-muted-foreground hover:text-negative"
                  >
                    <Trash2 strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft strokeWidth={1.75} aria-hidden="true" />
              Anterior
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Próxima
              <ChevronRight strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração</AlertDialogTitle>
            <AlertDialogDescription>
              A configuração e os resultados salvos dela serão removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) deleteConfig(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
