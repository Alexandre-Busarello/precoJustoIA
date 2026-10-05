/**
 * Composição do índice. Usuários sem Premium recebem só os 3 primeiros ativos (o restante nem chega ao cliente).
 */

'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { SectionHeader } from '@/components/ui/section-header';
import { formatPct } from '@/lib/format';

interface CompositionAsset {
  ticker: string;
  name: string;
  logoUrl: string | null;
  sector: string | null;
  /** Peso-alvo como fração (0,1 = 10%). */
  targetWeight: number;
  /** DY em pontos percentuais. */
  dividendYield: number | null;
}

interface IndexCompositionTableProps {
  composition: CompositionAsset[];
  /** Quantidade de ativos ocultos para quem não é Premium. */
  lockedCount?: number;
}

const columns: DataTableColumn<CompositionAsset>[] = [
  {
    key: 'ticker',
    header: 'Ativo',
    sticky: true,
    sortable: true,
    cell: (asset) => (
      <Link href={`/acao/${asset.ticker.toLowerCase()}`} className="flex min-w-0 items-center gap-2 py-1 hover:underline">
        <CompanyLogo ticker={asset.ticker} logoUrl={asset.logoUrl} companyName={asset.name} size={28} />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">{asset.ticker}</span>
          <span className="block max-w-40 truncate text-xs text-muted-foreground sm:max-w-64">{asset.name}</span>
        </span>
      </Link>
    ),
  },
  {
    key: 'sector',
    header: 'Setor',
    sortable: true,
    className: 'text-muted-foreground',
    cell: (asset) => asset.sector ?? '—',
  },
  {
    key: 'targetWeight',
    header: 'Peso',
    align: 'right',
    sortable: true,
    cell: (asset) => formatPct(asset.targetWeight),
  },
  {
    key: 'dividendYield',
    header: 'DY',
    align: 'right',
    sortable: true,
    cell: (asset) => (asset.dividendYield !== null ? formatPct(asset.dividendYield / 100) : '—'),
  },
];

export function IndexCompositionTable({ composition, lockedCount = 0 }: IndexCompositionTableProps) {
  return (
    <section className="space-y-4">
      <SectionHeader
        title="Composição do índice"
        description={`${composition.length + lockedCount} ativos na carteira teórica atual`}
      />
      <DataTable
        columns={columns}
        rows={composition}
        getRowId={(asset) => asset.ticker}
        defaultSort={{ key: 'targetWeight', direction: 'desc' }}
        caption="Ativos e pesos do índice"
        empty={{ title: 'Composição indisponível', description: 'A carteira é recalculada após o fechamento do pregão.' }}
      />
      {lockedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Mais {lockedCount} {lockedCount === 1 ? 'ativo disponível' : 'ativos disponíveis'} no Premium.
          </p>
          <Button asChild size="sm">
            <Link href="/planos">Ver composição completa</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
