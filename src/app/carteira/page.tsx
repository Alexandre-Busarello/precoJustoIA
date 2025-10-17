/**
 * Portfolio (Carteira) Main Page
 * /carteira
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioPageClient } from '@/components/portfolio-page-client';

export const metadata: Metadata = {
  title: 'Minhas Carteiras | Preço Justo',
  description: 'Gerencie suas carteiras de investimento com acompanhamento de transações, métricas de performance e análise de risco.',
};

export default function CarteiraPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PortfolioPageClient />
    </Suspense>
  );
}

