/**
 * Histórico de mudanças na composição do índice (entradas, saídas e rebalanceamentos).
 * Usuários sem Premium recebem só os 3 registros mais recentes (o restante nem chega ao cliente).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';

interface RebalanceLog {
  id: string;
  date: string;
  action: 'ENTRY' | 'EXIT' | 'REBALANCE';
  ticker: string;
  reason: string;
}

interface IndexRebalanceTimelineProps {
  logs: RebalanceLog[];
  /** Quantidade de registros ocultos para quem não é Premium. */
  lockedCount?: number;
}

const PAGE_SIZE = 10;

const ACTION: Record<RebalanceLog['action'], { label: string; variant: 'brand' | 'neutral' | 'warning' }> = {
  ENTRY: { label: 'Entrada', variant: 'brand' },
  EXIT: { label: 'Saída', variant: 'warning' },
  REBALANCE: { label: 'Rebalanceamento', variant: 'neutral' },
};

/** `YYYY-MM-DD` → Date ao meio-dia UTC (evita trocar o dia por fuso). */
function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function IndexRebalanceTimeline({ logs, lockedCount = 0 }: IndexRebalanceTimelineProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageLogs = logs.slice(start, start + PAGE_SIZE);

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Histórico de mudanças"
        description="Entradas, saídas e rebalanceamentos da carteira teórica, do mais recente para o mais antigo."
      />

      {logs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma mudança registrada ainda.
        </div>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {pageLogs.map((log) => {
            const action = ACTION[log.action] ?? { label: log.action, variant: 'neutral' as const };
            return (
              <li key={log.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/acao/${log.ticker.toLowerCase()}`} className="font-medium text-foreground hover:underline">
                      {log.ticker}
                    </Link>
                    <Badge variant={action.variant}>{action.label}</Badge>
                  </div>
                  <time dateTime={log.date} className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(parseDay(log.date))}
                  </time>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{log.reason}</p>
              </li>
            );
          })}
        </ol>
      )}

      {lockedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Mais {lockedCount} {lockedCount === 1 ? 'registro disponível' : 'registros disponíveis'} no Premium.
          </p>
          <Button asChild size="sm">
            <Link href="/planos">Ver histórico completo</Link>
          </Button>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação do histórico" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {start + 1}–{Math.min(start + PAGE_SIZE, logs.length)} de {logs.length} registros
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
