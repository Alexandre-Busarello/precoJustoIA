/**
 * Hook para verificar se o usuário atual é admin
 * Usado para desabilitar tracking de admins
 * Agora usa React Query com cache de 1 hora
 */

'use client';

import { useAdminCheck } from '@/hooks/use-user-data';

export function useAdminStatus() {
  const { data, isLoading } = useAdminCheck();
  
  return {
    isAdmin: data?.isAdmin || false,
    loading: isLoading,
  };
}

