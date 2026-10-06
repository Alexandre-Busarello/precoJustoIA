/**
 * Performance individual: cada ativo que passou pelo índice e sua contribuição para o retorno acumulado.
 * Sem Premium: prévia borrada de 3 linhas e um convite para assinar.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDeltaPct, formatPct } from '@/lib/format';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { AssetCell, assetHref } from '@/components/asset/asset-cell';
import { SectionHeader } from '@/components/ui/section-header';

interface AssetPerformance {
  ticker: string;
  companyName?: string | null;
  logoUrl?: string | null;
  assetType?: string | null;
  /** Prévia sem Premium: ticker fictício, sem link. */
  isObfuscated?: boolean;
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  daysInIndex: number;
  totalReturn: number | null;
  /** Contribuição para o retorno do índice, em pontos percentuais. */
  contributionToIndex: number;
  /** Peso médio como fração. */
  averageWeight: number;
  status: 'ACTIVE' | 'EXITED';
  firstSnapshotDate: string;
  lastSnapshotDate: string;
}

type Filter = 'ALL' | 'ACTIVE' | 'EXITED';

interface AssetPerformanceResponse {
  performances: AssetPerformance[];
  /** A API ocultou os dados (sem acesso Premium no servidor). */
  isObfuscated: boolean;
}

async function fetchAssetPerformance(ticker: string): Promise<AssetPerformanceResponse> {
  const response = await fetch(`/api/indices/${ticker}/asset-performance`);
  if (!response.ok) throw new Error('Erro ao buscar performance de ativos');
  const data = await response.json();
  return { performances: data.performances || [], isObfuscated: Boolean(data.isObfuscated) };
}

const columns: DataTableColumn<AssetPerformance>[] = [
  {
    key: 'ticker',
    header: 'Ativo',
    sticky: true,
    sortable: true,
    cell: (perf) => (
      <AssetCell
        href={perf.isObfuscated ? undefined : assetHref(perf.ticker, perf.assetType)}
        ticker={perf.ticker}
        name={perf.companyName}
        logoUrl={perf.logoUrl}
        className="max-w-40 sm:max-w-52"
      />
    ),
  },
  {
    key: 'status',
    header: 'Situação',
    cell: (perf) => (
      <Badge variant={perf.status === 'ACTIVE' ? 'brand' : 'neutral'}>
        {perf.status === 'ACTIVE' ? 'Na carteira' : 'Removido'}
      </Badge>
    ),
  },
  {
    key: 'entryDate',
    header: 'Entrada',
    sortable: true,
    sortValue: (perf) => perf.entryDate,
    cell: (perf) => formatDate(perf.entryDate),
  },
  {
    key: 'exitDate',
    header: 'Saída',
    sortable: true,
    sortValue: (perf) => perf.exitDate,
    cell: (perf) => formatDate(perf.exitDate),
  },
  { key: 'daysInIndex', header: 'Dias', align: 'right', sortable: true },
  {
    key: 'contributionToIndex',
    header: 'Contribuição',
    align: 'right',
    sortable: true,
    hint: 'Quanto o ativo somou (ou tirou) do retorno acumulado do índice, em pontos percentuais.',
    cell: (perf) => {
      const value = perf.contributionToIndex / 100;
      return (
        <span className={cn('font-medium', value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-muted-foreground')}>
          {formatDeltaPct(value, { digits: 2 })}
        </span>
      );
    },
  },
  {
    key: 'averageWeight',
    header: 'Peso médio',
    align: 'right',
    sortable: true,
    cell: (perf) => formatPct(perf.averageWeight),
  },
];

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'ACTIVE', label: 'Na carteira' },
  { key: 'EXITED', label: 'Removidos' },
];

export function IndexAssetPerformance({ ticker }: { ticker: string }) {
  const { isPremium } = usePremiumStatus();
  const [filter, setFilter] = useState<Filter>('ALL');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['index-asset-performance', ticker],
    queryFn: () => fetchAssetPerformance(ticker),
    refetchOnWindowFocus: false,
  });
  const performances = data?.performances ?? [];
  const isObfuscated = data?.isObfuscated ?? false;

  const header = (
    <SectionHeader
      title="Performance individual dos ativos"
      description="Contribuição de cada ativo que passou pelo índice para o retorno acumulado."
    />
  );

  if (error) {
    return (
      <section className="space-y-4">
        {header}
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">Não foi possível carregar a performance dos ativos.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </section>
    );
  }

  const counts: Record<Filter, number> = {
    ALL: performances.length,
    ACTIVE: performances.filter((p) => p.status === 'ACTIVE').length,
    EXITED: performances.filter((p) => p.status === 'EXITED').length,
  };
  const rows = performances.filter((p) => filter === 'ALL' || p.status === filter);

  // O servidor é a fonte da verdade: se a API ocultou os dados, mostra o convite mesmo que o cliente se ache Premium.
  if (!isLoading && (isObfuscated || (!isPremium && performances.length > 0))) {
    const invite = (
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-popover p-4 text-center shadow-md">
        <Lock className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-sm text-foreground">
          {performances.length > 0
            ? `Veja os ${performances.length} ativos que passaram pelo índice e a contribuição de cada um.`
            : 'Veja todos os ativos que passaram pelo índice e a contribuição de cada um.'}
        </p>
        <Button asChild size="sm">
          <Link href="/planos">Conhecer o Premium</Link>
        </Button>
      </div>
    );
    return (
      <section className="space-y-4">
        {header}
        {performances.length > 0 ? (
          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none select-none blur-sm">
              <DataTable columns={columns} rows={performances.slice(0, 3)} getRowId={(p) => p.ticker} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-4">{invite}</div>
          </div>
        ) : (
          <div className="flex justify-center py-6">{invite}</div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {header}
      <div role="group" aria-label="Filtrar ativos" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-[3px]">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-border focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-8"
          >
            {label} <span className="tabular-nums">({counts[key]})</span>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        getRowId={(p) => p.ticker}
        defaultSort={{ key: 'entryDate', direction: 'desc' }}
        caption="Performance individual dos ativos do índice"
        empty={{
          title: performances.length === 0 ? 'Ainda não há dados de performance' : 'Nenhum ativo com este filtro',
        }}
      />
    </section>
  );
}
