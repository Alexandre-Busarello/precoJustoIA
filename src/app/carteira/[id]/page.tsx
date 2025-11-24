/**
 * Portfolio Detail Page
 * /carteira/[id]
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioDetailPage } from '@/components/portfolio-detail-page';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  
  return {
    title: `Carteira ${resolvedParams.id} | Preço Justo`,
    description: 'Gerencie suas transações e acompanhe o desempenho da sua carteira de investimentos.',
  };
}

export default async function PortfolioDetailPageRoute({ params }: PageProps) {
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PortfolioDetailPage portfolioId={resolvedParams.id} />
    </Suspense>
  );
}

