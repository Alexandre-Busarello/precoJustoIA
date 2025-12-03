/**
 * Timeline de Rebalanceamento
 * Mostra histórico de mudanças na composição do índice
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RebalanceLog {
  id: string;
  date: string;
  action: 'ENTRY' | 'EXIT' | 'REBALANCE';
  ticker: string;
  reason: string;
}

interface IndexRebalanceTimelineProps {
  logs: RebalanceLog[];
}

export function IndexRebalanceTimeline({ logs }: IndexRebalanceTimelineProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ENTRY':
        return <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'EXIT':
        return <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'REBALANCE':
        return <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      ENTRY: 'default',
      EXIT: 'destructive',
      REBALANCE: 'secondary'
    };

    const labels: Record<string, string> = {
      ENTRY: 'Entrada',
      EXIT: 'Saída',
      REBALANCE: 'Rebalanceamento'
    };

    return (
      <Badge variant={variants[action] || 'default'}>
        {labels[action] || action}
      </Badge>
    );
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mudanças</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
            Nenhuma mudança registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Mudanças</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log, index) => {
            const date = new Date(log.date);
            const isLast = index === logs.length - 1;

            return (
              <div key={log.id} className="relative flex gap-4">
                {/* Linha vertical */}
                {!isLast && (
                  <div className="absolute left-[10px] top-[32px] bottom-[-16px] w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Ícone */}
                <div className="flex-shrink-0 z-10">
                  {getActionIcon(log.action)}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{log.ticker}</span>
                      {getActionBadge(log.action)}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {format(date, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {log.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

