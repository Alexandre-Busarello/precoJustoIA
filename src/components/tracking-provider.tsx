/**
 * Provider global para sistema de tracking
 * Inicializa tracking automático e gerencia ciclo de vida
 */

'use client';

import { useEffect } from 'react';
import { useTracking } from '@/hooks/use-tracking';

interface TrackingProviderProps {
  children: React.ReactNode;
}

export function TrackingProvider({ children }: TrackingProviderProps) {
  const { flush } = useTracking();

  // Envia eventos pendentes ao desmontar
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return <>{children}</>;
}

