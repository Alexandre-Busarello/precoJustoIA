"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SectionHeader } from "@/components/ui/section-header";
import { useDashboardPortfolios } from "@/hooks/use-dashboard-data";
import { formatBRL, formatDeltaPct } from "@/lib/format";
import { BlockEmpty, BlockError } from "@/app/dashboard/_components/block-state";

/**
 * Invalida o cache de carteiras do dashboard.
 * Chame quando dados da carteira mudarem (transações, configuração etc.).
 */
export function invalidateDashboardPortfoliosCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("dashboard_portfolios");
  } catch {
    // localStorage indisponível: segue só com o evento
  }
  window.dispatchEvent(new CustomEvent("invalidate-dashboard-portfolios"));
}

interface PortfolioRow {
  id: string;
  name: string;
  currentValue: number;
  /** Fração (0,12 = +12%). */
  totalReturn: number;
}

function returnTone(value: number): string {
  if (Math.round(Math.abs(value) * 1000) === 0) return "text-muted-foreground";
  return value > 0 ? "text-positive" : "text-negative";
}

const COLUMNS: DataTableColumn<PortfolioRow>[] = [
  {
    key: "name",
    header: "Carteira",
    sortable: true,
    cell: (row) => (
      <Link
        href={`/carteira/${row.id}`}
        className="block max-w-44 truncate py-1 font-medium pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center pointer-coarse:py-0 text-foreground underline-offset-4 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.name}
      </Link>
    ),
  },
  {
    key: "currentValue",
    header: "Patrimônio",
    align: "right",
    sortable: true,
    cell: (row) => formatBRL(row.currentValue),
  },
  {
    key: "totalReturn",
    header: "Retorno",
    align: "right",
    sortable: true,
    cell: (row) => <span className={returnTone(row.totalReturn)}>{formatDeltaPct(row.totalReturn)}</span>,
  },
];

/** Bloco "Carteiras" do dashboard: tabela resumida (nome · patrimônio · retorno) + "Nova carteira". */
export function DashboardPortfolios() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useDashboardPortfolios();
  const portfolios: PortfolioRow[] = data?.portfolios ?? [];

  useEffect(() => {
    const handleInvalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard-portfolios"] });
    window.addEventListener("invalidate-dashboard-portfolios", handleInvalidate);
    return () => window.removeEventListener("invalidate-dashboard-portfolios", handleInvalidate);
  }, [queryClient]);

  return (
    <section aria-labelledby="dashboard-portfolios" className="space-y-3">
      <SectionHeader
        id="dashboard-portfolios"
        title="Carteiras"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/carteira">
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Nova carteira
            </Link>
          </Button>
        }
      />
      {isError && !data ? (
        <BlockError message="Não foi possível carregar suas carteiras." onRetry={() => refetch()} />
      ) : !isLoading && portfolios.length === 0 ? (
        <BlockEmpty
          title="Nenhuma carteira criada"
          description="Registre seus aportes para acompanhar patrimônio e retorno."
          action={
            <Button asChild size="sm">
              <Link href="/carteira">Criar carteira</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={portfolios}
          getRowId={(row) => row.id}
          loading={isLoading}
          loadingRows={2}
          stickyFirstColumn
          dense
          caption="Suas carteiras"
          onRowClick={(row) => router.push(`/carteira/${row.id}`)}
        />
      )}
    </section>
  );
}
