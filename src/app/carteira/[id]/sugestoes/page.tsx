/**
 * Portfolio Suggestions Page
 * /carteira/[id]/sugestoes
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioSuggestionsPage } from '@/components/portfolio-suggestions-page';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Sugestões de Transações | Carteira ${resolvedParams.id.slice(0, 8)}`,
    description: 'Visualize e confirme sugestões de transações para sua carteira',
  };
}

export default async function PortfolioSuggestionsRoute({ params }: PageProps) {
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PortfolioSuggestionsPage portfolioId={resolvedParams.id} />
    </Suspense>
  );
}

