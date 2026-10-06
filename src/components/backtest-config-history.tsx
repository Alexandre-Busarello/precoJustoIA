'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';
import { dateFromApi } from '@/app/backtest/backtest-utils';
import { EMPTY_VALUE, formatBRL, formatDate, formatDeltaPct, formatNumber, formatPct } from '@/lib/format';

interface BacktestResultHistory {
  id: string;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  finalCashReserve?: number;
  totalDividendsReceived?: number;
  monthlyReturns: any[];
  assetPerformance: any[];
  portfolioEvolution: any[];
  calculatedAt: string;
}

interface BacktestConfigHistoryProps {
  configId: string;
  configName: string;
  onShowResult?: (result: any, config: any, transactions?: any[]) => void;
}

function toneClass(value: number) {
  if (!Number.isFinite(value) || value === 0) return undefined;
  return value > 0 ? 'text-positive' : 'text-negative';
}

/** Aba "Execuções": todos os resultados de uma configuração, do mais recente ao mais antigo. */
export function BacktestConfigHistory({ configId, configName, onShowResult }: BacktestConfigHistoryProps) {
  const { toast } = useToast();
  const [results, setResults] = useState<BacktestResultHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/backtest/configs/${configId}/results`);
      if (!response.ok) {
        throw new Error('Não foi possível carregar as execuções');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Erro ao carregar resultados:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  const showResultDetails = async (result: BacktestResultHistory) => {
    if (!onShowResult) return;

    try {
      const configResponse = await fetch(`/api/backtest/configs/${configId}`);
      if (!configResponse.ok) {
        throw new Error('Erro ao carregar a configuração');
      }
      const configData = await configResponse.json();

      const config = {
        name: configData.config.name,
        description: configData.config.description,
        assets: configData.config.assets.map((asset: any) => ({
          ticker: asset.ticker,
          companyName: asset.ticker,
          allocation: asset.targetAllocation,
          averageDividendYield: asset.averageDividendYield
        })),
        startDate: dateFromApi(configData.config.startDate),
        endDate: dateFromApi(configData.config.endDate),
        initialCapital: configData.config.initialCapital,
        monthlyContribution: configData.config.monthlyContribution,
        rebalanceFrequency: configData.config.rebalanceFrequency,
        id: configId
      };

      const formattedResult = {
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
        effectiveStartDate: config.startDate,
        effectiveEndDate: config.endDate,
        actualInvestment: result.totalInvested,
        plannedInvestment: result.totalInvested,
        missedContributions: 0,
        missedAmount: 0
      };

      onShowResult(formattedResult, config, configData.config.transactions || []);
    } catch (err) {
      console.error('Erro ao mostrar detalhes:', err);
      toast({ title: 'Erro ao abrir o resultado', description: 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const columns: DataTableColumn<BacktestResultHistory>[] = [
    {
      key: 'calculatedAt',
      header: 'Execução',
      sticky: true,
      cell: (row) => {
        const index = results.findIndex((r) => r.id === row.id);
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="tabular-nums">{formatDate(row.calculatedAt, { style: 'datetime' })}</span>
            {index === 0 && <Badge variant="brand">Mais recente</Badge>}
          </span>
        );
      },
    },
    {
      key: 'totalReturn',
      header: 'Retorno total',
      align: 'right',
      cell: (row) => <span className={toneClass(row.totalReturn)}>{formatDeltaPct(row.totalReturn)}</span>,
    },
    {
      key: 'annualizedReturn',
      header: 'Retorno anual',
      align: 'right',
      cell: (row) => <span className={toneClass(row.annualizedReturn)}>{formatDeltaPct(row.annualizedReturn)}</span>,
    },
    {
      key: 'sharpeRatio',
      header: 'Sharpe',
      align: 'right',
      cell: (row) => (row.sharpeRatio ? formatNumber(row.sharpeRatio, { digits: 2 }) : EMPTY_VALUE),
    },
    { key: 'maxDrawdown', header: 'Drawdown', align: 'right', cell: (row) => formatPct(-row.maxDrawdown) },
    { key: 'totalInvested', header: 'Capital próprio', align: 'right', cell: (row) => formatBRL(row.totalInvested) },
    { key: 'finalValue', header: 'Valor final', align: 'right', cell: (row) => formatBRL(row.finalValue) },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            showResultDetails(row);
          }}
        >
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        as="h3"
        title="Histórico de execuções"
        description={loading ? 'Carregando' : `${results.length} ${results.length === 1 ? 'execução' : 'execuções'} de ${configName}`}
        actions={
          <Button onClick={loadResults} variant="outline" size="sm" disabled={loading}>
            <RefreshCw strokeWidth={1.75} aria-hidden="true" />
            Atualizar
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar as execuções</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadResults} variant="outline" className="mt-4">
            Tentar de novo
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={results}
          getRowId={(row) => row.id}
          loading={loading}
          loadingRows={3}
          onRowClick={showResultDetails}
          caption={`Execuções de ${configName}`}
          empty={{
            title: 'Nenhuma execução ainda',
            description: 'Execute o backtest desta configuração para ver os resultados aqui.',
          }}
        />
      )}
    </div>
  );
}
