"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { AssetCell } from "@/components/asset/asset-cell";
import { MarketTickerBar } from "@/components/indices/market-ticker-bar";
import { PageNotice } from "@/components/page-notice";
import { BenIntroCard } from "@/components/ben-intro-card";
import { DashboardRadarSection } from "@/components/dashboard-radar-section";
import { DashboardPortfolios } from "@/components/dashboard-portfolios";
import { RankingHistorySection } from "@/components/ranking-history-section";
import { NotificationModalsWrapper } from "@/components/notification-modals-wrapper";
import { CacheIndicator } from "@/components/cache-indicator";
import { usePremiumStatus } from "@/hooks/use-premium-status";
import { useDashboardPortfolios, useTopCompanies } from "@/hooks/use-dashboard-data";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import { useRadar } from "@/hooks/use-radar";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, formatDeltaPct, formatNumber } from "@/lib/format";
import { BlockEmpty, BlockError } from "./_components/block-state";

const TOP_COMPANIES_LIMIT = 5;
const TOP_COMPANIES_MIN_SCORE = 80;

interface TopCompany {
  ticker: string;
  companyName: string;
  score: number;
  sector: string | null;
  currentPrice: number;
  logoUrl: string | null;
  recommendation: string;
}

interface MarketIndex {
  ticker: string;
  value: number;
  /** Pontos percentuais (0,45 = +0,45%). */
  changePercent: number;
}

/** Processa, uma vez por sessão de página, as campanhas ativas para o usuário (atualiza sino e avisos). */
function useProcessActiveCampaigns() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);
  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== "authenticated" || !userId || processedRef.current) return;
    processedRef.current = true;
    fetch("/api/notifications/process-active-campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.processed > 0) {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      })
      .catch((err) => console.error("Erro ao processar campanhas ativas:", err));
  }, [status, userId, queryClient]);
}

