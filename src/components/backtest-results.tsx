'use client';

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { SectionHeader } from '@/components/ui/section-header';
import { InfoHint } from '@/components/ui/info-hint';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { AssetCell } from '@/components/asset/asset-cell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AXIS_TICK,
  ChartLegend,
  ChartTooltip,
  formatMonthLong,
  formatMonthShort,
  formatMonthTick,
  type ChartSeries
} from '@/components/portfolio-chart-parts';
import { BacktestTransactions } from './backtest-transactions';
import {
  cdiLevel,
  priceLevel,
  simulatePeriods,
  type BenchmarkData,
  type FlowPeriod
} from '@/lib/benchmark-service';
import {
  EMPTY_VALUE,
  formatBRL,
  formatBRLCompact,
  formatCompact,
  formatDeltaPct,
  formatNumber,
  formatPct
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { localMonthKey } from '@/app/backtest/backtest-utils';

interface BacktestResult {
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
  monthlyReturns: MonthlyReturn[];
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
    rebalanceAmount?: number;
    averagePrice?: number;
    totalShares?: number;
    totalDividends?: number;
  }>;
  portfolioEvolution: Array<{
    date: string;
    value: number;
    holdings: Record<string, number>;
    monthlyReturn: number;
  }>;
  dataValidation?: any;
  dataQualityIssues?: string[];
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  actualInvestment?: number;
  plannedInvestment?: number;
  missedContributions?: number;
  missedAmount?: number;
  /** Premissas da simulação (ausente em execuções salvas no banco). */
  assumptions?: {
    dividends: 'reinvested' | 'cash';
    jcpNetOfTax: boolean;
    tradingCostRate: number;
    totalTradingCosts: number;
  };
}

/** Mês simulado. Os campos opcionais existem nas execuções feitas a partir de outubro de 2026. */
interface MonthlyReturn {
  date: string;
  return: number;
  portfolioValue: number;
  contribution: number;
  /** Período de preços do mês (`YYYY-MM-DD`): do fechamento da compra ao da avaliação. */
  periodStart?: string;
  periodEnd?: string;
  /** Custos de operação do mês, em reais. */
  tradingCosts?: number;
  /** Proventos reais creditados no mês, em reais. */
  dividends?: number;
  /** Saldo com os mesmos aportes no CDI / no Ibovespa, calculado no servidor. */
  cdiValue?: number;
  ibovValue?: number;
}

/** Custo por operação usado pela simulação (corretagem + emolumentos). */
const TRADING_COST_RATE = 0.0003;

/**
 * Período de preços de um mês. As barras mensais vêm datadas no dia 1 com o fechamento do fim do mês: o mês
 * rotulado M compra no fechamento de M e avalia no de M+1. Execuções antigas não gravam o período; usa a mesma regra.
 */
function monthPeriod(month: Pick<MonthlyReturn, 'date' | 'periodStart' | 'periodEnd'>): { start: string; end: string } {
  if (month.periodStart && month.periodEnd) return { start: month.periodStart, end: month.periodEnd };
  const [year, monthNumber] = month.date.slice(0, 7).split('-').map(Number);
  const iso = (offset: number) => new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 10);
  return { start: iso(1), end: iso(2) };
}

type SimulationMethod = 'current' | 'legacy';

interface BacktestConfig {
  name: string;
  description?: string;
  assets: Array<{
    ticker: string;
    companyName?: string;
    allocation: number;
  }>;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
}

interface BacktestTransaction {
  id: string;
  month: number;
  date: string;
  ticker: string;
  transactionType: 'CONTRIBUTION' | 'REBALANCE_BUY' | 'REBALANCE_SELL' | 'CASH_RESERVE' | 'CASH_CREDIT' | 'CASH_DEBIT' | 'DIVIDEND_PAYMENT';
  contribution: number;
  price: number;
  sharesAdded: number;
  totalShares: number;
  dividendAmount?: number;
  totalInvested: number;
  cashReserved?: number | null;
  totalContribution: number;
  portfolioValue: number;
  cashBalance: number;
}

interface BacktestResultsProps {
  result: BacktestResult;
  validation?: any;
  config?: BacktestConfig | null;
  transactions?: BacktestTransaction[];
}

type AssetPerformance = BacktestResult['assetPerformance'][number];
type Tone = 'default' | 'positive' | 'negative';

interface MonthlyRow {
  date: string;
  portfolioValue: number;
  return: number;
  contribution: number;
  variation: number | null;
}

const SERIES: Record<'carteira' | 'cdi' | 'ibov', ChartSeries> = {
  carteira: { key: 'carteira', label: 'Carteira', color: 'var(--chart-1)' },
  cdi: { key: 'cdi', label: 'CDI', color: 'var(--chart-2)', dashed: true },
  ibov: { key: 'ibov', label: 'Ibovespa', color: 'var(--chart-3)', dashed: true },
};

const PANEL = 'rounded-lg border border-border bg-card p-4 sm:p-5';

/** Tom semântico só para ganho/perda. */
function toneOf(value: number | null | undefined): Tone {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return 'default';
  return value > 0 ? 'positive' : 'negative';
}

const TONE_CLASS: Record<Tone, string> = {
  default: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-negative',
};

/** Valor em reais para KPI: sem centavos até 1 milhão, compacto acima disso. */
function kpiBRL(value: number): string {
  return Math.abs(value) >= 1_000_000 ? formatBRLCompact(value) : formatBRL(value, { digits: 0 });
}

/** Chave de mês (ano × 12 + mês) de um rótulo "AAAA-MM-DD", com deslocamento opcional em dias. */
function labelMonthKey(dateString: string, addDays = 0): number {
  const [year, month, day] = dateString.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + addDays));
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthKeyLabel(key: number | null): string {
  if (key === null) return EMPTY_VALUE;
  return formatMonthShort(`${Math.floor(key / 12)}-${String((key % 12) + 1).padStart(2, '0')}-01`);
}

