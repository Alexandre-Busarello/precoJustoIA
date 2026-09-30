"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SectionHeader } from "@/components/ui/section-header";
import { toast as sonnerToast } from "sonner";
import { formatBRL, formatDate, formatDeltaPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moneyToneClass, returnToneClass } from "@/components/portfolio-page-shell";

interface ClosedPosition {
  ticker: string;
  averagePrice: number;
  totalInvested: number;
  totalSold: number;
  realizedReturn: number;
  /** Fração. */
  realizedReturnPercentage: number;
  totalDividends: number;
  totalReturn: number;
  /** Fração. */
  totalReturnPercentage: number;
  closedDate: string;
}

interface PortfolioClosedPositionsTableProps {
  portfolioId: string;
}

function ResultCell({ fraction, amount }: { fraction: number; amount: number }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={cn("font-medium", returnToneClass(fraction))}>{formatDeltaPct(fraction)}</span>
      <span className={cn("text-xs", moneyToneClass(amount))}>{formatBRL(amount)}</span>
    </div>
  );
}

const columns: DataTableColumn<ClosedPosition>[] = [
  { key: "ticker", header: "Ativo", sortable: true, cell: (p) => <span className="font-medium">{p.ticker}</span> },
  { key: "averagePrice", header: "Preço médio", align: "right", cell: (p) => formatBRL(p.averagePrice) },
  { key: "totalInvested", header: "Investido", align: "right", sortable: true, cell: (p) => formatBRL(p.totalInvested) },
  { key: "totalSold", header: "Vendido", align: "right", sortable: true, cell: (p) => formatBRL(p.totalSold) },
  {
    key: "realizedReturnPercentage",
    header: "Resultado realizado",
    align: "right",
    sortable: true,
    cell: (p) => <ResultCell fraction={p.realizedReturnPercentage} amount={p.realizedReturn} />,
  },
  { key: "totalDividends", header: "Dividendos", align: "right", sortable: true, cell: (p) => formatBRL(p.totalDividends) },
  {
    key: "totalReturnPercentage",
    header: "Resultado total",
    align: "right",
    sortable: true,
    hint: "Resultado realizado mais os dividendos recebidos enquanto a posição existia.",
    cell: (p) => <ResultCell fraction={p.totalReturnPercentage} amount={p.totalReturn} />,
  },
  {
    key: "closedDate",
    header: "Encerramento",
    align: "right",
    sortable: true,
    sortValue: (p) => new Date(p.closedDate).getTime(),
    cell: (p) => <span className="text-muted-foreground">{formatDate(p.closedDate)}</span>,
  },
];

/** Ativos que já saíram da carteira, com resultado realizado e dividendos. */
export function PortfolioClosedPositionsTable({ portfolioId }: PortfolioClosedPositionsTableProps) {
  const queryClient = useQueryClient();

  const {
    data: closedPositions = [],
    isLoading: loading,
    error: closedPositionsError,
  } = useQuery<ClosedPosition[]>({
    queryKey: ["portfolio-closed-positions", portfolioId],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/closed-positions`);
      if (!response.ok) throw new Error("Erro ao carregar posições encerradas");
      const data = await response.json();
      return data.closedPositions || [];
    },
  });

  useEffect(() => {
    // toast do sonner direto: o de useToast muda a cada render e repetiria o aviso.
    if (closedPositionsError) sonnerToast.error("Erro", { description: "Não foi possível carregar as posições encerradas" });
  }, [closedPositionsError]);

  useEffect(() => {
    const handleTransactionUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["portfolio-closed-positions", portfolioId] });
      }, 500);
    };
    window.addEventListener("transaction-updated", handleTransactionUpdate);
    window.addEventListener("transaction-cash-flow-changed", handleTransactionUpdate);
    return () => {
      window.removeEventListener("transaction-updated", handleTransactionUpdate);
      window.removeEventListener("transaction-cash-flow-changed", handleTransactionUpdate);
    };
  }, [portfolioId, queryClient]);

  return (
    <section aria-labelledby="closed-positions-title" className="space-y-4">
      <SectionHeader
        id="closed-positions-title"
        title="Posições encerradas"
        description="Ativos que já passaram pela carteira, com resultado realizado e dividendos recebidos."
      />
      {!loading && closedPositions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nenhuma posição encerrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Ativos vendidos por completo aparecem aqui.</p>
        </div>
      ) : (
        <DataTable
          caption="Posições encerradas"
          columns={columns}
          rows={closedPositions}
          getRowId={(p) => `${p.ticker}-${p.closedDate}`}
          stickyFirstColumn
          loading={loading}
          loadingRows={2}
          defaultSort={{ key: "closedDate", direction: "desc" }}
        />
      )}
    </section>
  );
}
