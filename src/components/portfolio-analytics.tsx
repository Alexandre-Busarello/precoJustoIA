"use client";

import type { ReactElement, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { InfoHint } from "@/components/ui/info-hint";
import { EMPTY_VALUE, formatBRL, formatBRLCompact, formatDeltaPct, formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { portfolioCache } from "@/lib/portfolio-cache";
import {
  AXIS_TICK,
  ChartLegend,
  ChartTooltip,
  formatMonthLong,
  formatMonthShort,
  formatMonthTick,
  type ChartSeries,
} from "@/components/portfolio-chart-parts";
import { returnToneClass } from "@/components/portfolio-page-shell";

interface PortfolioAnalyticsProps {
  portfolioId: string;
}

/** Percentuais desta API vêm em pontos percentuais (12,3 = 12,3%); valores de patrimônio em reais. */
interface AnalyticsData {
  evolution: Array<{
    date: string;
    value: number;
    invested: number;
    cashBalance: number;
    return: number;
    returnAmount: number;
  }>;
  /** Retorno acumulado por cota (carteira) e dos benchmarks, em pontos percentuais; `null` sem dados. */
  benchmarkComparison: Array<{
    date: string;
    portfolio: number;
    cdi: number | null;
    ibovespa: number | null;
    ipca: number | null;
    ipcaPlus6: number | null;
  }>;
  /** Métricas de rentabilidade em frações (0,12 = 12%). */
  performance: {
    startDate: string;
    endDate: string;
    days: number;
    twr: number;
    twrAnnualized: number | null;
    xirr: number | null;
    capitalReturn: number;
    volatility: number | null;
    sharpe: number | null;
    benchmarks: {
      cdi: number | null;
      ibovespa: number | null;
      ipca: number | null;
      ipcaPlus6: number | null;
    };
  };
  monthlyReturns: Array<{
    date: string;
    return: number;
  }>;
  drawdownHistory: Array<{
    date: string;
    drawdown: number;
    isInDrawdown: boolean;
    peak: number;
    value: number;
  }>;
  drawdownPeriods: Array<{
    startDate: string;
    endDate: string | null;
    duration: number;
    depth: number;
    recovered: boolean;
  }>;
  summary: {
    totalReturn: number;
    cdiReturn: number;
    ibovespaReturn: number;
    outperformanceCDI: number;
    outperformanceIbovespa: number;
    bestMonth: {
      date: string;
      return: number;
    };
    worstMonth: {
      date: string;
      return: number;
    };
    averageMonthlyReturn: number;
    volatility: number;
    currentDrawdown: number;
    maxDrawdownDepth: number;
    averageRecoveryTime: number;
    drawdownCount: number;
  };
}

type DrawdownPeriod = AnalyticsData["drawdownPeriods"][number];
type MonthlyReturn = AnalyticsData["monthlyReturns"][number];

/** Pontos percentuais → fração. */
const pp = (value: number) => value / 100;

function toneOf(value: number): "default" | "positive" | "negative" {
  if (Math.round(Math.abs(value) * 10) === 0) return "default";
  return value > 0 ? "positive" : "negative";
}

/** Diferença em pontos percentuais com sinal: `+2,3 p.p.` / `−1,0 p.p.`. */
function formatPoints(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const body = `${formatNumber(Math.abs(rounded), { digits: 1 })} p.p.`;
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `−${body}`;
  return body;
}

/** Eixo de patrimônio compacto: `R$ 850`, `R$ 12 mil`, `R$ 1,2 mi`. */
function formatMoneyTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return formatBRLCompact(value);
  if (abs >= 1e3) return `R$ ${formatNumber(value / 1e3, { digits: 0 })} mil`;
  return formatBRL(value, { digits: 0 });
}

/** Rótulo do tooltip: o último ponto é o mês corrente ("Atual"). */
function tooltipLabel(date: string, points: Array<{ date: string }>): string {
  const isLast = points.length > 0 && points[points.length - 1]?.date === date;
  return isLast ? `Atual (${formatMonthShort(date)})` : formatMonthShort(date);
}

const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const GRID = <CartesianGrid stroke="var(--border)" vertical={false} />;

function ChartFrame({ children, legend }: { children: ReactElement; legend?: ReactNode }) {
  return (
    <figure className="space-y-3">
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {legend}
    </figure>
  );
}

const EVOLUTION_SERIES: ChartSeries[] = [
  { key: "value", label: "Patrimônio", color: "var(--chart-1)" },
  { key: "invested", label: "Investido", color: "var(--chart-2)", dashed: true },
];

/** Carteira em chart-1; benchmarks em chart-2 com tracejados distintos. */
const BENCHMARK_SERIES: Array<ChartSeries & { dash?: string }> = [
  { key: "portfolio", label: "Carteira (cota)", color: "var(--chart-1)" },
  { key: "cdi", label: "CDI", color: "var(--chart-2)", dashed: true, dash: "6 3" },
  { key: "ibovespa", label: "Ibovespa", color: "var(--chart-2)", dashed: true, dash: "2 3" },
  { key: "ipca", label: "IPCA", color: "var(--chart-2)", dashed: true, dash: "10 3 2 3" },
];

/** Legenda com o tracejado real de cada série (CDI, Ibovespa e IPCA usam a mesma cor). */
function BenchmarkLegend({ series }: { series: Array<ChartSeries & { dash?: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <svg width="24" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="24" y2="2" stroke={item.color} strokeWidth="2" strokeDasharray={item.dash} />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Rótulo de KPI que quebra linha em vez de truncar (grade de 2 colunas a 320 px). */
function KpiLabel({ children }: { children: ReactNode }) {
  return <span className="whitespace-normal">{children}</span>;
}

/** Fração com sinal ou "—". */
function formatOptionalDelta(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? formatDeltaPct(value) : EMPTY_VALUE;
}

const DRAWDOWN_SERIES: ChartSeries[] = [{ key: "drawdown", label: "Queda desde o pico", color: "var(--negative)" }];
const MONTHLY_SERIES: ChartSeries[] = [{ key: "return", label: "Retorno", color: "var(--chart-1)" }];

const drawdownColumns: DataTableColumn<DrawdownPeriod>[] = [
  { key: "startDate", header: "Início", cell: (p) => formatMonthShort(p.startDate) },
  { key: "endDate", header: "Fim", cell: (p) => (p.endDate ? formatMonthShort(p.endDate) : "—") },
  {
    key: "depth",
    header: "Profundidade",
    align: "right",
    sortable: true,
    cell: (p) => <span className="font-medium text-negative">{formatDeltaPct(-pp(Math.abs(p.depth)))}</span>,
  },
  {
    key: "duration",
    header: "Duração",
    align: "right",
    sortable: true,
    cell: (p) => `${p.duration} ${p.duration === 1 ? "mês" : "meses"}`,
  },
  {
    key: "recovered",
    header: "Status",
    cell: (p) => <Badge variant={p.recovered ? "neutral" : "warning"}>{p.recovered ? "Recuperado" : "Em curso"}</Badge>,
  },
];

const monthlyColumns: DataTableColumn<MonthlyReturn>[] = [
  { key: "date", header: "Mês", sortable: true, cell: (m) => formatMonthLong(m.date) },
  {
    key: "return",
    header: "Retorno",
    align: "right",
    sortable: true,
    cell: (m) => <span className={cn("font-medium", returnToneClass(pp(m.return)))}>{formatDeltaPct(pp(m.return), { digits: 2 })}</span>,
  },
];

export function PortfolioAnalytics({ portfolioId }: PortfolioAnalyticsProps) {
  const {
    data: analytics,
    isLoading: loading,
    error: analyticsError,
    refetch,
  } = useQuery({
    queryKey: ["portfolio-analytics", portfolioId],
    queryFn: async (): Promise<AnalyticsData> => {
      const response = await fetch(`/api/portfolio/${portfolioId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only">Calculando análises</span>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div role="alert" className="rounded-lg border border-border px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Não foi possível carregar as análises</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!analytics || analytics.evolution.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Ainda não há dados suficientes</p>
        <p className="mt-1 text-sm text-muted-foreground">Registre transações para ver a evolução da carteira.</p>
      </div>
    );
  }

  const { summary, performance } = analytics;
  const averageMonthly = summary.averageMonthlyReturn;
  const { benchmarks } = performance;
  const shortPeriod = performance.days < 365;
  const versus = (benchmark: number | null) => (benchmark === null ? null : (performance.twr - benchmark) * 100);
  const versusIpcaPlus = versus(benchmarks.ipcaPlus6);
  // Com menos de um ano, a TIR aparece acumulada no período (como a TWR), sem anualizar
  const xirrShown =
    performance.xirr === null ? null : shortPeriod ? (1 + performance.xirr) ** (Math.max(performance.days, 0) / 365) - 1 : performance.xirr;

  return (
    <div className="space-y-8">
      <section aria-label="Resumo do desempenho" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
          <Stat
            label={<KpiLabel>Rentabilidade (TWR)</KpiLabel>}
            value={formatDeltaPct(performance.twr)}
            tone={toneOf(performance.twr * 100)}
            caption={performance.twrAnnualized !== null ? `${formatDeltaPct(performance.twrAnnualized)} ao ano` : "Por cota, no período"}
            hint="Rentabilidade por cota: mede só o desempenho dos ativos, sem o efeito de quando você aportou ou resgatou. É o padrão dos fundos."
          />
          <Stat
            label={<KpiLabel>TIR (XIRR)</KpiLabel>}
            value={formatOptionalDelta(xirrShown)}
            tone={xirrShown !== null ? toneOf(xirrShown * 100) : "default"}
            caption={shortPeriod ? "No período" : "Ao ano"}
            hint={`Taxa interna de retorno dos seus aportes e resgates, nas datas em que aconteceram. Considera o momento de cada aporte.${
              shortPeriod ? " Com menos de um ano de histórico, mostramos a taxa acumulada no período, sem anualizar." : ""
            }`}
          />
          <Stat
            label={<KpiLabel>Índice de Sharpe</KpiLabel>}
            value={performance.sharpe !== null ? formatNumber(performance.sharpe, { digits: 2 }) : EMPTY_VALUE}
            caption="Sobre o CDI"
            hint="(Rentabilidade anualizada − CDI do mesmo período) ÷ volatilidade anualizada. Perto de zero: rendeu o mesmo que o CDI para o risco assumido."
          />
          <Stat
            label={<KpiLabel>Volatilidade</KpiLabel>}
            value={performance.volatility !== null ? formatPct(performance.volatility) : EMPTY_VALUE}
            caption="Anualizada"
            hint="Desvio padrão dos retornos mensais por cota, anualizado."
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-4 lg:grid-cols-4">
          <Stat
            label={<KpiLabel>Retorno sobre o capital investido</KpiLabel>}
            value={formatDeltaPct(pp(summary.totalReturn))}
            tone={toneOf(summary.totalReturn)}
            hint="(Patrimônio atual + resgates − aportes) ÷ aportes. Depende de quando e quanto você aportou; para comparar com índices, use a rentabilidade por cota."
          />
          <Stat
            label={<KpiLabel>Diferença vs CDI</KpiLabel>}
            value={benchmarks.cdi !== null ? formatPoints(summary.outperformanceCDI) : EMPTY_VALUE}
            tone={benchmarks.cdi !== null ? toneOf(summary.outperformanceCDI) : "default"}
            caption={`CDI ${formatOptionalDelta(benchmarks.cdi)}`}
          />
          <Stat
            label={<KpiLabel>Diferença vs Ibovespa</KpiLabel>}
            value={benchmarks.ibovespa !== null ? formatPoints(summary.outperformanceIbovespa) : EMPTY_VALUE}
            tone={benchmarks.ibovespa !== null ? toneOf(summary.outperformanceIbovespa) : "default"}
            caption={`Ibovespa ${formatOptionalDelta(benchmarks.ibovespa)}`}
          />
          <Stat
            label={<KpiLabel>Diferença vs IPCA + 6%</KpiLabel>}
            value={versusIpcaPlus !== null ? formatPoints(versusIpcaPlus) : EMPTY_VALUE}
            tone={versusIpcaPlus !== null ? toneOf(versusIpcaPlus) : "default"}
            caption={`IPCA + 6% ${formatOptionalDelta(benchmarks.ipcaPlus6)}`}
            hint={`IPCA do período: ${formatOptionalDelta(benchmarks.ipca)}. IPCA + 6% ao ano é a referência de um título atrelado à inflação. O IPCA entra mês a mês, quando o IBGE divulga o índice, então o último mês pode ainda não estar incluído.`}
          />
        </div>
      </section>

      <Tabs defaultValue="evolution" className="gap-6">
        <TabsList variant="underline">
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
          <TabsTrigger value="benchmark">Comparação</TabsTrigger>
          <TabsTrigger value="drawdown">Quedas</TabsTrigger>
          <TabsTrigger value="monthly">Retornos mensais</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="space-y-4">
          <SectionHeader title="Evolução do patrimônio" description="Valor total da carteira e capital investido." as="h3" />
          <ChartFrame legend={<ChartLegend series={EVOLUTION_SERIES} />}>
            <AreaChart data={analytics.evolution} margin={CHART_MARGIN}>
              {GRID}
              <XAxis dataKey="date" tickFormatter={formatMonthTick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={formatMoneyTick}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={88}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label as string}
                    payload={props.payload as never}
                    series={EVOLUTION_SERIES}
                    formatLabel={(label) => tooltipLabel(label, analytics.evolution)}
                    formatValue={(value) => formatBRL(value)}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.08}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartFrame>
        </TabsContent>

        <TabsContent value="benchmark" className="space-y-4">
          <SectionHeader
            title="Comparação com CDI, Ibovespa e IPCA"
            description="Rentabilidade por cota acumulada no mesmo período, sem o efeito dos aportes."
            as="h3"
          />
          <ChartFrame legend={<BenchmarkLegend series={BENCHMARK_SERIES} />}>
            <LineChart data={analytics.benchmarkComparison} margin={CHART_MARGIN}>
              {GRID}
              <XAxis dataKey="date" tickFormatter={formatMonthTick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={(value: number) => formatPct(pp(value), { digits: 0 })}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label as string}
                    payload={props.payload as never}
                    series={BENCHMARK_SERIES}
                    formatLabel={(label) => tooltipLabel(label, analytics.benchmarkComparison)}
                    formatValue={(value) => formatDeltaPct(pp(value))}
                  />
                )}
              />
              {BENCHMARK_SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  stroke={series.color}
                  strokeWidth={series.dash ? 1.5 : 2}
                  strokeDasharray={series.dash}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartFrame>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
            <Stat
              label="Melhor mês"
              value={summary.bestMonth.date ? formatDeltaPct(pp(summary.bestMonth.return), { digits: 2 }) : "—"}
              tone={summary.bestMonth.date ? toneOf(summary.bestMonth.return) : "default"}
              caption={summary.bestMonth.date ? formatMonthShort(summary.bestMonth.date) : "Dados insuficientes"}
            />
            <Stat
              label="Pior mês"
              value={summary.worstMonth.date ? formatDeltaPct(pp(summary.worstMonth.return), { digits: 2 }) : "—"}
              tone={summary.worstMonth.date ? toneOf(summary.worstMonth.return) : "default"}
              caption={summary.worstMonth.date ? formatMonthShort(summary.worstMonth.date) : "Dados insuficientes"}
            />
          </div>
        </TabsContent>

        <TabsContent value="drawdown" className="space-y-4">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-1">
                Quedas desde o pico
                <InfoHint content="Drawdown: quanto a carteira caiu desde o melhor momento anterior. Se ela estava com +5% e agora está com −2%, a queda é de 7 pontos. Quedas fazem parte do investimento e ajudam a medir o risco." />
              </span>
            }
            description="Períodos em que a carteira ficou abaixo do pico anterior."
            as="h3"
          />
          <ChartFrame legend={<ChartLegend series={DRAWDOWN_SERIES} />}>
            <AreaChart data={analytics.drawdownHistory} margin={CHART_MARGIN}>
              {GRID}
              <XAxis dataKey="date" tickFormatter={formatMonthTick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={(value: number) => formatPct(pp(value), { digits: 0 })}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label as string}
                    payload={props.payload as never}
                    series={DRAWDOWN_SERIES}
                    formatLabel={(label) => tooltipLabel(label, analytics.drawdownHistory)}
                    formatValue={(value) => formatDeltaPct(pp(value), { digits: 2 })}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="var(--negative)"
                strokeWidth={1.5}
                fill="var(--negative)"
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartFrame>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
            <Stat
              label="Queda atual"
              value={summary.currentDrawdown > 0 ? formatDeltaPct(-pp(summary.currentDrawdown), { digits: 2 }) : formatPct(0)}
              tone={summary.currentDrawdown > 0 ? "negative" : "default"}
              caption={summary.currentDrawdown > 0 ? "Abaixo do pico" : "No pico"}
            />
            <Stat
              label="Maior queda"
              value={formatDeltaPct(-pp(Math.abs(summary.maxDrawdownDepth)), { digits: 2 })}
              caption="Máximo histórico"
            />
            <Stat
              label="Tempo de recuperação"
              value={summary.averageRecoveryTime > 0 ? `${formatNumber(summary.averageRecoveryTime, { digits: 0 })} meses` : "—"}
              caption={`Média de ${summary.drawdownCount} ${summary.drawdownCount === 1 ? "período" : "períodos"}`}
            />
          </div>

          {analytics.drawdownPeriods.length > 0 && (
            <DataTable
              caption="Períodos de queda"
              columns={drawdownColumns}
              rows={analytics.drawdownPeriods}
              getRowId={(p) => `${p.startDate}-${p.endDate ?? "atual"}`}
              stickyFirstColumn
              dense
            />
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <SectionHeader
            title="Retornos mensais"
            description={
              <>
                Média mensal:{" "}
                <span className={cn("font-medium tabular-nums", returnToneClass(pp(averageMonthly)))}>
                  {formatDeltaPct(pp(averageMonthly), { digits: 2 })}
                </span>
              </>
            }
            as="h3"
          />
          <ChartFrame>
            <BarChart data={analytics.monthlyReturns} margin={CHART_MARGIN}>
              {GRID}
              <XAxis dataKey="date" tickFormatter={formatMonthTick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickFormatter={(value: number) => formatPct(pp(value), { digits: 0 })}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    label={props.label as string}
                    payload={props.payload as never}
                    series={MONTHLY_SERIES}
                    formatLabel={(label) => tooltipLabel(label, analytics.monthlyReturns)}
                    formatValue={(value) => formatDeltaPct(pp(value), { digits: 2 })}
                  />
                )}
              />
              <Bar dataKey="return" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {analytics.monthlyReturns.map((item) => (
                  <Cell key={item.date} fill={item.return >= 0 ? "var(--positive)" : "var(--negative)"} />
                ))}
              </Bar>
            </BarChart>
          </ChartFrame>

          <DataTable
            caption="Retornos mensais"
            columns={monthlyColumns}
            rows={[...analytics.monthlyReturns].reverse()}
            getRowId={(m) => m.date}
            dense
            maxHeight={420}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Invalida TODOS os caches de uma carteira.
 * Deve ser chamada quando qualquer escrita acontecer (criar, editar, deletar transações etc.).
 *
 * @deprecated Use queryClient.invalidateQueries({ queryKey: ['portfolio-analytics', portfolioId] }) diretamente
 */
export function invalidatePortfolioAnalyticsCache(portfolioId: string) {
  portfolioCache.invalidateAll(portfolioId);
}
