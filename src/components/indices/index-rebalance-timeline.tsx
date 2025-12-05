/**
 * Timeline de Rebalanceamento
 * Mostra histórico de mudanças na composição do índice
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import Link from 'next/link';

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
  const { isPremium } = usePremiumStatus();
  
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

  // Mostrar apenas 3 logs para usuários Free, resto com blur
  const visibleLogs = isPremium ? logs : logs.slice(0, 3);
  const blurredLogs = isPremium ? [] : logs.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Histórico de Mudanças</span>
          {!isPremium && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleLogs.map((log, index) => {
            // Criar data localmente para evitar problemas de timezone
            // Se log.date é "YYYY-MM-DD", criar Date usando valores locais
            const dateStr = log.date;
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            // Último item visível só não mostra linha se não houver logs com blur
            const isLast = index === visibleLogs.length - 1 && blurredLogs.length === 0;

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
          
          {/* Logs com blur para usuários Free */}
          {blurredLogs.map((log, index) => {
            // Último item com blur não mostra linha vertical
            const isLast = index === blurredLogs.length - 1;

            return (
              <div 
                key={`blurred-${log.id}`} 
                className="relative flex gap-4"
                style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
              >
                {/* Linha vertical */}
                {!isLast && (
                  <div className="absolute left-[10px] top-[32px] bottom-[-16px] w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Ícone */}
                <div className="flex-shrink-0 z-10">
                  <div className="w-5 h-5 bg-gray-300 rounded-full" />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-300 h-5 w-16 rounded" />
                      <div className="bg-gray-300 h-5 w-20 rounded" />
                    </div>
                    <div className="bg-gray-300 h-4 w-24 rounded" />
                  </div>
                  <div className="bg-gray-300 h-4 w-full rounded mt-1" />
                </div>
              </div>
            );
          })}
        </div>

        {!isPremium && blurredLogs.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Desbloqueie o Histórico Completo</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Veja todas as {logs.length} mudanças na composição do índice, incluindo entradas, saídas e rebalanceamentos.
                </p>
                <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                  <Link href="/checkout">
                    Fazer Upgrade para Premium
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

