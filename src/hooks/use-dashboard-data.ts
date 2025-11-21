/**
 * Custom hooks for dashboard data with React Query and localStorage persistence
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getPlaceholderData, getInitialData, saveQueryCache } from '@/lib/react-query-persister';

// ===== Dashboard Stats =====

interface DashboardStats {
  rankingsToday: number;
  totalRankings: number;
  totalCompanies: number;
  availableModels: number;
  isPremium: boolean;
  hasUsedBacktest: boolean;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard-stats');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  return response.json();
}

/**
 * Hook para buscar estatísticas do dashboard
 * Cache: 5 minutos (dados podem mudar mais frequentemente)
 */
export function useDashboardStats() {
  const queryKey = ['dashboard-stats'];
  const staleTime = 5 * 60 * 1000; // 5 minutos
  const gcTime = 30 * 60 * 1000; // 30 minutos

  const initialCacheData = getInitialData<DashboardStats>(queryKey, staleTime);
  
  const query = useQuery<DashboardStats>({
    queryKey,
    queryFn: fetchDashboardStats,
    staleTime,
    gcTime,
    refetchOnMount: initialCacheData ? false : true, // Se temos dados frescos, não refetch
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<DashboardStats>(queryKey, staleTime),
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

// ===== Top Companies =====

interface TopCompany {
  ticker: string;
  companyName: string;
  score: number;
  sector: string | null;
  currentPrice: number;
  logoUrl: string | null;
  recommendation: string;
}

interface TopCompaniesResponse {
  companies: TopCompany[];
}

async function fetchTopCompanies(limit: number = 3, minScore: number = 80): Promise<TopCompaniesResponse> {
  const response = await fetch(`/api/top-companies?limit=${limit}&minScore=${minScore}`);
  if (!response.ok) {
    throw new Error('Failed to fetch top companies');
  }
  return response.json();
}

/**
 * Hook para buscar top empresas
 * Cache: 5 minutos (dados podem mudar mais frequentemente)
 */
export function useTopCompanies(limit: number = 3, minScore: number = 80) {
  const queryKey = ['top-companies', limit, minScore];
  const staleTime = 5 * 60 * 1000; // 5 minutos
  const gcTime = 30 * 60 * 1000; // 30 minutos

  const initialCacheData = getInitialData<TopCompaniesResponse>(queryKey, staleTime);
  
  const query = useQuery<TopCompaniesResponse>({
    queryKey,
    queryFn: () => fetchTopCompanies(limit, minScore),
    staleTime,
    gcTime,
    refetchOnMount: initialCacheData ? false : true, // Se temos dados frescos, não refetch
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<TopCompaniesResponse>(queryKey, staleTime),
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

// ===== Portfolios =====

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  startDate: string;
  monthlyContribution: number;
  rebalanceFrequency: string;
  lastTransactionAt: string | null;
  sourceBacktestId: string | null;
}

interface PortfoliosResponse {
  portfolios: Portfolio[];
}

async function fetchPortfolios(): Promise<PortfoliosResponse> {
  const response = await fetch('/api/portfolio');
  if (!response.ok) {
    throw new Error('Failed to fetch portfolios');
  }
  return response.json();
}

/**
 * Hook para buscar portfolios do usuário
 * Cache: 5 minutos (pode mudar quando usuário cria/modifica portfolio)
 */
export function usePortfolios() {
  const queryKey = ['portfolios'];
  const staleTime = 5 * 60 * 1000; // 5 minutos
  const gcTime = 30 * 60 * 1000; // 30 minutos

  const initialCacheData = getInitialData<PortfoliosResponse>(queryKey, staleTime);
  
  const query = useQuery<PortfoliosResponse>({
    queryKey,
    queryFn: fetchPortfolios,
    staleTime,
    gcTime,
    refetchOnMount: initialCacheData ? false : true, // Se temos dados frescos, não refetch
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<PortfoliosResponse>(queryKey, staleTime),
  });

  // Persist to localStorage only after a successful fetch (not from initialData)
  // Only cache if portfolios array has items
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
      // Houve um fetch real, salvar no cache (saveQueryCache já valida se tem dados)
      saveQueryCache(queryKey, query.data, true);
      previousDataUpdatedAtRef.current = query.dataUpdatedAt;
    }
  }, [query.data, query.dataUpdatedAt, queryKey, initialCacheData]);

  return query;
}

// ===== Dashboard Portfolios =====

interface DashboardPortfolio {
  id: string;
  name: string;
  currentValue: number;
  cashBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  netInvested: number;
  totalReturn: number;
  evolutionData: Array<{
    date: string;
    value: number;
  }>;
}

interface DashboardPortfoliosResponse {
  portfolios: DashboardPortfolio[];
}

async function fetchDashboardPortfolios(): Promise<DashboardPortfoliosResponse> {
  const response = await fetch('/api/portfolio/dashboard');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard portfolios');
  }
  return response.json();
}

/**
 * Hook para buscar portfolios da dashboard com métricas
 * Cache: 5 minutos
 */
export function useDashboardPortfolios() {
  const queryKey = ['dashboard-portfolios'];
  const staleTime = 5 * 60 * 1000; // 5 minutos
  const gcTime = 30 * 60 * 1000; // 30 minutos

  const initialCacheData = getInitialData<DashboardPortfoliosResponse>(queryKey, staleTime);
  
  const query = useQuery<DashboardPortfoliosResponse>({
    queryKey,
    queryFn: fetchDashboardPortfolios,
    staleTime,
    gcTime,
    refetchOnMount: initialCacheData ? false : true,
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<DashboardPortfoliosResponse>(queryKey, staleTime),
  });

  // Persist to localStorage only after a successful fetch (not from initialData)
  // Only cache if portfolios array has items (handled by saveQueryCache)
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
      // Houve um fetch real, salvar no cache (saveQueryCache já valida se tem dados)
      saveQueryCache(queryKey, query.data, true);
      previousDataUpdatedAtRef.current = query.dataUpdatedAt;
    }
  }, [query.data, query.dataUpdatedAt, queryKey, initialCacheData]);

  return query;
}

