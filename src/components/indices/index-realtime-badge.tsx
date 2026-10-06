/**
 * Variação do dia em tempo real (só com o pregão aberto).
 * Busca em segundo plano com cache; em caso de erro não mostra nada (vale a pontuação oficial).
 */

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDeltaPct } from '@/lib/format';
import { fetchRealTimeReturnWithCache } from '@/lib/index-realtime-cache';
import { isBrazilMarketOpen } from '@/lib/market-status-client';

interface IndexRealTimeBadgeProps {
  ticker: string;
}

type State = { status: 'loading' } | { status: 'ready'; dailyChange: number } | { status: 'hidden' };

export function IndexRealTimeBadge({ ticker }: IndexRealTimeBadgeProps) {
  const marketOpen = isBrazilMarketOpen();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!marketOpen) return;
    let mounted = true;
    // Usa o cache local quando existe; senão busca na API.
    fetchRealTimeReturnWithCache(ticker)
      .then((data) => mounted && setState({ status: 'ready', dailyChange: data.dailyChange }))
      .catch((err) => {
        console.error(`Erro ao buscar rentabilidade em tempo real para ${ticker}:`, err);
        if (mounted) setState({ status: 'hidden' });
      });
    return () => {
      mounted = false;
    };
  }, [ticker, marketOpen]);

  if (!marketOpen || state.status === 'hidden') return null;

  if (state.status === 'loading') {
    return <span className="text-xs text-muted-foreground">Calculando variação do dia</span>;
  }

  // dailyChange vem em pontos percentuais (0,53 = 0,53%).
  const change = state.dailyChange / 100;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      title="Variação calculada antes do fechamento oficial. A pontuação oficial é atualizada às 19h."
    >
      <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
      <span
        className={cn(
          'font-medium tabular-nums',
          change > 0 ? 'text-positive' : change < 0 ? 'text-negative' : 'text-muted-foreground'
        )}
      >
        {formatDeltaPct(change, { digits: 2 })}
      </span>
      <span className="text-muted-foreground">hoje, tempo real</span>
    </span>
  );
}