function monthsLabel(value: number): string {
  return `${formatNumber(value, { digits: 0 })} ${value === 1 ? 'mês' : 'meses'}`;
}

interface MetricRow {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
}

function MetricList({ title, rows }: { title: string; rows: Array<MetricRow | null | false> }) {
  return (
    <section className={PANEL}>
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <dl className="mt-3 divide-y divide-border text-sm">
        {rows.filter((row): row is MetricRow => Boolean(row)).map((row, index) => (
          <div key={index} className="flex items-start justify-between gap-4 py-2">
            <dt className="flex min-w-0 items-center gap-1 text-muted-foreground">
              {row.label}
              {row.hint && <InfoHint content={row.hint} />}
            </dt>
            <dd className={cn('shrink-0 text-right font-medium tabular-nums', TONE_CLASS[row.tone ?? 'default'])}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Rótulo de KPI que quebra linha em vez de truncar (grade de 2 colunas a 320 px)
function KpiLabel({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

export function BacktestResults({ result, config, transactions }: BacktestResultsProps) {
  const resultsTopRef = useRef<HTMLDivElement>(null);

  // Rola até o topo dos resultados quando um novo resultado é carregado
  useEffect(() => {
    if (resultsTopRef.current) {
      setTimeout(() => {
        resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);
  const [showBenchmarks, setShowBenchmarks] = useState(true);

  // Execuções novas trazem o saldo no CDI e no Ibovespa de cada mês (calculado no servidor com BCB e Yahoo).
  // Só execuções antigas buscam os benchmarks à parte.
  const serverBenchmarks = useMemo(() => {
    const months = result.monthlyReturns ?? [];
    if (months.length === 0) return null;
    const hasCdi = months.every(m => typeof m.cdiValue === 'number');
    const hasIbov = months.every(m => typeof m.ibovValue === 'number');
    return hasCdi || hasIbov ? { hasCdi, hasIbov } : null;
  }, [result.monthlyReturns]);

  // Período dos benchmarks (do primeiro aporte ao fim do último mês): chaves primitivas para não buscar de novo
  // quando só a identidade de `config` muda
  const hasConfig = !!config && !serverBenchmarks;
  const benchmarkRange = useMemo(() => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) return null;
    const periods = result.monthlyReturns.map(monthPeriod);
    const today = new Date().toISOString().slice(0, 10);
    const start = periods.reduce((min, p) => (p.start < min ? p.start : min), periods[0].start);
    const end = periods.reduce((max, p) => (p.end > max ? p.end : max), periods[0].end);
    return { start: start < today ? start : today, end: end < today ? end : today };
  }, [result.monthlyReturns]);
  const benchmarkStart = benchmarkRange?.start;
  const benchmarkEnd = benchmarkRange?.end;

  useEffect(() => {
    if (!hasConfig || !benchmarkStart || !benchmarkEnd) {
      setLoadingBenchmarks(false);
      return;
    }

    let cancelled = false;
    async function loadBenchmarks() {
      try {
        setLoadingBenchmarks(true);
        const response = await fetch(`/api/benchmarks?startDate=${benchmarkStart}&endDate=${benchmarkEnd}`);
        if (!response.ok) {
          throw new Error('Erro ao buscar benchmarks');
        }
        const data = await response.json();
        if (!cancelled) setBenchmarkData(data);
      } catch (error) {
        console.error('Erro ao carregar benchmarks:', error);
        if (!cancelled) setBenchmarkData(null);
      } finally {
        if (!cancelled) setLoadingBenchmarks(false);
      }
    }

    loadBenchmarks();
    return () => {
      cancelled = true;
    };
  }, [hasConfig, benchmarkStart, benchmarkEnd]);

  // Métricas derivadas. O ganho de capital já inclui os proventos reinvestidos no valor final.
  const capitalGain = result.finalValue - result.totalInvested;
  const totalDividends = result.totalDividendsReceived || 0;
  const totalGain = capitalGain;

  // Ganho total pela soma dos ativos (para explicar a diferença metodológica)
  const calculateTotalGainFromAssets = () => {
    if (!result.assetPerformance || result.assetPerformance.length === 0) {
      return totalGain;
    }

    let totalGainFromAssets = 0;
    result.assetPerformance.forEach(asset => {
      const directContribution = asset.contribution || 0;
      const reinvestment = asset.reinvestment || 0;
      const rebalanceInvestment = (asset.rebalanceAmount || 0) > 0 ? (asset.rebalanceAmount || 0) : 0;
      const totalInvestedInAsset = directContribution + reinvestment + rebalanceInvestment;

      const realizedProfits = (asset.rebalanceAmount || 0) < 0 ? Math.abs(asset.rebalanceAmount || 0) : 0;
      const assetGain = (asset.finalValue || 0) + realizedProfits - totalInvestedInAsset;

      totalGainFromAssets += assetGain;
    });

    return totalGainFromAssets;
  };

  const totalGainFromAssets = calculateTotalGainFromAssets();
  const totalMonths = (result.positiveMonths || 0) + (result.negativeMonths || 0);
  const consistencyRate = totalMonths > 0 ? ((result.positiveMonths || 0) / totalMonths) * 100 : 0;
  // Retorno médio mensal equivalente ao anualizado: (1 + retorno_anual)^(1/12) - 1
  const averageMonthlyReturn = result.annualizedReturn > -1
    ? Math.pow(1 + result.annualizedReturn, 1/12) - 1
    : 0;

  const calculateStreaks = () => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) {
      return { longestPositiveStreak: 0, longestNegativeStreak: 0 };
    }

    let longestPositiveStreak = 0;
    let longestNegativeStreak = 0;
    let currentPositiveStreak = 0;
    let currentNegativeStreak = 0;

    for (const month of result.monthlyReturns) {
      const monthReturn = month.return || 0;

      if (monthReturn > 0) {
        currentPositiveStreak++;
        currentNegativeStreak = 0;
        longestPositiveStreak = Math.max(longestPositiveStreak, currentPositiveStreak);
      } else if (monthReturn < 0) {
        currentNegativeStreak++;
        currentPositiveStreak = 0;
        longestNegativeStreak = Math.max(longestNegativeStreak, currentNegativeStreak);
      } else {
        currentPositiveStreak = 0;
        currentNegativeStreak = 0;
      }
    }

    return { longestPositiveStreak, longestNegativeStreak };
  };

  const { longestPositiveStreak, longestNegativeStreak } = calculateStreaks();

  // Métricas de recuperação após perdas
  const calculateRecoveryMetrics = () => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) {
      return {
        averageRecoveryTime: 0,
        maxRecoveryTime: 0,
        recoveryCount: 0,
        recoverySuccessRate: 0,
        avgLossBeforeRecovery: 0,
        recoveryPeriods: [],
        isCurrentlyInDrawdown: false,
        currentDrawdownDuration: 0
      };
    }

    const sortedReturns = [...result.monthlyReturns].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recoveryPeriods: Array<{
      startMonth: number;
      endMonth: number;
      duration: number;
      maxLoss: number;
      startValue: number;
      endValue: number;
      isComplete: boolean;
    }> = [];

    let currentPeak = sortedReturns[0]?.portfolioValue || 0;
    let currentPeakIndex = 0;
    let inDrawdown = false;
    let drawdownStartIndex = 0;
    let maxDrawdownInPeriod = 0;
    let drawdownStartValue = 0;

    for (let i = 1; i < sortedReturns.length; i++) {
      const currentValue = sortedReturns[i].portfolioValue;

      if (currentValue > currentPeak) {
        // Novo pico: se estava em drawdown, registra a recuperação completa
        if (inDrawdown) {
          const recoveryDuration = i - drawdownStartIndex;
          recoveryPeriods.push({
            startMonth: drawdownStartIndex,
            endMonth: i,
            duration: recoveryDuration,
            maxLoss: maxDrawdownInPeriod,
            startValue: drawdownStartValue,
            endValue: currentValue,
            isComplete: true
          });
          inDrawdown = false;
        }

        currentPeak = currentValue;
        currentPeakIndex = i;
        maxDrawdownInPeriod = 0;
      } else if (currentValue < currentPeak) {
        if (!inDrawdown) {
          inDrawdown = true;
          drawdownStartIndex = currentPeakIndex;
          drawdownStartValue = currentPeak;
        }

        const currentDrawdown = (currentPeak - currentValue) / currentPeak;
        maxDrawdownInPeriod = Math.max(maxDrawdownInPeriod, currentDrawdown);
      }
    }

    const finalValue = sortedReturns[sortedReturns.length - 1]?.portfolioValue || 0;
    const isCurrentlyInDrawdown = inDrawdown && finalValue < currentPeak;
    const currentDrawdownDuration = isCurrentlyInDrawdown ? sortedReturns.length - 1 - drawdownStartIndex : 0;

    // Só recuperações completas, com perda acima de 5% e que superaram o pico anterior
    const significantCompleteRecoveries = recoveryPeriods.filter(period =>
      period.maxLoss > 0.05 &&
      period.isComplete &&
      period.endValue > period.startValue
    );

    const averageRecoveryTime = significantCompleteRecoveries.length > 0
      ? significantCompleteRecoveries.reduce((sum, period) => sum + period.duration, 0) / significantCompleteRecoveries.length
      : 0;

    const maxRecoveryTime = significantCompleteRecoveries.length > 0
      ? Math.max(...significantCompleteRecoveries.map(period => period.duration))
      : 0;

    const avgLossBeforeRecovery = significantCompleteRecoveries.length > 0
      ? significantCompleteRecoveries.reduce((sum, period) => sum + period.maxLoss, 0) / significantCompleteRecoveries.length
      : 0;

    const allSignificantDrawdowns = recoveryPeriods.filter(period => period.maxLoss > 0.05).length +
      (isCurrentlyInDrawdown && maxDrawdownInPeriod > 0.05 ? 1 : 0);

    const recoverySuccessRate = allSignificantDrawdowns > 0
      ? (significantCompleteRecoveries.length / allSignificantDrawdowns) * 100
      : 100;

    return {
      averageRecoveryTime,
      maxRecoveryTime,
      recoveryCount: significantCompleteRecoveries.length,
      recoverySuccessRate,
      avgLossBeforeRecovery,
      recoveryPeriods: significantCompleteRecoveries,
      isCurrentlyInDrawdown,
      currentDrawdownDuration
    };
  };

  const recoveryMetrics = calculateRecoveryMetrics();

  // Dados do gráfico (carteira + CDI e Ibovespa simulados com os mesmos aportes)
  const chartData = useMemo(() => {
    if (!result.monthlyReturns || result.monthlyReturns.length === 0) return [];

    let sortedReturns = [...result.monthlyReturns].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Se o primeiro mês não veio nos retornos, infere pelo capital inicial + primeiro aporte
    if (transactions && transactions.length > 0) {
      const sortedTransactions = [...transactions].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstTransactionDate = sortedTransactions[0]?.date.split('T')[0];
      const firstReturnDate = sortedReturns[0]?.date.split('T')[0];

      if (firstReturnDate !== firstTransactionDate) {
        const firstMonthData = {
          date: firstTransactionDate,
          return: 0,
          portfolioValue: (config?.initialCapital || 0) + (config?.monthlyContribution || 0),
          contribution: (config?.initialCapital || 0) + (config?.monthlyContribution || 0),
        };

        sortedReturns = [firstMonthData, ...sortedReturns];
      }
    }

    const portfolioData = sortedReturns.map((month) => ({
      date: month.date,
      carteira: month.portfolioValue,
      contribution: month.contribution,
      return: month.return * 100,
    }));

    if (!showBenchmarks) return portfolioData;

    if (serverBenchmarks) {
      return portfolioData.map((data, index) => {
        const month: MonthlyReturn = sortedReturns[index];
        // Ponto inicial inferido (só o aporte): os benchmarks valem o mesmo aporte
        const inferred = !result.monthlyReturns.includes(month);
        return {
          ...data,
          cdi: serverBenchmarks.hasCdi ? (inferred ? month.portfolioValue : month.cdiValue ?? null) : null,
          ibov: serverBenchmarks.hasIbov ? (inferred ? month.portfolioValue : month.ibovValue ?? null) : null,
        };
      });
    }

    if (!benchmarkData || loadingBenchmarks || !config) return portfolioData;

    // Execuções antigas: CDI (capitalização diária) e Ibovespa recebendo os mesmos aportes no início do período de
    // preços de cada mês e medidos no fim dele
    const simulated = [...result.monthlyReturns].sort((a, b) => a.date.localeCompare(b.date));
    const periods = simulated.map(monthPeriod);
    const flows: FlowPeriod[] = simulated.map((month, index) => ({
      ...periods[index],
      amount: (index === 0 ? config.initialCapital || 0 : 0) + (month.contribution || 0),
    }));
    const cdiValues = benchmarkData.cdi.length > 0 ? simulatePeriods(cdiLevel(benchmarkData.cdi), flows) : [];
    const ibovValues = benchmarkData.ibov.length > 0 ? simulatePeriods(priceLevel(benchmarkData.ibov), flows) : [];
    const byDate = new Map(simulated.map((month, index) => [month.date, index]));

    return portfolioData.map((data, index) => {
      const month = sortedReturns[index];
      const position = byDate.get(month.date);
      if (position === undefined) return { ...data, cdi: month.portfolioValue, ibov: month.portfolioValue };
      return { ...data, cdi: cdiValues[position] ?? null, ibov: ibovValues[position] ?? null };
    });
  }, [result.monthlyReturns, serverBenchmarks, benchmarkData, showBenchmarks, loadingBenchmarks, config, transactions]);

  // Tabela mensal (mais recente primeiro), com a variação do patrimônio sobre o mês anterior
  const monthlyRows: MonthlyRow[] = useMemo(() => {
    const sorted = [...(result.monthlyReturns ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.map((month, index) => {
      const previous = sorted[index + 1];
      return {
        date: month.date,
        portfolioValue: month.portfolioValue || 0,
        return: month.return || 0,
        contribution: month.contribution || 0,
        variation: previous && previous.portfolioValue ? (month.portfolioValue - previous.portfolioValue) / previous.portfolioValue : null,
      };
    });
  }, [result.monthlyReturns]);

  // Custódia por ativo: quantidade final e preço médio calculados no backend
  const assetCustodyInfo = useMemo(() => {
    const custodyInfo: Record<string, { quantity: number; averagePrice: number; totalInvested: number }> = {};
    if (!result.portfolioEvolution || result.portfolioEvolution.length === 0 || !result.assetPerformance) {
      return custodyInfo;
    }

    const lastMonth = result.portfolioEvolution[result.portfolioEvolution.length - 1];
    result.assetPerformance.forEach(asset => {
      const directContribution = asset.contribution || 0;
      const reinvestment = asset.reinvestment || 0;
      const rebalanceInvestment = (asset.rebalanceAmount || 0) > 0 ? (asset.rebalanceAmount || 0) : 0;
      custodyInfo[asset.ticker] = {
        quantity: lastMonth?.holdings?.[asset.ticker] || 0,
        averagePrice: asset.averagePrice || 0,
        totalInvested: directContribution + reinvestment + rebalanceInvestment
      };
    });

    return custodyInfo;
  }, [result.portfolioEvolution, result.assetPerformance]);

  // Período efetivo x solicitado, por mês. Cada retorno mensal é rotulado no último dia do mês
  // (retorno de 1º/set a 1º/out → 30/09), então o fim efetivo é o dia seguinte ao último rótulo.
  const chronological = [...(result.monthlyReturns ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const effectiveStartKey = chronological.length > 0 ? labelMonthKey(chronological[0].date) : null;
  const effectiveEndKey = chronological.length > 0 ? labelMonthKey(chronological[chronological.length - 1].date, 1) : null;
  const requestedStartKey = config?.startDate ? localMonthKey(config.startDate) : null;
  const requestedEndKey = config?.endDate ? localMonthKey(config.endDate) : null;

  const periodAdjusted =
    effectiveStartKey !== null && effectiveEndKey !== null && requestedStartKey !== null && requestedEndKey !== null &&
    (effectiveStartKey !== requestedStartKey || effectiveEndKey !== requestedEndKey);

  const monthlyReturnValues = (result.monthlyReturns ?? []).map(m => m.return);
  const bestMonth = monthlyReturnValues.length > 0 ? Math.max(...monthlyReturnValues) : null;
  const worstMonth = monthlyReturnValues.length > 0 ? Math.min(...monthlyReturnValues) : null;

  const benchmarksLoading = !serverBenchmarks && loadingBenchmarks;
  const benchmarksReady = !!serverBenchmarks || (!!benchmarkData && !loadingBenchmarks);
  const hasCDI = serverBenchmarks ? serverBenchmarks.hasCdi : !!benchmarkData?.cdi && benchmarkData.cdi.length > 0;
  const hasIBOV = serverBenchmarks ? serverBenchmarks.hasIbov : !!benchmarkData?.ibov && benchmarkData.ibov.length > 0;
  const visibleSeries: ChartSeries[] = [
    SERIES.carteira,
    ...(showBenchmarks && hasCDI ? [SERIES.cdi] : []),
    ...(showBenchmarks && hasIBOV ? [SERIES.ibov] : []),
  ];

  // Comparação final com os benchmarks (retorno sobre o capital investido, em %)
  const benchmarkSummary = (() => {
    if (!showBenchmarks || !benchmarksReady || chartData.length === 0) return null;
    const last = chartData[chartData.length - 1] as { carteira: number; cdi?: number | null; ibov?: number | null };
    const finalCarteira = last?.carteira || 0;
    const finalCDI = last?.cdi || 0;
    const finalIBOV = last?.ibov || 0;
    const invested = result.totalInvested;
    const pct = (final: number) => (invested > 0 ? ((final - invested) / invested) * 100 : 0);
    return {
      carteira: { final: finalCarteira, returnPct: pct(finalCarteira) },
      cdi: hasCDI ? { final: finalCDI, returnPct: pct(finalCDI) } : null,
      ibov: hasIBOV ? { final: finalIBOV, returnPct: pct(finalIBOV) } : null,
    };
  })();

  const comparisonSentence = (() => {
    if (!benchmarkSummary) return null;
    const parts: string[] = [];
    const describe = (name: string, bench: { returnPct: number } | null) => {
      if (!bench) return;
      const diff = benchmarkSummary.carteira.returnPct - bench.returnPct;
      const abs = formatNumber(Math.abs(diff), { digits: 1 });
      parts.push(diff >= 0 ? `${abs} p.p. acima do ${name}` : `${abs} p.p. abaixo do ${name}`);
    };
    describe('CDI', benchmarkSummary.cdi);
    describe('Ibovespa', benchmarkSummary.ibov);
    return parts.length > 0 ? `No período, a carteira ficou ${parts.join(' e ')}.` : null;
  })();

  const assetColumns: DataTableColumn<AssetPerformance>[] = [
    {
      key: 'ticker',
      header: 'Ativo',
      sticky: true,
      cell: a => (
        <AssetCell
          ticker={a.ticker}
          name={config?.assets?.find(c => c.ticker === a.ticker)?.companyName}
          className="max-w-36 sm:max-w-52"
        />
      ),
    },
    { key: 'allocation', header: 'Peso', align: 'right', sortable: true, cell: a => formatPct(a.allocation || 0) },
    { key: 'finalValue', header: 'Valor final', align: 'right', sortable: true, cell: a => formatBRL(a.finalValue || 0) },
    {
      key: 'totalReturn',
      header: 'Retorno',
      align: 'right',
      sortable: true,
      cell: a => <span className={TONE_CLASS[toneOf(a.totalReturn)]}>{formatDeltaPct(a.totalReturn || 0)}</span>,
    },
    { key: 'contribution', header: 'Aportes diretos', align: 'right', cell: a => formatBRL(a.contribution || 0) },
    {
      key: 'reinvestment',
      header: 'Proventos e sobras',
      align: 'right',
      hint: 'Proventos e sobras de caixa reinvestidos no ativo.',
      cell: a => formatBRL(a.reinvestment || 0),
    },
    {
      key: 'rebalanceAmount',
      header: 'Rebalanceamento',
      align: 'right',
      hint: 'Positivo: valor aplicado no ativo pelos rebalanceamentos. Negativo: valor retirado (lucro realizado).',
      cell: a => formatBRL(a.rebalanceAmount || 0),
    },
    {
      key: 'quantity',
      header: 'Qtd. final',
      align: 'right',
      cell: a => (assetCustodyInfo[a.ticker] ? formatNumber(assetCustodyInfo[a.ticker].quantity) : EMPTY_VALUE),
    },
    {
      key: 'averagePrice',
      header: 'Preço médio',
      align: 'right',
      cell: a => (assetCustodyInfo[a.ticker] ? formatBRL(assetCustodyInfo[a.ticker].averagePrice) : EMPTY_VALUE),
    },
  ];

  const renderAssetDetails = (asset: AssetPerformance) => {
    const custodyInfo = assetCustodyInfo[asset.ticker];
    if (!custodyInfo) return <p className="text-sm text-muted-foreground">Sem dados de custódia para este ativo.</p>;
    const rebalance = asset.rebalanceAmount || 0;
    const realizedProfits = rebalance < 0 ? Math.abs(rebalance) : 0;
    const assetGain = (asset.finalValue || 0) + realizedProfits - custodyInfo.totalInvested;
    return (
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Posição final</dt>
          <dd className="tabular-nums text-foreground">
            {formatNumber(custodyInfo.quantity)} ações × {formatBRL(custodyInfo.averagePrice)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total aportado</dt>
          <dd className="tabular-nums text-foreground">{formatBRL(custodyInfo.totalInvested)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lucro realizado</dt>
          <dd className="tabular-nums text-foreground">{realizedProfits > 0 ? formatBRL(realizedProfits) : EMPTY_VALUE}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ganho total</dt>
          <dd className={cn('font-medium tabular-nums', TONE_CLASS[toneOf(assetGain)])}>{formatBRL(assetGain)}</dd>
        </div>
        <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-4">
          Ganho total = valor atual ({formatBRL(asset.finalValue || 0)}) + lucro realizado ({formatBRL(realizedProfits)}) − total
          aportado ({formatBRL(custodyInfo.totalInvested)}). O total aportado soma aportes diretos (
          {formatBRL(asset.contribution || 0)}), proventos e sobras ({formatBRL(asset.reinvestment || 0)})
          {rebalance > 0 ? ` e ${formatBRL(rebalance)} aplicados por rebalanceamento` : ''}.
        </p>
      </dl>
    );
  };

  const monthlyColumns: DataTableColumn<MonthlyRow>[] = [
    { key: 'date', header: 'Mês', sticky: true, cell: m => <span className="whitespace-nowrap">{formatMonthShort(m.date)}</span> },
    { key: 'portfolioValue', header: 'Valor da carteira', align: 'right', cell: m => formatBRL(m.portfolioValue) },
    {
      key: 'return',
      header: 'Retorno mensal',
      align: 'right',
      cell: m => <span className={TONE_CLASS[toneOf(m.return)]}>{formatDeltaPct(m.return, { digits: 2 })}</span>,
    },
    { key: 'contribution', header: 'Aporte', align: 'right', cell: m => formatBRL(m.contribution) },
    {
      key: 'variation',
      header: 'Variação do patrimônio',
      align: 'right',
      hint: 'Inclui o efeito dos aportes do mês.',
      cell: m => <span className={TONE_CLASS[toneOf(m.variation)]}>{formatDeltaPct(m.variation, { digits: 2 })}</span>,
    },
  ];

  const sharpeValue = typeof result.sharpeRatio === 'number' ? formatNumber(result.sharpeRatio, { digits: 2 }) : EMPTY_VALUE;
  // Premissas que valeram para esta execução. Execução recém-calculada traz `assumptions`; execução reaberta do banco
  // é reconhecida pelos custos gravados em cada mês (só existem na metodologia atual).
  const savedCosts = (result.monthlyReturns ?? []).filter(m => typeof m.tradingCosts === 'number');
  const method: SimulationMethod = result.assumptions || savedCosts.length > 0 ? 'current' : 'legacy';
  const assumptions = result.assumptions ?? (method === 'current'
    ? {
        dividends: 'reinvested' as const,
        jcpNetOfTax: true,
        tradingCostRate: TRADING_COST_RATE,
        totalTradingCosts: savedCosts.reduce((total, m) => total + (m.tradingCosts ?? 0), 0),
      }
    : null);
  const chartAssumption =
    'CDI e Ibovespa no gráfico recebem os mesmos aportes, aplicados no fechamento usado na compra de cada mês. O Ibovespa é índice de preço, sem proventos.';
  const assumptionItems = assumptions
    ? [
        'Preços de fechamento ajustados só por desdobramentos e grupamentos, sem desconto de proventos.',
        `Proventos reais (dividendos e JCP) creditados pela data-com e ${
          assumptions.dividends === 'cash' ? 'mantidos em caixa' : 'reinvestidos no mês seguinte'
        }. JCP líquido de IRRF (15% até 2025, 17,5% a partir de 2026).`,
        `Custo de ${formatPct(assumptions.tradingCostRate, { digits: 2 })} por compra ou venda (corretagem e emolumentos): ${formatBRL(
          assumptions.totalTradingCosts
        )} no período.`,
        'Retorno anualizado, volatilidade e queda máxima medidos pela cota; Sharpe com o CDI do mesmo período.',
        chartAssumption,
        'Impostos sobre ganho de capital e spread não são considerados.',
      ]
    : [
        'Preços de fechamento ajustados por proventos.',
        'Proventos estimados pelo dividend yield médio informado e creditados em março, agosto e outubro, além do ajuste do preço.',
        'Sem custos de operação.',
        'Sharpe com taxa livre de risco fixa de 10% ao ano.',
        chartAssumption,
        'Impostos sobre ganho de capital e spread não são considerados.',
      ];

  const volatilityReading =
    result.volatility < 0.15 ? 'Volatilidade baixa: oscilações contidas.' :
    result.volatility < 0.25 ? 'Volatilidade moderada.' :
    'Volatilidade alta: oscilações fortes mês a mês.';

  const drawdownReading =
    result.maxDrawdown < 0.10 ? 'Queda máxima pequena no período.' :
    result.maxDrawdown < 0.20 ? 'Queda máxima moderada no período.' :
    'Queda máxima expressiva: houve perdas relevantes do pico ao vale.';

  const currentDrawdownReading = recoveryMetrics.isCurrentlyInDrawdown
    ? recoveryMetrics.currentDrawdownDuration < 6 ? 'A carteira está abaixo do último pico há poucos meses.' :
      recoveryMetrics.currentDrawdownDuration < 12 ? 'A carteira está abaixo do último pico há quase um ano.' :
      recoveryMetrics.currentDrawdownDuration < 24 ? 'A carteira está abaixo do último pico há mais de um ano.' :
      'A carteira está abaixo do último pico há mais de dois anos; vale revisar a estratégia.'
    : null;

  const recoveryReading = !recoveryMetrics.isCurrentlyInDrawdown && recoveryMetrics.recoveryCount > 0
    ? recoveryMetrics.averageRecoveryTime < 3 ? 'Recuperações rápidas após as quedas.' :
      recoveryMetrics.averageRecoveryTime < 6 ? 'Recuperações em prazo moderado.' :
      recoveryMetrics.averageRecoveryTime < 12 ? 'Recuperações lentas: exigiram paciência.' :
      'Recuperações muito lentas após as quedas.'
    : null;

  const riskFreeName = method === 'legacy' ? 'da taxa de 10% ao ano' : 'do CDI';
  const sharpeReading = typeof result.sharpeRatio === 'number'
    ? result.sharpeRatio > 1 ? 'Sharpe acima de 1: retorno alto para o risco assumido.' :
      result.sharpeRatio > 0.5 ? 'Sharpe entre 0,5 e 1: retorno adequado para o risco.' :
      result.sharpeRatio > 0 ? `Sharpe entre 0 e 0,5: pouco retorno acima ${riskFreeName} para o risco assumido.` :
      `Sharpe negativo: a carteira rendeu menos que ${method === 'legacy' ? 'a taxa de 10% ao ano' : 'o CDI'} no período.`
    : null;

  const readings = [
    volatilityReading,
    drawdownReading,
    currentDrawdownReading,
    recoveryReading,
    recoveryMetrics.isCurrentlyInDrawdown && recoveryMetrics.recoveryCount > 0
      ? `Recuperações anteriores levaram em média ${formatNumber(recoveryMetrics.averageRecoveryTime, { digits: 1 })} meses.`
      : null,
    !recoveryMetrics.isCurrentlyInDrawdown && recoveryMetrics.maxRecoveryTime > recoveryMetrics.averageRecoveryTime * 2
      ? `A recuperação mais longa levou ${monthsLabel(recoveryMetrics.maxRecoveryTime)}.`
      : null,
    sharpeReading,
    recoveryMetrics.recoveryCount === 0 && !recoveryMetrics.isCurrentlyInDrawdown
      ? 'A carteira não teve quedas acima de 5% no período analisado.'
      : null,
  ].filter((text): text is string => Boolean(text));

  return (
    <div ref={resultsTopRef} className="scroll-mt-24 space-y-6">
      {periodAdjusted && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">Período ajustado ao histórico disponível</p>
            <p className="text-muted-foreground">
              Solicitado: {monthKeyLabel(requestedStartKey)} – {monthKeyLabel(requestedEndKey)}. Simulado:{' '}
              {monthKeyLabel(effectiveStartKey)} – {monthKeyLabel(effectiveEndKey)}, intervalo em que todos os ativos têm cotações.
            </p>
            {result.dataQualityIssues && result.dataQualityIssues.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {result.dataQualityIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {config && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <span className="min-w-0 truncate font-medium text-foreground">{config.name}</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap tabular-nums">{config.assets?.length || 0} ativos</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap tabular-nums">{(result.monthlyReturns?.length || 0) + 1} meses</span>
        </p>
      )}

      {/* KPIs: uma linha de Stats neutros; cor apenas em ganho/perda */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Stat className="bg-card p-3 sm:p-4" label={<KpiLabel>Valor final</KpiLabel>} value={kpiBRL(result.finalValue)} delta={result.totalReturn} deltaLabel="no período" />
        <Stat
          className="bg-card p-3 sm:p-4"
          label={<KpiLabel>Ganho total</KpiLabel>}
          value={kpiBRL(totalGain)}
          tone={toneOf(totalGain)}
          caption={`Investido ${kpiBRL(result.totalInvested)}`}
        />
        <Stat
          className="bg-card p-3 sm:p-4"
          label={<KpiLabel>Retorno anualizado</KpiLabel>}
          value={formatDeltaPct(result.annualizedReturn)}
          tone={toneOf(result.annualizedReturn)}
          hint="Retorno composto por ano medido pela cota, sem o efeito dos aportes."
        />
        <Stat
          className="bg-card p-3 sm:p-4"
          label={<KpiLabel>Volatilidade</KpiLabel>}
          value={formatPct(result.volatility)}
          caption="anualizada"
          hint="Desvio padrão dos retornos mensais, anualizado."
        />
        <Stat
          className="bg-card p-3 sm:p-4"
          label={<KpiLabel>Índice de Sharpe</KpiLabel>}
          value={sharpeValue}
          caption={method === 'legacy' ? 'taxa fixa de 10%' : 'com CDI'}
          hint={method === 'legacy'
            ? '(Retorno anualizado − 10% ao ano) ÷ volatilidade anualizada. Simulação salva antes da troca para o CDI.'
            : '(Retorno anualizado − CDI do mesmo período) ÷ volatilidade anualizada. Perto de zero: rendeu o mesmo que o CDI para o risco assumido.'}
        />
        <Stat
          className="bg-card p-3 sm:p-4"
          label={<KpiLabel>Drawdown máximo</KpiLabel>}
          value={formatPct(-result.maxDrawdown)}
          hint="Maior queda do pico ao vale no período."
        />
      </div>

      {/* Evolução comparada */}
      <section aria-labelledby="backtest-chart-title" className={cn(PANEL, 'space-y-4')}>
        <SectionHeader
          as="h3"
          id="backtest-chart-title"
          title="Evolução do patrimônio"
          description="Carteira comparada ao mesmo valor aplicado no CDI e no Ibovespa, com os mesmos aportes."
          actions={
            benchmarksReady && (hasCDI || hasIBOV) ? (
              <Button variant="outline" size="sm" onClick={() => setShowBenchmarks(!showBenchmarks)} aria-pressed={showBenchmarks}>
                {showBenchmarks ? 'Ocultar CDI e Ibovespa' : 'Mostrar CDI e Ibovespa'}
              </Button>
            ) : null
          }
        />

        {benchmarksLoading ? (
          <Skeleton className="h-72 w-full sm:h-80" />
        ) : chartData.length > 0 ? (
          <>
            <ChartLegend series={visibleSeries} />
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatMonthTick}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(value: number) => formatCompact(value)}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--border)' }}
                    content={(props) => (
                      <ChartTooltip
                        active={props.active}
                        label={props.label as string}
                        payload={props.payload as never}
                        series={visibleSeries}
                        formatLabel={formatMonthLong}
                        formatValue={(value) => formatBRL(value)}
                      />
                    )}
                  />
                  {visibleSeries.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      stroke={series.color}
                      strokeWidth={series.dashed ? 1.5 : 2}
                      strokeDasharray={series.dashed ? '4 3' : undefined}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground sm:h-80">
            Nenhum dado disponível para o gráfico
          </div>
        )}

        {benchmarkSummary && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-3 gap-4">
              <Stat
                size="sm"
                label="Carteira"
                value={formatDeltaPct(benchmarkSummary.carteira.returnPct / 100)}
                tone={toneOf(benchmarkSummary.carteira.returnPct)}
                caption={kpiBRL(benchmarkSummary.carteira.final)}
              />
              {benchmarkSummary.cdi && (
                <Stat
                  size="sm"
                  label="CDI"
                  value={formatDeltaPct(benchmarkSummary.cdi.returnPct / 100)}
                  tone={toneOf(benchmarkSummary.cdi.returnPct)}
                  caption={kpiBRL(benchmarkSummary.cdi.final)}
                />
              )}
              {benchmarkSummary.ibov && (
                <Stat
                  size="sm"
                  label="Ibovespa"
                  value={formatDeltaPct(benchmarkSummary.ibov.returnPct / 100)}
                  tone={toneOf(benchmarkSummary.ibov.returnPct)}
                  caption={kpiBRL(benchmarkSummary.ibov.final)}
                />
              )}
            </div>
            {comparisonSentence && <p className="text-sm text-muted-foreground">{comparisonSentence}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="backtest-assumptions-title" className={cn(PANEL, 'space-y-3')}>
        <h3 id="backtest-assumptions-title" className="text-sm font-medium text-foreground">
          Premissas da simulação
        </h3>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground marker:text-border">
          {assumptionItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {method === 'legacy' && (
          <p className="text-xs leading-5 text-muted-foreground">
            Esta execução foi salva com a metodologia anterior, que pode contar proventos em dobro. Rode a simulação de
            novo para ver o resultado com os proventos reais e os custos de operação.
          </p>
        )}
      </section>

      {/* Detalhes */}
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="underline">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="assets">Por ativo</TabsTrigger>
          <TabsTrigger value="evolution">Mensal</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="risk">Risco</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricList
              title="Resumo financeiro"
              rows={[
                { label: 'Capital próprio investido', value: formatBRL(result.totalInvested) },
                result.finalCashReserve !== undefined && { label: 'Saldo em caixa', value: formatBRL(result.finalCashReserve || 0) },
                totalDividends > 0 && {
                  label: assumptions?.dividends === 'cash' ? 'Proventos recebidos' : 'Proventos recebidos e reinvestidos',
                  value: formatBRL(totalDividends),
                  hint: method === 'legacy'
                    ? 'Estimados pelo dividend yield médio (metodologia anterior); já estão incluídos no valor final.'
                    : 'Proventos reais pela data-com (JCP líquido de IRRF); já estão incluídos no valor final e no ganho total.',
                },
                totalDividends > 0 && result.totalInvested > 0 && {
                  label: 'Proventos sobre o investido',
                  value: formatPct(totalDividends / result.totalInvested, { digits: 2 }),
                },
                {
                  label: 'Retorno médio mensal',
                  value: formatDeltaPct(averageMonthlyReturn, { digits: 2 }),
                  tone: toneOf(averageMonthlyReturn),
                  hint: 'Equivalente mensal do retorno anualizado (composto).',
                },
              ]}
            />
            <MetricList
              title="Estatísticas"
              rows={[
                {
                  label: 'Meses positivos',
                  value: (
                    <>
                      {formatPct(consistencyRate / 100)}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({result.positiveMonths}/{result.positiveMonths + result.negativeMonths})
                      </span>
                    </>
                  ),
                },
                {
                  label: 'Tempo de recuperação',
                  value: recoveryMetrics.isCurrentlyInDrawdown
                    ? `Abaixo do pico há ${monthsLabel(recoveryMetrics.currentDrawdownDuration)}`
                    : recoveryMetrics.averageRecoveryTime > 0
                      ? `${formatNumber(recoveryMetrics.averageRecoveryTime, { digits: 1 })} meses (média)`
                      : 'Sem quedas acima de 5%',
                },
                { label: 'Melhor mês', value: formatDeltaPct(bestMonth, { digits: 2 }), tone: toneOf(bestMonth) },
                { label: 'Pior mês', value: formatDeltaPct(worstMonth, { digits: 2 }), tone: toneOf(worstMonth) },
                { label: 'Maior sequência positiva', value: monthsLabel(longestPositiveStreak) },
                { label: 'Maior sequência negativa', value: monthsLabel(longestNegativeStreak) },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-3">
          {Math.abs(totalGain - totalGainFromAssets) > 0.01 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              A soma dos ganhos por ativo ({formatBRL(totalGainFromAssets)}) difere do ganho da carteira ({formatBRL(totalGain)}).
              <InfoHint
                label="Por que os valores diferem"
                content="Os ganhos por ativo tratam proventos e sobras reinvestidos como custo; o ganho da carteira mede o retorno sobre o capital próprio investido."
              />
            </p>
          )}
          <DataTable
            columns={assetColumns}
            rows={result.assetPerformance ?? []}
            getRowId={a => a.ticker}
            renderExpanded={renderAssetDetails}
            caption="Resultado por ativo"
            empty={{ title: 'Nenhum dado por ativo disponível' }}
          />
        </TabsContent>

        <TabsContent value="evolution">
          <DataTable
            columns={monthlyColumns}
            rows={monthlyRows}
            getRowId={m => m.date}
            dense
            maxHeight={560}
            caption="Dados mensais do backtest"
            empty={{ title: 'Nenhum dado mensal disponível' }}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <BacktestTransactions transactions={transactions || []} />
        </TabsContent>

        <TabsContent value="risk">
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricList
              title="Métricas de risco"
              rows={[
                { label: 'Volatilidade anualizada', value: formatPct(result.volatility) },
                { label: 'Drawdown máximo', value: formatPct(-result.maxDrawdown) },
                { label: method === 'legacy' ? 'Índice de Sharpe (10% a.a.)' : 'Índice de Sharpe (CDI)', value: sharpeValue },
                { label: 'Desvio padrão mensal', value: formatPct(result.volatility / Math.sqrt(12)) },
              ]}
            />
            <MetricList
              title="Recuperação"
              rows={[
                recoveryMetrics.isCurrentlyInDrawdown && { label: 'Situação atual', value: 'Abaixo do último pico' },
                recoveryMetrics.isCurrentlyInDrawdown && {
                  label: 'Tempo abaixo do pico',
                  value: monthsLabel(recoveryMetrics.currentDrawdownDuration),
                },
                {
                  label: 'Recuperações completas',
                  value: formatNumber(recoveryMetrics.recoveryCount, { digits: 0 }),
                  hint: 'Quedas acima de 5% em que a carteira voltou a superar o pico anterior.',
                },
                recoveryMetrics.recoveryCount > 0 && {
                  label: 'Tempo médio de recuperação',
                  value: `${formatNumber(recoveryMetrics.averageRecoveryTime, { digits: 1 })} meses`,
                },
                recoveryMetrics.recoveryCount > 0 && {
                  label: 'Maior tempo de recuperação',
                  value: monthsLabel(recoveryMetrics.maxRecoveryTime),
                },
                recoveryMetrics.recoveryCount > 0 && {
                  label: 'Queda média antes da recuperação',
                  value: formatPct(-recoveryMetrics.avgLossBeforeRecovery),
                },
                {
                  label: 'Taxa de recuperação',
                  value: formatPct(recoveryMetrics.recoverySuccessRate / 100, { digits: 0 }),
                },
              ]}
            />
            <section className={PANEL}>
              <h4 className="text-sm font-medium text-foreground">Leitura dos números</h4>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground marker:text-border">
                {readings.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {!periodAdjusted && result.dataQualityIssues && result.dataQualityIssues.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Observações sobre os dados</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {result.dataQualityIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
