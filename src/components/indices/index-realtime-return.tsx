/**
 * Rentabilidade do índice em tempo real (antes do fechamento oficial).
 */

'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { formatDate, formatNumber } from '@/lib/format';
import { fetchRealTimeReturnWithCache } from '@/lib/index-realtime-cache';

interface RealTimeReturnData {
  realTimePoints: number;
  realTimeReturn: number;
  /** Variação do dia, em pontos percentuais. */
  dailyChange: number;
  lastOfficialPoints: number;
  lastOfficialDate: string;
  isMarketOpen: boolean;
}

interface IndexRealTimeReturnProps {
  ticker: string;
}

/** A data do último fechamento vem como `YYYY-MM-DD` (ou ISO); usa só a parte da data, ao meio-dia UTC. */
function parseOfficialDate(value: string): Date {
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function IndexRealTimeReturn({ ticker }: IndexRealTimeReturnProps) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: RealTimeReturnData }
  >({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    fetchRealTimeReturnWithCache(ticker)
      .then((data: RealTimeReturnData) => mounted && setState({ status: 'ready', data }))
      .catch((err) => {
        console.error('Erro ao buscar rentabilidade em tempo real:', err);
        if (mounted) setState({ status: 'error' });
      });
    return () => {
      mounted = false;
    };
  }, [ticker]);

  if (state.status === 'error') return null;

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { data } = state;
  const officialDate = parseOfficialDate(data.lastOfficialDate);
  const isToday = data.lastOfficialDate.split('T')[0] === todayInBrazil();
  const officialNote =
    isToday && data.isMarketOpen
      ? 'O valor oficial de hoje sai após o fechamento do mercado.'
      : `Comparado ao último fechamento oficial, de ${formatDate(officialDate)}.`;

  return (
    <section aria-label="Rentabilidade em tempo real" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Rentabilidade em tempo real</h2>
        <Badge variant={data.isMarketOpen ? 'brand' : 'neutral'}>
          {data.isMarketOpen ? 'Mercado aberto' : 'Mercado fechado'}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          label="Pontos agora"
          value={formatNumber(data.realTimePoints, { digits: 2 })}
          delta={data.dailyChange / 100}
          deltaLabel="hoje"
          className="col-span-2 sm:col-span-1"
        />
        <Stat label="Último fechamento" value={formatNumber(data.lastOfficialPoints, { digits: 2 })} caption="pontos" />
        <Stat label="Data do fechamento" value={formatDate(officialDate)} size="sm" />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Dados não oficiais, calculados com os preços atuais dos ativos. {officialNote} A pontuação oficial é atualizada
        diariamente às 19h.
      </p>
    </section>
  );
}
