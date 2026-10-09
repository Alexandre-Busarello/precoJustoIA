'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, type BreadcrumbItem } from '@/components/page-header';
import { PortfolioTabs } from '@/components/portfolio-tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BenPageContextRegistrar } from '@/components/ben/page-context-registrar';
import { cn } from '@/lib/utils';

/** Carteira como a API `/api/portfolio/[id]` devolve (campos usados pelas páginas). */
export interface PortfolioSummary {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  monthlyContribution: number | string;
  rebalanceFrequency: string;
  trackingStarted: boolean;
  assets?: Array<{ ticker: string; targetAllocation: number | string }>;
  metrics?: { cashBalance?: number } | null;
}

export async function fetchPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const response = await fetch(`/api/portfolio/${portfolioId}`);
  if (!response.ok) throw new Error('Erro ao carregar carteira');
  const data = await response.json();
  return data.portfolio;
}

export const REBALANCE_FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

/**
 * Cor semântica de um retorno em fração, seguindo o valor exibido com 1 casa em %:
 * o que arredonda para 0,0% fica neutro.
 */
export function returnToneClass(fraction: number | null | undefined): string {
  if (typeof fraction !== 'number' || !Number.isFinite(fraction)) return 'text-muted-foreground';
  if (Math.round(Math.abs(fraction) * 1000) === 0) return 'text-muted-foreground';
  return fraction > 0 ? 'text-positive' : 'text-negative';
}

/** Cor semântica de um resultado em reais (neutro abaixo de 1 centavo). */
export function moneyToneClass(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'text-muted-foreground';
  if (Math.round(Math.abs(value) * 100) === 0) return 'text-muted-foreground';
  return value > 0 ? 'text-positive' : 'text-negative';
}

/** Mesma query (e cache) usada por todas as páginas da carteira. */
export function usePortfolioSummary(portfolioId: string) {
  return useQuery({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => fetchPortfolioSummary(portfolioId),
    enabled: !!portfolioId,
  });
}

interface PortfolioPageShellProps {
  portfolioId: string;
  portfolioName?: string;
  /** Título da página; na visão geral é o nome da carteira. */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rótulo da página atual na trilha (omitido na visão geral). */
  crumb?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Contêiner comum das páginas de uma carteira: trilha, título, abas e conteúdo. */
export function PortfolioPageShell({
  portfolioId,
  portfolioName,
  title,
  description,
  crumb,
  actions,
  children,
}: PortfolioPageShellProps) {
  const breadcrumb: BreadcrumbItem[] = [{ label: 'Carteiras', href: '/carteira' }];
  if (crumb) {
    breadcrumb.push({ label: portfolioName || 'Carteira', href: `/carteira/${portfolioId}` });
    breadcrumb.push({ label: crumb });
  } else {
    breadcrumb.push({ label: portfolioName || 'Carteira' });
  }

  // Retorno da carteira para o Ben: lido do cache da visão geral, sem buscar de novo
  const queryClient = useQueryClient();
  const metrics = React.useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => queryClient.getQueryData<{ totalReturn?: number | null }>(['portfolio-metrics', portfolioId]),
    () => undefined
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <BenPageContextRegistrar
        context={{
          kind: 'portfolio',
          id: portfolioId,
          ...(portfolioName ? { name: portfolioName } : {}),
          ...(typeof metrics?.totalReturn === 'number' ? { returnPct: metrics.totalReturn } : {}),
        }}
      />
      <div className="space-y-4">
        <PageHeader
          breadcrumb={breadcrumb}
          title={<span className="break-words">{title}</span>}
          description={description}
          actions={actions}
        />
        <PortfolioTabs portfolioId={portfolioId} />
      </div>
      <div className="mt-6 space-y-8">{children}</div>
    </div>
  );
}

/** Skeleton com a forma de uma página de carteira (trilha, título, abas, blocos). */
export function PortfolioPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-6 sm:py-8', className)} aria-busy="true">
      <span className="sr-only">Carregando carteira</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-7 w-56" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  );
}

/** Estado de erro/carteira inexistente. */
export function PortfolioNotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Carteira não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ela pode ter sido excluída ou o link está incorreto.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/carteira">Ver minhas carteiras</Link>
      </Button>
    </div>
  );
}
