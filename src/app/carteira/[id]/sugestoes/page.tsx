/**
 * Sugestões da carteira
 * /carteira/[id]/sugestoes
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioSuggestionsPage } from '@/components/portfolio-suggestions-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Sugestões da carteira',
  description: 'Aportes, ajustes para a sua alocação-alvo e dividendos a registrar na carteira.',
};

export default async function PortfolioSuggestionsRoute({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <PortfolioSuggestionsPage portfolioId={id} />
    </Suspense>
  );
}
