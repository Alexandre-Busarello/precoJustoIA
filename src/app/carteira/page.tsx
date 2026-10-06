/**
 * Lista de carteiras
 * /carteira
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioListPage } from '@/components/portfolio-list-page';
import { PortfolioPageSkeleton } from '@/components/portfolio-page-shell';

export const metadata: Metadata = {
  title: 'Minhas carteiras',
  description: 'Gerencie suas carteiras de investimento com acompanhamento de transações, métricas de desempenho e análise de risco.',
};

export default function CarteiraPage() {
  return (
    <Suspense fallback={<PortfolioPageSkeleton />}>
      <PortfolioListPage />
    </Suspense>
  );
}
