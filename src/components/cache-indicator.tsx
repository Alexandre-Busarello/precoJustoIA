/**
 * Indicador discreto de dados vindos do cache, com ação para atualizar.
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { invalidateTickerCache } from '@/hooks/use-company-data';

interface CacheIndicatorProps {
  queryKey: unknown[];
  dataUpdatedAt?: number;
  staleTime?: number;
  className?: string;
  /** Se informado, invalida todos os caches do ticker. */
  ticker?: string;
}

/** Só aparece quando os dados passaram do `staleTime` ou têm mais de 1 minuto. */
export function CacheIndicator({
  queryKey,
  dataUpdatedAt,
  staleTime = 5 * 60 * 1000,
  className,
  ticker,
}: CacheIndicatorProps) {
  const queryClient = useQueryClient();

  if (!dataUpdatedAt) return null;

  const age = Date.now() - dataUpdatedAt;
  if (age <= staleTime && age < 60 * 1000) return null;

  const handleRefresh = () => {
    if (ticker) {
      invalidateTickerCache(queryClient, ticker);
    } else {
      queryClient.invalidateQueries({ queryKey });
      queryClient.refetchQueries({ queryKey });
    }
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      title={ticker ? 'Atualizar todos os dados do ativo' : 'Atualizar dados'}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 sm:min-h-9 sm:min-w-0 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
        className
      )}
    >
      <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden sm:inline">Atualizado {formatDate(dataUpdatedAt, { style: 'relative' })}</span>
      <span className="sr-only sm:hidden">Atualizar dados</span>
    </button>
  );
}

/**
 * Hook helper para obter informações de cache de uma query
 */
export function useCacheInfo(queryKey: unknown[], staleTime?: number) {
  const queryClient = useQueryClient();
  const query = queryClient.getQueryState(queryKey);

  const dataUpdatedAt = query?.dataUpdatedAt;
  const isStale = dataUpdatedAt && staleTime ? Date.now() - dataUpdatedAt > staleTime : false;

  return {
    dataUpdatedAt,
    isStale,
    isFetching: query?.fetchStatus === 'fetching',
  };
}
