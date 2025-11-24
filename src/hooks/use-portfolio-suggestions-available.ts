'use client';

import { useQuery } from '@tanstack/react-query';

interface SuggestionsAvailableResult {
  hasSuggestions: boolean;
  isLoading: boolean;
  hasContributions: boolean;
  hasRebalancing: boolean;
  hasDividends: boolean;
}

/**
 * Hook to check if a portfolio has any suggestions available
 * Checks for contributions, rebalancing, and dividends
 */
export function usePortfolioSuggestionsAvailable(
  portfolioId: string,
  trackingStarted: boolean,
  cashBalance?: number
): SuggestionsAvailableResult {
  // Check contributions (only if cash >= 100)
  const hasCashForContributions = cashBalance !== undefined && cashBalance >= 100;
  const { data: contributionData, isLoading: loadingContributions } = useQuery({
    queryKey: ['portfolio-suggestions-check', portfolioId, 'contribution'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=contribution`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: trackingStarted && hasCashForContributions,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Check rebalancing
  const { data: rebalancingData, isLoading: loadingRebalancing } = useQuery({
    queryKey: ['portfolio-suggestions-check', portfolioId, 'rebalancing'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=rebalancing`);
      if (!response.ok) return { count: 0, suggestions: [] };
      return response.json();
    },
    enabled: trackingStarted,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Check dividends
  const { data: dividendData, isLoading: loadingDividends } = useQuery({
    queryKey: ['portfolio-suggestions-check', portfolioId, 'dividends'],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/${portfolioId}/suggestions?type=dividends`);
      if (!response.ok) return { count: 0 };
      return response.json();
    },
    enabled: trackingStarted,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  const hasContributions = (contributionData?.count || 0) > 0;
  const hasRebalancing = (rebalancingData?.suggestions?.length || 0) > 0;
  const hasDividends = (dividendData?.count || 0) > 0;
  const hasSuggestions = hasContributions || hasRebalancing || hasDividends;
  const isLoading = loadingContributions || loadingRebalancing || loadingDividends;

  return {
    hasSuggestions,
    isLoading,
    hasContributions,
    hasRebalancing,
    hasDividends,
  };
}