function useIbovToday() {
  return useQuery<MarketIndex | null>({
    queryKey: ["market-indices", "ibov"],
    queryFn: async () => {
      const res = await fetch("/api/market-indices");
      if (!res.ok) throw new Error("Erro ao buscar índices");
      const data: { indices?: MarketIndex[] } = await res.json();
      return data.indices?.find((index) => index.ticker === "IBOV") ?? null;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

const statSkeleton = <Skeleton className="h-7 w-24" />;

/** Cor semântica de um resultado (fração): neutra quando arredonda para 0,0%. */
function toneOf(value: number | null): "default" | "positive" | "negative" {
  if (value === null || Math.round(Math.abs(value) * 1000) === 0) return "default";
  return value > 0 ? "positive" : "negative";
}

function DashboardStats() {
  const portfolios = useDashboardPortfolios();
  const { radarConfig, loadingConfig, configError } = useRadar();
  const ibov = useIbovToday();

  const list = portfolios.data?.portfolios ?? [];
  const totalValue = list.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  // Retorno combinado: cada totalReturn é (V + W − I) ÷ I, então pondera pelo total aportado (I) de cada carteira,
  // o que dá Σ(V + W − I) ÷ ΣI mesmo quando houve resgates.
  const totalInvested = list.reduce((sum, p) => sum + Math.max(p.totalInvested || 0, 0), 0);
  const weightedReturn =
    totalInvested > 0 ? list.reduce((sum, p) => sum + p.totalReturn * Math.max(p.totalInvested || 0, 0), 0) / totalInvested : null;

  const portfoliosPending = portfolios.isLoading;
  const portfoliosFailed = portfolios.isError && !portfolios.data;
  const portfolioCaption = portfoliosFailed ? "Indisponível" : list.length === 0 ? "Nenhuma carteira" : `${list.length} ${list.length === 1 ? "carteira" : "carteiras"}`;

  const radarCount = radarConfig?.tickers?.length ?? 0;

  return (
    <section aria-label="Resumo" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      <Stat
        className="bg-card p-4"
        label="Patrimônio total"
        value={portfoliosPending ? statSkeleton : list.length > 0 ? formatBRL(totalValue) : "—"}
        caption={portfoliosPending ? undefined : portfolioCaption}
      />
      <Stat
        className="bg-card p-4"
        label="Retorno total"
        hint="Retorno das suas carteiras ponderado pelo capital líquido investido (aportes menos saques)."
        value={portfoliosPending ? statSkeleton : formatDeltaPct(weightedReturn)}
        tone={toneOf(portfoliosPending ? null : weightedReturn)}
        caption={portfoliosPending ? undefined : weightedReturn === null ? portfolioCaption : "desde o início"}
      />
      <Stat
        className="bg-card p-4"
        label="Ibovespa hoje"
        value={ibov.isLoading ? statSkeleton : ibov.data ? `${formatNumber(ibov.data.value, { digits: 0 })} pts` : "—"}
        delta={ibov.data ? ibov.data.changePercent / 100 : null}
        deltaLabel="no dia"
        caption={!ibov.isLoading && !ibov.data ? "Indisponível" : undefined}
      />
      <Stat
        className="bg-card p-4"
        label="Ativos no radar"
        value={loadingConfig ? statSkeleton : configError ? "—" : formatNumber(radarCount, { digits: 0 })}
        caption={configError ? "Indisponível" : undefined}
      />
    </section>
  );
}

function TopCompaniesSection() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useTopCompanies(TOP_COMPANIES_LIMIT, TOP_COMPANIES_MIN_SCORE);
  const companies = ((data as { companies?: TopCompany[] } | undefined)?.companies ?? []).slice(0, TOP_COMPANIES_LIMIT);

  const columns: DataTableColumn<TopCompany>[] = [
    {
      key: "ticker",
      header: "Empresa",
      sortable: true,
      cell: (row) => (
        <AssetCell href={`/acao/${row.ticker.toLowerCase()}`} ticker={row.ticker} name={row.companyName} logoUrl={row.logoUrl} />
      ),
    },
    { key: "currentPrice", header: "Preço", align: "right", sortable: true, cell: (row) => formatBRL(row.currentPrice) },
    {
      key: "score",
      header: "Score",
      align: "right",
      sortable: true,
      hint: "Score de 0 a 100 calculado a partir de indicadores fundamentalistas como P/L, ROE, dívida e crescimento.",
      cell: (row) => formatNumber(row.score, { digits: 0 }),
    },
    {
      key: "sector",
      header: "Setor",
      cell: (row) => <span className="block max-w-40 truncate text-muted-foreground">{row.sector || "—"}</span>,
      className: "max-sm:hidden",
      headerClassName: "max-sm:hidden",
    },
  ];

  return (
    <section aria-labelledby="dashboard-top-companies" className="space-y-3">
      <SectionHeader
        id="dashboard-top-companies"
        title="Boas empresas para analisar"
        description={`Score geral acima de ${TOP_COMPANIES_MIN_SCORE}`}
        actions={
          dataUpdatedAt ? (
            <CacheIndicator queryKey={["top-companies", TOP_COMPANIES_LIMIT, TOP_COMPANIES_MIN_SCORE]} dataUpdatedAt={dataUpdatedAt} />
          ) : undefined
        }
      />
      {isError && !data ? (
        <BlockError message="Não foi possível carregar as empresas." onRetry={() => refetch()} />
      ) : !isLoading && companies.length === 0 ? (
        <BlockEmpty
          title="Nenhuma empresa acima do score mínimo agora"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/ranking">Abrir rankings</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={companies}
          getRowId={(row) => row.ticker}
          loading={isLoading || (isFetching && companies.length === 0)}
          loadingRows={TOP_COMPANIES_LIMIT}
          stickyFirstColumn
          dense
          caption="Empresas com score acima de 80"
          onRowClick={(row) => router.push(`/acao/${row.ticker.toLowerCase()}`)}
        />
      )}
    </section>
  );
}

/** Um único convite discreto ao Premium, só para o plano gratuito. */
function FreePlanCard() {
  return (
    <section
      aria-labelledby="dashboard-upgrade"
      data-upsell
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <h2 id="dashboard-upgrade" className="text-sm font-medium text-foreground">
          Você está no plano gratuito
        </h2>
        <p className="text-sm text-muted-foreground">
          O Premium libera carteiras e radar sem limite, todos os modelos de valuation, a lista de boas empresas para analisar e os relatórios de IA.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
        <Link href="/planos">Ver planos</Link>
      </Button>
    </section>
  );
}

const noopSubscribe = () => () => {};

/**
 * Esqueleto estático do dashboard para o HTML do servidor e a hidratação.
 * Os blocos leem caches do localStorage e o tamanho da tela no primeiro render; montar só no cliente evita divergência de hidratação.
 */
function DashboardSkeleton({ aporte }: { aporte?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6" aria-busy="true">
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <PageHeader title="Visão geral" />
      </div>
      {aporte}
      <Skeleton className="h-28 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

/** `aporte`: bloco "Onde aportar este mês" (renderizado no servidor), logo abaixo do cabeçalho e dos avisos. */
export function DashboardClient({ aporte }: { aporte?: ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return <DashboardSkeleton aporte={aporte} />;
  return <DashboardContent aporte={aporte} />;
}

function DashboardContent({ aporte }: { aporte?: ReactNode }) {
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  useCacheInvalidation();
  useProcessActiveCampaigns();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
      <NotificationModalsWrapper />

      <div className="space-y-4">
        <MarketTickerBar />
        <PageHeader title="Visão geral" description={formatDate(new Date())} />
        <PageNotice />
        <BenIntroCard />
      </div>

      {aporte}

      <DashboardStats />

      <DashboardRadarSection />

      {/* "Boas empresas" usa uma API exclusiva do Premium: no plano gratuito o bloco não é montado */}
      <div className={cn("grid grid-cols-1 gap-8", isPremium && "lg:grid-cols-2")}>
        <DashboardPortfolios />
        {!premiumLoading && isPremium && <TopCompaniesSection />}
      </div>

      {!premiumLoading && !isPremium && <FreePlanCard />}

      <section id="rankings" aria-label="Rankings recentes">
        <RankingHistorySection />
      </section>
    </div>
  );
}
