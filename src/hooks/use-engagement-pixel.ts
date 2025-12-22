/**
 * Hook para disparar pixel de engajamento do Google Ads
 * EXCLUSIVO para usuários anônimos/deslogados
 * Dispara apenas UMA VEZ por sessão do usuário
 */

'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { fireEngagementPixel, hasEngagementPixelFired } from '@/lib/google-ads-engagement-pixel';

/**
 * Hook que retorna função para disparar pixel de engajamento
 * 
 * CRÍTICO:
 * - Verifica automaticamente se usuário está deslogado
 * - Verifica se pixel já foi disparado nesta sessão
 * - Só dispara se ambas condições forem atendidas
 * 
 * @returns Função trackEngagement() que retorna true se pixel foi disparado
 */
export function useEngagementPixel() {
  const { data: session, status } = useSession();

  const trackEngagement = useCallback((): boolean => {
    // Aguardar carregamento da sessão
    if (status === 'loading') {
      return false;
    }

    // Verificação automática: só disparar se usuário estiver deslogado
    const isAnonymous = !session || !session.user;
    if (!isAnonymous) {
      return false; // Usuário logado, não disparar pixel
    }

    // CRÍTICO: Verificar se pixel já foi disparado nesta sessão
    if (hasEngagementPixelFired()) {
      return false; // Já foi disparado, não disparar novamente
    }

    // Disparar pixel
    return fireEngagementPixel(true);
  }, [session, status]);

  return { trackEngagement };
}

