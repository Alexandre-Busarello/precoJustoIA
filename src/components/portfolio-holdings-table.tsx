"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toast as sonnerToast } from "sonner";
import { formatBRL, formatDeltaPct, formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RecoveryCalculatorSheet } from "@/components/recovery-calculator-sheet";
import { moneyToneClass, returnToneClass } from "@/components/portfolio-page-shell";

interface Holding {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  totalInvested: number;
  return: number;
  /** Fração. */
  returnPercentage: number;
  totalDividends: number;
  returnWithDividends: number;
  /** Fração. */
  returnWithDividendsPercentage: number;
  /** Fração. */
  targetAllocation: number;
  /** Fração. */
  actualAllocation: number;
  allocationDiff: number;
  needsRebalancing: boolean;
  /** Proventos brutos por ação dos últimos 12 meses ÷ preço médio (fração); `null` sem dado. */
  yieldOnCost?: number | null;
}

const YIELD_ON_COST_HINT =
  "Proventos brutos por ação com data ex nos últimos 12 meses divididos pelo seu preço médio.";

interface PortfolioHoldingsTableProps {
  portfolioId: string;
}

type AllocationStatus = "over" | "under" | "ok";

function allocationStatus(holding: Holding): AllocationStatus {
  if (!holding.needsRebalancing) return "ok";
  return holding.allocationDiff > 0 ? "over" : "under";
}

const STATUS_LABEL: Record<AllocationStatus, string> = {
  over: "Acima da meta",
  under: "Abaixo da meta",
  ok: "Na meta",
};

/** Ordem: acima da meta → na meta → abaixo da meta; empate por valor atual (maior primeiro). */
const STATUS_ORDER: Record<AllocationStatus, number> = { over: 1, ok: 2, under: 3 };

function StatusBadge({ holding }: { holding: Holding }) {
  const status = allocationStatus(holding);
  return <Badge variant={status === "ok" ? "neutral" : "warning"}>{STATUS_LABEL[status]}</Badge>;
}

function ReturnCell({ fraction, amount }: { fraction: number; amount: number }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={cn("font-medium", returnToneClass(fraction))}>{formatDeltaPct(fraction)}</span>
      <span className={cn("text-xs", moneyToneClass(amount))}>{formatBRL(amount)}</span>
    </div>
  );
}

function AllocationCell({ holding }: { holding: Holding }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-medium">{formatPct(holding.actualAllocation)}</span>
      <span className="text-xs text-muted-foreground">Meta {formatPct(holding.targetAllocation)}</span>
    </div>
  );
}

function DetailItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate tabular-nums text-foreground", className)}>{children}</dd>
    </div>
  );
}

