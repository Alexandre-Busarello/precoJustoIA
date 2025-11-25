'use client'

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { DividendProjection } from '@/lib/dividend-radar-service';

interface GridCompany {
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl: string | null;
  projections: DividendProjection[];
}

interface GridResponse {
  success: boolean;
  companies: GridCompany[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  offset: number;
  limit: number;
  cached?: boolean;
}

interface HistoricalDividend {
  month: number;
  year: number;
  exDate: Date;
  amount: number;
}

interface ProjectionsResponse {
  success: boolean;
  ticker: string;
  projections: DividendProjection[];
  historicalDividends?: HistoricalDividend[];
  allHistoricalDividends?: HistoricalDividend[];
  count: number;
  historicalCount?: number;
  allHistoricalCount?: number;
}

/**
 * Hook para buscar projeções de um ticker específico
 */
export function useDividendRadarProjections(ticker: string | null) {
  return useQuery<ProjectionsResponse>({
    queryKey: ['dividend-radar-projections', ticker],
    queryFn: async () => {
      if (!ticker) throw new Error('Ticker é obrigatório');
      
      const response = await fetch(`/api/dividend-radar/projections/${ticker}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar projeções');
      }
      return response.json();
    },
    enabled: !!ticker,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Hook para buscar grid completo do radar de dividendos com paginação infinita
 */
export function useDividendRadarGrid(params: {
  search?: string;
  sector?: string;
  period?: string; // '3', '6', ou '12'
  myAssets?: boolean;
  dateType?: 'exDate' | 'paymentDate';
  oneTickerPerStock?: boolean;
  limit?: number;
}) {
  const {
    search = '',
    sector = '',
    period = '12',
    myAssets = false,
    dateType = 'exDate',
    oneTickerPerStock = false,
    limit = 20,
  } = params;

  return useInfiniteQuery<GridResponse>({
    queryKey: [
      'dividend-radar-grid',
      search,
      sector,
      period,
      myAssets,
      dateType,
      oneTickerPerStock,
      limit,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = new URLSearchParams({
        search,
        sector,
        period,
        myAssets: String(myAssets),
        dateType,
        oneTickerPerStock: String(oneTickerPerStock),
        limit: String(limit),
        offset: String(pageParam),
      });

      const response = await fetch(`/api/dividend-radar/grid?${searchParams}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar grid');
      }
      return response.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.reduce((acc, page) => acc + page.count, 0);
      }
      return undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

