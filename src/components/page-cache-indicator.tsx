/**
 * Componente para exibir indicador de cache dentro da página, acima do card do score
 */

'use client';

import { useCompanyAnalysis } from '@/hooks/use-company-data';
import { CacheIndicator } from './cache-indicator';

interface PageCacheIndicatorProps {
  ticker: string;
}

export function PageCacheIndicator({ ticker }: PageCacheIndicatorProps) {
  const { dataUpdatedAt } = useCompanyAnalysis(ticker);

  if (!dataUpdatedAt) return null;

  return (
    <div className="flex justify-end mb-2">
      <CacheIndicator 
        queryKey={['company-analysis', ticker.toUpperCase()]}
        dataUpdatedAt={dataUpdatedAt}
        staleTime={24 * 60 * 60 * 1000}
        ticker={ticker} // Passar ticker para invalidar todos os caches do ativo
      />
    </div>
  );
}

