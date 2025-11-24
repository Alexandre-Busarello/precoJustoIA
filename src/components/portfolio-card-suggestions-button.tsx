'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { usePortfolioSuggestionsAvailable } from '@/hooks/use-portfolio-suggestions-available';

interface PortfolioCardSuggestionsButtonProps {
  portfolioId: string;
  trackingStarted: boolean;
  cashBalance?: number;
}

export function PortfolioCardSuggestionsButton({
  portfolioId,
  trackingStarted,
  cashBalance,
}: PortfolioCardSuggestionsButtonProps) {
  const router = useRouter();
  const { hasSuggestions, isLoading } = usePortfolioSuggestionsAvailable(
    portfolioId,
    trackingStarted,
    cashBalance
  );

  // Show button if tracking started and:
  // 1. Has cash >= 100 (potential contributions) OR
  // 2. Has any suggestions (rebalancing/dividends) OR
  // 3. Still loading (to avoid flickering)
  if (!trackingStarted) {
    return null;
  }

  // Show button if we have suggestions or are still checking
  // Also show if cash >= 100 even if suggestions haven't loaded yet
  const shouldShow = hasSuggestions || isLoading || (cashBalance !== undefined && cashBalance >= 100);

  if (!shouldShow) {
    return null;
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/carteira/${portfolioId}/sugestoes`);
      }}
      disabled={isLoading}
    >
      <Sparkles className="h-4 w-4 mr-2" />
      {isLoading ? 'Verificando...' : 'Ver Sugestões'}
    </Button>
  );
}

