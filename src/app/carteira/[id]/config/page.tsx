/**
 * Configurações da carteira
 * /carteira/[id]/config
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioConfigPage } from '@/components/portfolio-config-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Configurações da carteira',
  description: 'Configure nome, descrição, aporte mensal, rebalanceamento e alocação-alvo da carteira.',
};

export default async function PortfolioConfigPageRoute({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <PortfolioConfigPage portfolioId={id} />
    </Suspense>
  );
}
