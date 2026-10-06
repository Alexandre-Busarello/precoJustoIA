/**
 * Criar carteira
 * /carteira/nova
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { CreatePortfolioPage } from '@/components/create-portfolio-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

export const metadata: Metadata = {
  title: 'Nova carteira',
  description: 'Crie uma carteira de investimentos e defina sua alocação-alvo de ativos.',
};

export default function CreatePortfolioPageRoute() {
  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <CreatePortfolioPage />
    </Suspense>
  );
}
