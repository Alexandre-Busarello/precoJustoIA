/**
 * Componente discreto para indicar que dados estão sendo exibidos do cache
 * e permitir limpar o cache se necessário
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invalidateTickerCache } from '@/hooks/use-company-data';

interface CacheIndicatorProps {
  queryKey: unknown[];
  dataUpdatedAt?: number;
  staleTime?: number;
  className?: string;
  ticker?: string; // Se fornecido, invalida todos os caches do ticker
}

/**
 * Formata tempo relativo (ex: "há 2 horas")
 */
function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (hours > 0) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  if (minutes > 0) return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  return 'agora';
}

/**
 * Verifica se os dados estão stale (fora do staleTime)
 */
function isStale(dataUpdatedAt: number, staleTime: number): boolean {
  const age = Date.now() - dataUpdatedAt;
  return age > staleTime;
}

export function CacheIndicator({ 
  queryKey, 
  dataUpdatedAt, 
  staleTime = 5 * 60 * 1000,
  className = '',
  ticker
}: CacheIndicatorProps) {
  const queryClient = useQueryClient();
  const [showClearOption, setShowClearOption] = useState(false);
  
  if (!dataUpdatedAt) return null;

  const age = Date.now() - dataUpdatedAt;
  const isStaleData = isStale(dataUpdatedAt, staleTime);
  
  // Só mostrar se os dados estão stale ou têm mais de 1 minuto
  if (!isStaleData && age < 60 * 1000) return null;

  const relativeTime = formatRelativeTime(age);

  const handleRefresh = () => {
    if (ticker) {
      // Se ticker fornecido, invalidar todos os caches do ticker
      invalidateTickerCache(queryClient, ticker);
    } else {
      // Caso contrário, invalidar apenas a query específica
      queryClient.invalidateQueries({ queryKey });
      queryClient.refetchQueries({ queryKey });
    }
  };

  return (
    <div 
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground opacity-50 hover:opacity-100 transition-opacity group ${className}`}
      onMouseEnter={() => setShowClearOption(true)}
      onMouseLeave={() => setShowClearOption(false)}
    >
      <Clock className="w-3 h-3" />
      <span className="hidden sm:inline">Cache {relativeTime}</span>
      {showClearOption && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleRefresh}
          title={ticker ? "Atualizar todos os dados do ativo" : "Atualizar dados"}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * Hook helper para obter informações de cache de uma query
 */
export function useCacheInfo(queryKey: unknown[], staleTime?: number) {
  const queryClient = useQueryClient();
  const query = queryClient.getQueryState(queryKey);
  
  const dataUpdatedAt = query?.dataUpdatedAt;
  const isStale = dataUpdatedAt && staleTime 
    ? (Date.now() - dataUpdatedAt) > staleTime 
    : false;
  
  return {
    dataUpdatedAt,
    isStale,
    isFetching: query?.fetchStatus === 'fetching',
  };
}