/** Card de uma posição (mobile): o essencial visível, o restante num expansível. */
function HoldingCard({ holding, onRecovery }: { holding: Holding; onRecovery: (h: Holding) => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = `holding-details-${holding.ticker}`;

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{holding.ticker}</p>
            <div className="mt-1">
              <StatusBadge holding={holding} />
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium tabular-nums text-foreground">{formatBRL(holding.currentValue)}</p>
            <p className="text-xs text-muted-foreground">Valor atual</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
          <DetailItem label="Retorno" className={cn("font-medium", returnToneClass(holding.returnPercentage))}>
            {formatDeltaPct(holding.returnPercentage)}
          </DetailItem>
          <DetailItem label="Alocação · meta">
            {formatPct(holding.actualAllocation)}{" "}
            <span className="text-muted-foreground">· {formatPct(holding.targetAllocation)}</span>
          </DetailItem>
        </dl>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between border-t border-border px-4 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
      >
        {open ? "Ocultar detalhes" : "Ver detalhes"}
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={detailsId} className="border-t border-border bg-surface px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <DetailItem label="Quantidade">{formatNumber(holding.quantity, { digits: 0 })}</DetailItem>
            <DetailItem label="Preço médio">{formatBRL(holding.averagePrice)}</DetailItem>
            <DetailItem label="Preço atual">{formatBRL(holding.currentPrice)}</DetailItem>
            <DetailItem label="Investido">{formatBRL(holding.totalInvested)}</DetailItem>
            <DetailItem label="Resultado" className={moneyToneClass(holding.return)}>
              {formatBRL(holding.return)}
            </DetailItem>
            <DetailItem label="Dividendos">{formatBRL(holding.totalDividends)}</DetailItem>
            <DetailItem label="Yield on cost (12m)">{formatPct(holding.yieldOnCost)}</DetailItem>
            <DetailItem
              label="Retorno c/ dividendos"
              className={returnToneClass(holding.returnWithDividendsPercentage)}
            >
              {formatDeltaPct(holding.returnWithDividendsPercentage)}
            </DetailItem>
            <DetailItem label="Resultado c/ dividendos" className={moneyToneClass(holding.returnWithDividends)}>
              {formatBRL(holding.returnWithDividends)}
            </DetailItem>
          </dl>
          {holding.returnPercentage < 0 && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => onRecovery(holding)}>
              <Calculator strokeWidth={1.75} aria-hidden="true" />
              Simular aporte
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function PortfolioHoldingsTable({ portfolioId }: PortfolioHoldingsTableProps) {
  const queryClient = useQueryClient();
  const [recoverySheetHolding, setRecoverySheetHolding] = useState<Holding | null>(null);

  const {
    data: holdingsData,
    isLoading: loading,
    error: holdingsError,
  } = useQuery({
    queryKey: ["portfolio-holdings", portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/holdings`);
      if (!response.ok) throw new Error("Erro ao carregar posições");
      return response.json();
    },
  });

  const baseHoldings: Holding[] = holdingsData?.holdings || [];
  const tickersParam = baseHoldings.map((h) => h.ticker).sort().join(",");

  // Proventos dos últimos 12 meses por ação (base do yield on cost).
  const { data: ttmData } = useQuery<{ ttm: Record<string, number> }>({
    queryKey: ["dividends-ttm", tickersParam],
    queryFn: async () => {
      const response = await fetch(`/api/agenda-proventos/ttm?tickers=${encodeURIComponent(tickersParam)}`);
      if (!response.ok) throw new Error("Erro ao carregar proventos");
      return response.json();
    },
    enabled: tickersParam.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const holdings: Holding[] = baseHoldings.map((h) => {
    const ttm = ttmData?.ttm[h.ticker];
    return {
      ...h,
      yieldOnCost: typeof ttm === "number" && h.averagePrice > 0 ? ttm / h.averagePrice : null,
    };
  });

  // Sugestões de aporte/compra pendentes (devem ser concluídas antes de rebalancear).
  const { data: pendingContributionsData } = useQuery({
    queryKey: ["portfolio-pending-contributions", portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=contribution`);
      if (!response.ok) throw new Error("Erro ao verificar sugestões de aportes");
      const data = await response.json();
      const pending = (data.suggestions || []).filter(
        (suggestion: { type: string }) =>
          suggestion.type === "MONTHLY_CONTRIBUTION" || suggestion.type === "CASH_CREDIT" || suggestion.type === "BUY"
      );
      return { hasPending: pending.length > 0, count: pending.length };
    },
  });

  const hasPendingContributions = pendingContributionsData?.hasPending || false;
  const pendingContributionsCount = pendingContributionsData?.count || 0;

  const { data: rebalancingCheckData } = useQuery({
    queryKey: ["portfolio-rebalancing-check", portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/transactions/suggestions/rebalancing/check`);
      if (!response.ok) throw new Error("Erro ao verificar necessidade de rebalanceamento");
      const data = await response.json();
      return { shouldShow: data.shouldShow || false, maxDeviation: data.maxDeviation || 0 };
    },
  });

  const shouldShowRebalancing = rebalancingCheckData?.shouldShow || false;
  const maxDeviation = rebalancingCheckData?.maxDeviation || 0;

  // Recarrega quando alguma transação muda.
  useEffect(() => {
    const handleTransactionUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["portfolio-pending-contributions", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-rebalancing-check", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-holdings", portfolioId] });
      }, 500);
    };

    window.addEventListener("transaction-updated", handleTransactionUpdate);
    window.addEventListener("reload-suggestions", handleTransactionUpdate);
    window.addEventListener("transaction-cash-flow-changed", handleTransactionUpdate);
    return () => {
      window.removeEventListener("transaction-updated", handleTransactionUpdate);
      window.removeEventListener("reload-suggestions", handleTransactionUpdate);
      window.removeEventListener("transaction-cash-flow-changed", handleTransactionUpdate);
    };
  }, [portfolioId, queryClient]);

  useEffect(() => {
    // toast do sonner direto: o de useToast muda a cada render e repetiria o aviso.
    if (holdingsError) sonnerToast.error("Erro", { description: "Não foi possível carregar as posições" });
  }, [holdingsError]);

  const sortedHoldings = [...holdings].sort((a, b) => {
    const byStatus = STATUS_ORDER[allocationStatus(a)] - STATUS_ORDER[allocationStatus(b)];
    return byStatus !== 0 ? byStatus : b.currentValue - a.currentValue;
  });

  const columns: DataTableColumn<Holding>[] = [
    {
      key: "ticker",
      header: "Ativo",
      sortable: true,
      cell: (h) => <span className="font-medium text-foreground">{h.ticker}</span>,
    },
    {
      key: "quantity",
      header: "Qtd.",
      align: "right",
      sortable: true,
      cell: (h) => formatNumber(h.quantity, { digits: 0 }),
    },
    { key: "averagePrice", header: "Preço médio", align: "right", sortable: true, cell: (h) => formatBRL(h.averagePrice) },
    { key: "currentPrice", header: "Preço atual", align: "right", sortable: true, cell: (h) => formatBRL(h.currentPrice) },
    {
      key: "currentValue",
      header: "Valor atual",
      align: "right",
      sortable: true,
      cell: (h) => <span className="font-medium">{formatBRL(h.currentValue)}</span>,
    },
    {
      key: "returnPercentage",
      header: "Retorno",
      align: "right",
      sortable: true,
      cell: (h) => <ReturnCell fraction={h.returnPercentage} amount={h.return} />,
    },
    {
      key: "returnWithDividendsPercentage",
      header: "Retorno c/ div.",
      align: "right",
      sortable: true,
      hint: "Inclui os dividendos recebidos do ativo.",
      cell: (h) => <ReturnCell fraction={h.returnWithDividendsPercentage} amount={h.returnWithDividends} />,
    },
    {
      key: "yieldOnCost",
      header: "Yield on cost",
      align: "right",
      sortable: true,
      hint: YIELD_ON_COST_HINT,
      cell: (h) => formatPct(h.yieldOnCost),
    },
    {
      key: "actualAllocation",
      header: "Alocação",
      align: "right",
      sortable: true,
      cell: (h) => <AllocationCell holding={h} />,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (h) => STATUS_ORDER[allocationStatus(h)],
      sortable: true,
      cell: (h) => <StatusBadge holding={h} />,
    },
    {
      key: "recovery",
      header: <span className="sr-only">Simulação</span>,
      align: "right",
      cell: (h) =>
        h.returnPercentage < 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setRecoverySheetHolding(h)}>
            <Calculator strokeWidth={1.75} aria-hidden="true" />
            Simular aporte
          </Button>
        ) : null,
    },
  ];

  const pendingText = `${pendingContributionsCount} ${
    pendingContributionsCount === 1 ? "sugestão pendente" : "sugestões pendentes"
  } em aportes e compras`;

  return (
    <section aria-labelledby="holdings-title" className="space-y-4">
      <SectionHeader
        id="holdings-title"
        title="Posições"
        description={holdings.length > 0 ? `${holdings.length} ${holdings.length === 1 ? "ativo" : "ativos"}` : undefined}
        actions={shouldShowRebalancing ? <Badge variant="warning">Rebalanceamento sugerido</Badge> : undefined}
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">Carregando posições</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full sm:h-10" />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma posição ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre suas primeiras transações para ver as posições aqui.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden" data-testid="holdings-cards">
            {sortedHoldings.map((holding) => (
              <HoldingCard key={holding.ticker} holding={holding} onRecovery={setRecoverySheetHolding} />
            ))}
          </ul>
          <DataTable
            className="hidden sm:block"
            caption="Posições atuais"
            columns={columns}
            rows={sortedHoldings}
            getRowId={(h) => h.ticker}
            stickyFirstColumn
          />
        </>
      )}

      {shouldShowRebalancing && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            {hasPendingContributions ? (
              <>
                <p className="font-medium text-foreground">Conclua as sugestões de aporte primeiro</p>
                <p className="mt-0.5 text-muted-foreground">
                  Há {pendingText}. Registre ou rejeite essas transações antes de ver o ajuste da alocação.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Alguns ativos estão fora da alocação-alvo</p>
                <p className="mt-0.5 text-muted-foreground">
                  {maxDeviation > 0 && <>Maior desvio: {formatPct(maxDeviation)}. </>}
                  Veja os ajustes que aproximam a carteira da alocação que você definiu.
                </p>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href={`/carteira/${portfolioId}/sugestoes`}>
              {hasPendingContributions ? "Ver aportes pendentes" : "Ver ajustes"}
            </Link>
          </Button>
        </div>
      )}

      <RecoveryCalculatorSheet
        holding={recoverySheetHolding}
        open={!!recoverySheetHolding}
        onOpenChange={(open) => !open && setRecoverySheetHolding(null)}
      />
    </section>
  );
}
