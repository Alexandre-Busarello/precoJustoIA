/**
 * Transações da carteira
 * /carteira/[id]/transacoes
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioTransactionsPage } from '@/components/portfolio-transactions-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Transações da carteira',
  description: 'Visualize e gerencie todas as transações da sua carteira de investimentos.',
};

export default async function PortfolioTransactionsPageRoute({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <PortfolioTransactionsPage portfolioId={id} />
    </Suspense>
  );
}
