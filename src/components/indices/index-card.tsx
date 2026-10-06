/**
 * Card de índice da listagem /indices: nome, ticker, sparkline e métricas principais.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDeltaPct, formatNumber, formatPct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { IndexSparkline } from './index-sparkline';
import { IndexRealTimeBadge } from './index-realtime-badge';
import { isBrazilMarketOpen } from '@/lib/market-status-client';

interface IndexCardProps {
  ticker: string;
  name: string;
  currentPoints: number;
  /** Retorno acumulado desde o início, em pontos percentuais. */
  accumulatedReturn: number;
  /** Variação do último pregão, em pontos percentuais. */
  dailyChange: number | null;
  /** DY médio ponderado da carteira, em pontos percentuais. */
  currentYield: number | null;
  assetCount: number;
  sparklineData?: Array<{ date: string; points: number }>;
}

function toneClass(value: number) {
  return value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-foreground';
}

export function IndexCard({
  ticker,
  name,
  currentPoints,
  accumulatedReturn,
  dailyChange,
  currentYield,
  assetCount,
  sparklineData = [],
}: IndexCardProps) {
  // O status do pregão depende do relógio do cliente: calcula só após montar (evita divergência de hidratação).
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    setMarketOpen(isBrazilMarketOpen());
    const interval = setInterval(() => setMarketOpen(isBrazilMarketOpen()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const totalReturn = accumulatedReturn / 100;
  const daily = dailyChange !== null ? dailyChange / 100 : null;

  return (
    <Link
      href={`/indices/${ticker.toLowerCase()}`}
      className="group flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium text-foreground">{name}</h2>
          <Badge variant="neutral">{ticker}</Badge>
        </div>
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>

      <IndexSparkline data={sparklineData} />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Retorno desde o início</p>
          <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', toneClass(totalReturn))}>
            {formatDeltaPct(totalReturn)}
          </p>
        </div>
        <div className="text-right">
          {marketOpen ? (
            <IndexRealTimeBadge ticker={ticker} />
          ) : (
            daily !== null && (
              <p className="text-xs">
                <span className={cn('font-medium tabular-nums', toneClass(daily))}>
                  {formatDeltaPct(daily, { digits: 2 })}
                </span>{' '}
                <span className="text-muted-foreground">no último pregão</span>
              </p>
            )
          )}
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Pontos</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatNumber(currentPoints, { digits: 2 })}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">DY médio</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {currentYield !== null ? formatPct(currentYield / 100) : '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Ativos</dt>
          <dd className="font-medium tabular-nums text-foreground">{assetCount}</dd>
        </div>
      </dl>
    </Link>
  );
}
