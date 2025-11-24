/**
 * Portfolio Transactions Page
 * /carteira/[id]/transacoes
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioTransactionsPage } from '@/components/portfolio-transactions-page';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  
  return {
    title: `Transações da Carteira | Preço Justo`,
    description: 'Visualize e gerencie todas as transações da sua carteira de investimentos.',
  };
}

export default async function PortfolioTransactionsPageRoute({ params }: PageProps) {
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PortfolioTransactionsPage portfolioId={resolvedParams.id} />
    </Suspense>
  );
}

