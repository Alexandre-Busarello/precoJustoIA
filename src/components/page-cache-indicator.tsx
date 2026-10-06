/**
 * Indicador discreto de dados em cache (texto muted xs) com opção de atualizar.
 */

'use client';

import { useHydratedCompanyAnalysis } from '@/components/strategic-analysis-client';
import { CacheIndicator } from './cache-indicator';

interface PageCacheIndicatorProps {
  ticker: string;
  /** Mesmo valor usado na consulta de análise da página (evita uma segunda requisição). */
  isPremium?: boolean;
  className?: string;
}

export function PageCacheIndicator({ ticker, isPremium, className }: PageCacheIndicatorProps) {
  const { dataUpdatedAt } = useHydratedCompanyAnalysis(ticker, isPremium);

  if (!dataUpdatedAt) return null;

  return (
    <div className={className ?? 'mb-2 flex justify-end text-xs text-muted-foreground'}>
      <CacheIndicator
        queryKey={['company-analysis', ticker.toUpperCase()]}
        dataUpdatedAt={dataUpdatedAt}
        staleTime={24 * 60 * 60 * 1000}
        ticker={ticker} // Invalida todos os caches do ativo
      />
    </div>
  );
}
