/**
 * Visão geral da carteira
 * /carteira/[id]
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioDetailPage } from '@/components/portfolio-detail-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Carteira',
  description: 'Acompanhe posições, retorno e alocação da sua carteira de investimentos.',
};

export default async function PortfolioDetailPageRoute({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <PortfolioDetailPage portfolioId={id} />
    </Suspense>
  );
}
