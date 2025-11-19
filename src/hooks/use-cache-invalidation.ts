/**
 * Hook para invalidação inteligente de cache baseado em mudanças de portfolio e perfil
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useSessionRefresh } from './use-session-refresh';

/**
 * Invalidar cache do dashboard quando portfolio ou perfil mudarem
 */
export function invalidateDashboardCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  queryClient.invalidateQueries({ queryKey: ['top-companies'] });
  queryClient.invalidateQueries({ queryKey: ['portfolios'] });
}

/**
 * Hook que monitora mudanças de portfolio e perfil e invalida cache automaticamente
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const previousTierRef = useRef<string | undefined>(undefined);
  const previousTrialRef = useRef<{ startedAt?: string | null; endsAt?: string | null } | undefined>(undefined);

  // Monitorar mudanças de perfil usando useSessionRefresh
  useSessionRefresh({
    onSessionUpdate: (user) => {
      // Invalidar cache do dashboard quando perfil mudar
      console.log('🔄 Perfil atualizado, invalidando cache do dashboard');
      invalidateDashboardCache(queryClient);
    },
  });

  // Monitorar mudanças de tier/premium na sessão
  useEffect(() => {
    if (!session?.user) return;

    const currentTier = session.user.subscriptionTier;
    const currentTrial = {
      startedAt: session.user.trialStartedAt,
      endsAt: session.user.trialEndsAt,
    };

    // Verificar se tier mudou
    if (previousTierRef.current !== undefined && previousTierRef.current !== currentTier) {
      console.log('🔄 Tier mudou, invalidando cache do dashboard');
      invalidateDashboardCache(queryClient);
    }

    // Verificar se trial mudou
    if (previousTrialRef.current) {
      const prevTrial = previousTrialRef.current;
      if (
        prevTrial.startedAt !== currentTrial.startedAt ||
        prevTrial.endsAt !== currentTrial.endsAt
      ) {
        console.log('🔄 Trial mudou, invalidando cache do dashboard');
        invalidateDashboardCache(queryClient);
      }
    }

    // Atualizar referências
    previousTierRef.current = currentTier;
    previousTrialRef.current = currentTrial;
  }, [session?.user?.subscriptionTier, session?.user?.trialStartedAt, session?.user?.trialEndsAt, queryClient]);

  // Escutar eventos customizados de mudança de portfolio
  useEffect(() => {
    const handlePortfolioChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ portfolioId?: string; action?: string }>;
      console.log('🔄 Mudança de portfolio detectada:', customEvent.detail);
      invalidateDashboardCache(queryClient);
    };

    // Escutar eventos de transação de portfolio
    window.addEventListener('portfolio-transaction-updated', handlePortfolioChange);
    window.addEventListener('portfolio-asset-updated', handlePortfolioChange);
    window.addEventListener('portfolio-config-updated', handlePortfolioChange);

    return () => {
      window.removeEventListener('portfolio-transaction-updated', handlePortfolioChange);
      window.removeEventListener('portfolio-asset-updated', handlePortfolioChange);
      window.removeEventListener('portfolio-config-updated', handlePortfolioChange);
    };
  }, [queryClient]);
}

/**
 * Função helper para disparar evento de mudança de portfolio
 * Use esta função em componentes que modificam portfolio
 */
export function dispatchPortfolioChangeEvent(
  action: 'transaction' | 'asset' | 'config',
  portfolioId?: string
) {
  const eventName =
    action === 'transaction'
      ? 'portfolio-transaction-updated'
      : action === 'asset'
      ? 'portfolio-asset-updated'
      : 'portfolio-config-updated';

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: { portfolioId, action },
    })
  );
}

