'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';

import { usePremiumStatus } from '@/hooks/use-premium-status';
import { Button } from '@/components/ui/button';

interface MonitorLimitBannerProps {
  current: number;
  max: number | null;
  /** Mostra o link para os planos (quando o limite foi atingido). */
  showUpgrade?: boolean;
}

/** Aviso inline do limite de monitoramentos do plano gratuito. Não aparece para Premium. */
export function MonitorLimitBanner({ current, max, showUpgrade = false }: MonitorLimitBannerProps) {
  const { isPremium, isLoading } = usePremiumStatus();

  if (isLoading || isPremium || max === null) return null;

  const isLimitReached = current >= max;
  const noun = max === 1 ? 'monitoramento ativo' : 'monitoramentos ativos';

  return (
    <div
      role="status"
      data-notice="monitor-limit"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            {isLimitReached ? 'Limite do plano gratuito atingido' : 'Plano gratuito'}
          </p>
          <p className="text-muted-foreground">
            <span className="tabular-nums">
              {current} de {max}
            </span>{' '}
            {noun}.{' '}
            {isLimitReached
              ? 'Desative um monitoramento para criar outro, ou veja os planos para ter monitoramentos sem limite.'
              : 'No Premium não há limite.'}
          </p>
        </div>
      </div>
      {(showUpgrade || isLimitReached) && (
        <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
          <Link href="/planos">Ver planos</Link>
        </Button>
      )}
    </div>
  );
}
