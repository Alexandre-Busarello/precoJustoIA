/**
 * Custom hooks for company/ticker data with React Query and localStorage persistence
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getPlaceholderData, getInitialData, saveQueryCache, removeQueryCache } from '@/lib/react-query-persister';

// ===== Company Analysis =====

interface OverallScore {
  score: number;
  grade: string;
}

interface CompanyAnalysisResponse {
  overallScore: OverallScore | null;
  strategies: Array<{
    name: string;
    description: string;
    score: number;
  }>;
}

async function fetchCompanyAnalysis(ticker: string): Promise<CompanyAnalysisResponse> {
  const response = await fetch(`/api/company-analysis/${ticker}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch company analysis for ${ticker}`);
  }
  return response.json();
}

/**
 * Hook para buscar análise completa da empresa (score geral e estratégias)
 * Cache: 24 horas (dados mudam 1x ao dia)
 */
export function useCompanyAnalysis(ticker: string) {
  const queryKey = ['company-analysis', ticker.toUpperCase()];
  const staleTime = 24 * 60 * 60 * 1000; // 24 horas
  const gcTime = 7 * 24 * 60 * 60 * 1000; // 7 dias

  // Tentar obter dados iniciais do cache (impede fetch se dados estão frescos)
  const initialCacheData = getInitialData<CompanyAnalysisResponse>(queryKey, staleTime);
  
  const query = useQuery<CompanyAnalysisResponse>({
    queryKey,
    queryFn: () => fetchCompanyAnalysis(ticker.toUpperCase()),
    staleTime,
    gcTime,
    refetchOnMount: false, // Dados mudam 1x ao dia, não precisa refetch ao montar
    // Se temos dados frescos no cache, usar como initialData (impede fetch)
    // initialDataUpdatedAt indica quando os dados foram atualizados, permitindo que React Query saiba que estão frescos
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    // Se não temos dados frescos, usar placeholderData para mostrar dados antigos enquanto carrega
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<CompanyAnalysisResponse>(queryKey, staleTime),
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

// ===== Financial History =====

interface FinancialHistoryResponse {
  indicator: string;
  values: Array<{
    year: number;
    value: number | null;
  }>;
}

async function fetchFinancialHistory(ticker: string, indicator: string): Promise<FinancialHistoryResponse> {
  const response = await fetch(`/api/financial-history/${ticker}?indicator=${indicator}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch financial history for ${ticker}`);
  }
  return response.json();
}

/**
 * Hook para buscar histórico financeiro de um indicador específico
 * Cache: 24 horas
 */
export function useCompanyFinancialHistory(ticker: string, indicator: string) {
  const queryKey = ['financial-history', ticker.toUpperCase(), indicator];
  const staleTime = 24 * 60 * 60 * 1000; // 24 horas
  const gcTime = 7 * 24 * 60 * 60 * 1000; // 7 dias

  const initialCacheData = getInitialData<FinancialHistoryResponse>(queryKey, staleTime);
  
  const query = useQuery<FinancialHistoryResponse>({
    queryKey,
    queryFn: () => fetchFinancialHistory(ticker.toUpperCase(), indicator),
    enabled: !!ticker && !!indicator,
    staleTime,
    gcTime,
    refetchOnMount: false,
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<FinancialHistoryResponse>(queryKey, staleTime),
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

// ===== Historical Prices =====

interface HistoricalData {
  date: string;
  price: number;
  volume: number;
}

interface StochasticData {
  k: number;
  d: number;
}

interface TechnicalAnalysis {
  currentRSI: number | null;
  currentMACD: number | null;
  currentStochastic: StochasticData | null;
  overallSignal: 'SOBRECOMPRA' | 'SOBREVENDA' | 'NEUTRO';
}

interface HistoricalPricesResponse {
  ticker: string;
  companyName: string;
  historicalData: HistoricalData[];
  technicalAnalysis: TechnicalAnalysis | null;
  dataCount: number;
  lastUpdate: string;
  message?: string;
}

async function fetchHistoricalPrices(ticker: string): Promise<HistoricalPricesResponse> {
  const response = await fetch(`/api/historical-prices/${ticker}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch historical prices for ${ticker}`);
  }
  return response.json();
}

/**
 * Hook para buscar preços históricos e análise técnica
 * Cache: 24 horas
 */
export function useHistoricalPrices(ticker: string) {
  const queryKey = ['historical-prices', ticker.toUpperCase()];
  const staleTime = 24 * 60 * 60 * 1000; // 24 horas
  const gcTime = 7 * 24 * 60 * 60 * 1000; // 7 dias

  const initialCacheData = getInitialData<HistoricalPricesResponse>(queryKey, staleTime);
  
  const query = useQuery<HistoricalPricesResponse>({
    queryKey,
    queryFn: () => fetchHistoricalPrices(ticker.toUpperCase()),
    enabled: !!ticker,
    staleTime,
    gcTime,
    refetchOnMount: false,
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<HistoricalPricesResponse>(queryKey, staleTime),
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

// ===== Asset Subscription =====

interface AssetSubscriptionResponse {
  isSubscribed: boolean;
  requiresAuth?: boolean;
  subscription?: {
    id: string;
    createdAt: string;
  } | null;
  error?: string;
}

async function fetchAssetSubscription(ticker: string): Promise<AssetSubscriptionResponse> {
  const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset subscription for ${ticker}`);
  }
  return response.json();
}

/**
 * Hook para verificar se usuário está inscrito em um ativo
 * Cache: 5 minutos (pode mudar quando usuário se inscreve/desinscreve)
 */
export function useAssetSubscription(ticker: string) {
  const queryKey = ['asset-subscription', ticker.toUpperCase()];
  const staleTime = 5 * 60 * 1000; // 5 minutos
  const gcTime = 30 * 60 * 1000; // 30 minutos

  const initialCacheData = getInitialData<AssetSubscriptionResponse>(queryKey, staleTime);
  
  const query = useQuery<AssetSubscriptionResponse>({
    queryKey,
    queryFn: () => fetchAssetSubscription(ticker.toUpperCase()),
    enabled: !!ticker,
    staleTime,
    gcTime,
    refetchOnMount: initialCacheData ? false : true, // Se temos dados frescos, não refetch
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<AssetSubscriptionResponse>(queryKey, staleTime),
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

// ===== AI Reports =====

interface AIReport {
  id: number;
  companyId: number;
  type: 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE';
  content: string;
  changeDirection?: 'positive' | 'negative' | null;
  previousScore?: number | null;
  currentScore?: number | null;
  strategicAnalyses?: any;
  likeCount?: number;
  dislikeCount?: number;
  createdAt: string;
  isActive: boolean;
  status: string;
  isPreview?: boolean;
}

interface AIReportsResponse {
  success: boolean;
  report?: AIReport;
  reports?: AIReport[];
  count?: number;
  error?: string;
}

async function fetchAIReports(
  ticker: string,
  type: 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | null = 'MONTHLY_OVERVIEW'
): Promise<AIReportsResponse> {
  const response = await fetch(`/api/ai-reports/${ticker}?type=${type || 'MONTHLY_OVERVIEW'}`);
  
  // Se for 404, retornar resposta válida indicando que não há relatório (não é um erro)
  if (response.status === 404) {
    const errorData = await response.json().catch(() => ({ error: 'Nenhum relatório encontrado para este ativo' }));
    return {
      success: false,
      error: errorData.error || 'Nenhum relatório encontrado para este ativo'
    };
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch AI reports for ${ticker}`);
  }
  return response.json();
}

/**
 * Hook para buscar relatórios AI de uma empresa
 * Cache: 24 horas (relatórios são gerados mensalmente ou quando há mudanças fundamentais)
 */
export function useAIReports(
  ticker: string,
  type: 'MONTHLY_OVERVIEW' | 'FUNDAMENTAL_CHANGE' | null = 'MONTHLY_OVERVIEW'
) {
  const queryKey = ['ai-reports', ticker.toUpperCase(), type || 'MONTHLY_OVERVIEW'];
  const staleTime = 24 * 60 * 60 * 1000; // 24 horas
  const gcTime = 7 * 24 * 60 * 60 * 1000; // 7 dias

  const initialCacheData = getInitialData<AIReportsResponse>(queryKey, staleTime);
  
  const query = useQuery<AIReportsResponse>({
    queryKey,
    queryFn: () => fetchAIReports(ticker.toUpperCase(), type),
    enabled: !!ticker,
    staleTime,
    gcTime,
    refetchOnMount: false, // Relatórios mudam mensalmente ou quando há mudanças fundamentais
    initialData: initialCacheData?.data,
    initialDataUpdatedAt: initialCacheData?.updatedAt,
    placeholderData: initialCacheData ? undefined : () => getPlaceholderData<AIReportsResponse>(queryKey, staleTime),
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
 * Função helper para invalidar cache de subscription quando usuário se inscreve/cancela
 * Remove tanto o cache do React Query quanto do localStorage
 */
export function invalidateAssetSubscriptionCache(queryClient: ReturnType<typeof useQueryClient>, ticker: string) {
  const queryKey = ['asset-subscription', ticker.toUpperCase()];
  
  // Invalidar cache do React Query
  queryClient.invalidateQueries({ queryKey });
  
  // Remover cache do localStorage também
  removeQueryCache(queryKey);
}

/**
 * Função helper para invalidar TODOS os caches relacionados a um ticker específico
 * Invalida: company-analysis, financial-history, historical-prices, asset-subscription, ai-reports
 */
export function invalidateTickerCache(queryClient: ReturnType<typeof useQueryClient>, ticker: string) {
  const tickerUpper = ticker.toUpperCase();
  
  // Invalidar todas as queries relacionadas ao ticker
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const queryKey = query.queryKey;
      // Verificar se a query está relacionada ao ticker
      return (
        // company-analysis
        (queryKey[0] === 'company-analysis' && queryKey[1] === tickerUpper) ||
        // financial-history (pode ter múltiplos indicadores)
        (queryKey[0] === 'financial-history' && queryKey[1] === tickerUpper) ||
        // historical-prices
        (queryKey[0] === 'historical-prices' && queryKey[1] === tickerUpper) ||
        // asset-subscription
        (queryKey[0] === 'asset-subscription' && queryKey[1] === tickerUpper) ||
        // ai-reports (MONTHLY_OVERVIEW e FUNDAMENTAL_CHANGE)
        (queryKey[0] === 'ai-reports' && queryKey[1] === tickerUpper)
      );
    }
  });
  
  // Também refetch todas as queries invalidadas
  queryClient.refetchQueries({ 
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        (queryKey[0] === 'company-analysis' && queryKey[1] === tickerUpper) ||
        (queryKey[0] === 'financial-history' && queryKey[1] === tickerUpper) ||
        (queryKey[0] === 'historical-prices' && queryKey[1] === tickerUpper) ||
        (queryKey[0] === 'asset-subscription' && queryKey[1] === tickerUpper) ||
        (queryKey[0] === 'ai-reports' && queryKey[1] === tickerUpper)
      );
    }
  });
}
