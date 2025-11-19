/**
 * Custom hooks for user/auth data with React Query and localStorage persistence
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getPlaceholderData, getInitialData, saveQueryCache } from '@/lib/react-query-persister';
import { useSession } from 'next-auth/react';

// ===== Email Verified =====

interface EmailVerifiedResponse {
  verified: boolean;
}

async function fetchEmailVerified(): Promise<EmailVerifiedResponse> {
  const response = await fetch('/api/user/email-verified');
  if (!response.ok) {
    throw new Error('Failed to fetch email verification status');
  }
  return response.json();
}

/**
 * Hook para verificar se o email do usuário está verificado
 * Cache: 1 hora (status de verificação muda raramente)
 */
export function useEmailVerified() {
  const { data: session, status } = useSession();
  const queryKey = ['email-verified'];
  const staleTime = 60 * 60 * 1000; // 1 hora
  const gcTime = 24 * 60 * 60 * 1000; // 24 horas

  const initialCacheData = getInitialData<EmailVerifiedResponse>(queryKey, staleTime);
  
  const query = useQuery<EmailVerifiedResponse>({
    queryKey,
    queryFn: fetchEmailVerified,
    enabled: status === 'authenticated' && !!session?.user?.id,
    staleTime,
    gcTime,
    refetchOnMount: false, // Status muda raramente, não precisa refetch ao montar
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<EmailVerifiedResponse>(queryKey, staleTime),
  });

  // Persist to localStorage only after a successful fetch (not from initialData)
  const previousDataUpdatedAtRef = useRef<number | undefined>(initialCacheData?.updatedAt);
  const isInitialMountRef = useRef(true);
  
  useEffect(() => {
    if (!query.data) return;
    
    // Na primeira montagem, se temos initialData, não salvar (já está no cache)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (initialCacheData) {
        // Dados vieram do cache, não salvar novamente
        previousDataUpdatedAtRef.current = query.dataUpdatedAt;
        return;
      }
    }
    
    // Se dataUpdatedAt mudou desde a última vez, significa que houve um fetch
    const hasNewFetch = query.dataUpdatedAt && 
      query.dataUpdatedAt !== previousDataUpdatedAtRef.current;
    
    if (hasNewFetch) {
      // Houve um fetch real, salvar no cache
      saveQueryCache(queryKey, query.data, true);
      previousDataUpdatedAtRef.current = query.dataUpdatedAt;
    }
  }, [query.data, query.dataUpdatedAt, queryKey, initialCacheData]);

  return query;
}

/**
 * Função helper para invalidar cache de email verification quando email é verificado
 */
export function invalidateEmailVerifiedCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['email-verified'] });
}

// ===== Admin Check =====

interface AdminCheckResponse {
  isAdmin: boolean;
}

async function fetchAdminCheck(): Promise<AdminCheckResponse> {
  const response = await fetch('/api/admin/check');
  if (!response.ok) {
    throw new Error('Failed to fetch admin status');
  }
  return response.json();
}

/**
 * Hook para verificar se o usuário atual é admin
 * Cache: 1 hora (status de admin muda raramente)
 */
export function useAdminCheck() {
  const { data: session, status } = useSession();
  const queryKey = ['admin-check'];
  const staleTime = 60 * 60 * 1000; // 1 hora
  const gcTime = 24 * 60 * 60 * 1000; // 24 horas

  const initialCacheData = getInitialData<AdminCheckResponse>(queryKey, staleTime);
  
  const query = useQuery<AdminCheckResponse>({
    queryKey,
    queryFn: fetchAdminCheck,
    enabled: status === 'authenticated' && !!session?.user?.id,
    staleTime,
    gcTime,
    refetchOnMount: false, // Status muda raramente, não precisa refetch ao montar
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<AdminCheckResponse>(queryKey, staleTime),
  });

  // Persist to localStorage only after a successful fetch (not from initialData)
  const previousDataUpdatedAtRef = useRef<number | undefined>(initialCacheData?.updatedAt);
  const isInitialMountRef = useRef(true);
  
  useEffect(() => {
    if (!query.data) return;
    
    // Na primeira montagem, se temos initialData, não salvar (já está no cache)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (initialCacheData) {
        // Dados vieram do cache, não salvar novamente
        previousDataUpdatedAtRef.current = query.dataUpdatedAt;
        return;
      }
    }
    
    // Se dataUpdatedAt mudou desde a última vez, significa que houve um fetch
    const hasNewFetch = query.dataUpdatedAt && 
      query.dataUpdatedAt !== previousDataUpdatedAtRef.current;
    
    if (hasNewFetch) {
      // Houve um fetch real, salvar no cache
      saveQueryCache(queryKey, query.data, true);
      previousDataUpdatedAtRef.current = query.dataUpdatedAt;
    }
  }, [query.data, query.dataUpdatedAt, queryKey, initialCacheData]);

  return query;
}

