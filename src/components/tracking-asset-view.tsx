/**
 * Componente para tracking de visualização de ativo
 * Deve ser usado em páginas de ativos individuais
 */

'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/hooks/use-tracking';
import { EventType } from '@/lib/tracking-types';

interface TrackingAssetViewProps {
  ticker: string;
  assetType?: 'STOCK' | 'ETF' | 'FII' | 'BDR';
}

export function TrackingAssetView({ ticker, assetType = 'STOCK' }: TrackingAssetViewProps) {
  const { trackEvent } = useTracking();
  const lastTrackedRef = useRef<string | null>(null);
  const lastTrackTimeRef = useRef<number>(0);

  useEffect(() => {
    const tickerUpper = ticker.toUpperCase();
    const now = Date.now();
    
    // Evita tracking duplicado: só tracka se mudou o ticker ou passou mais de 3 segundos
    if (
      lastTrackedRef.current !== tickerUpper || 
      (now - lastTrackTimeRef.current) > 3000
    ) {
      trackEvent(EventType.ASSET_VIEWED, undefined, {
        ticker: tickerUpper,
        assetType,
      });
      
      lastTrackedRef.current = tickerUpper;
      lastTrackTimeRef.current = now;
    }
  }, [ticker, assetType, trackEvent]);

  return null; // Componente não renderiza nada
}