/**
 * Função helper para invalidar cache de admin check quando status muda
 */
export function invalidateAdminCheckCache(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-check'] });
}

// ===== Update Last Login =====

interface UpdateLastLoginResponse {
  success: boolean;
}

async function updateLastLogin(): Promise<UpdateLastLoginResponse> {
  const response = await fetch('/api/auth/update-last-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to update last login');
  }
  return response.json();
}

/**
 * Hook para atualizar último login do usuário
 * Usa mutation para evitar múltiplas chamadas e cachear resultado por sessão
 * Cache: 1 hora (não precisa atualizar toda hora)
 */
export function useUpdateLastLogin() {
  const { data: session, status } = useSession();
  const queryKey = ['update-last-login'];
  const hasProcessedRef = useRef(false);
  const queryClient = useQueryClient();

  // Mutation para atualizar último login
  const mutation = useMutation({
    mutationFn: updateLastLogin,
    onSuccess: (data) => {
      // Cachear resultado por 1 hora no localStorage
      saveQueryCache(queryKey, data, true);
      
      // Também salvar no React Query cache
      queryClient.setQueryData(queryKey, data);
    },
  });

  // Executar apenas uma vez por sessão quando usuário está autenticado
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasProcessedRef.current && !mutation.isPending) {
      // Verificar se já temos resultado em cache (localStorage ou React Query)
      const cachedFromStorage = getInitialData<UpdateLastLoginResponse>(queryKey, 60 * 60 * 1000);
      const cachedInMemory = queryClient.getQueryData<UpdateLastLoginResponse>(queryKey);
      
      if (cachedFromStorage || cachedInMemory) {
        // Já atualizado recentemente, não fazer novamente
        hasProcessedRef.current = true;
        return;
      }

      // Atualizar último login apenas uma vez
      hasProcessedRef.current = true;
      mutation.mutate();
    }
  }, [status, session, mutation, queryClient]);

  return mutation;
}

// ===== Process OAuth =====

interface ProcessOAuthResponse {
  success: boolean;
  isNewUser?: boolean;
  registrationIpRecorded?: boolean;
}

async function processOAuth(): Promise<ProcessOAuthResponse> {
  const response = await fetch('/api/auth/process-oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to process OAuth');
  }
  return response.json();
}

/**
 * Hook para processar OAuth após login
 * Usa mutation para evitar múltiplas chamadas e cachear resultado por sessão
 * Cache: 1 hora (só muda quando há novo login)
 */
export function useProcessOAuth() {
  const { data: session, status } = useSession();
  const queryKey = ['process-oauth'];
  const hasProcessedRef = useRef(false);
  const queryClient = useQueryClient();

  // Mutation para processar OAuth
  const mutation = useMutation({
    mutationFn: processOAuth,
    onSuccess: (data) => {
      // Cachear resultado por 1 hora no localStorage
      saveQueryCache(queryKey, data, true);
      
      // Também salvar no React Query cache
      queryClient.setQueryData(queryKey, data);
    },
  });

  // Executar apenas uma vez por sessão quando usuário está autenticado
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasProcessedRef.current && !mutation.isPending) {
      // Verificar se já temos resultado em cache (localStorage ou React Query)
      const cachedFromStorage = getInitialData<ProcessOAuthResponse>(queryKey, 60 * 60 * 1000);
      const cachedInMemory = queryClient.getQueryData<ProcessOAuthResponse>(queryKey);
      
      if (cachedFromStorage || cachedInMemory) {
        // Já processado, não fazer novamente
        hasProcessedRef.current = true;
        return;
      }

      // Processar OAuth apenas uma vez
      hasProcessedRef.current = true;
      mutation.mutate();
    }
  }, [status, session, mutation, queryClient]);

  return mutation;
}

