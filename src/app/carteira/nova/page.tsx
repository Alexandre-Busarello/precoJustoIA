/**
 * Create Portfolio Page
 * /carteira/nova
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { CreatePortfolioPage } from '@/components/create-portfolio-page';

export const metadata: Metadata = {
  title: 'Criar Nova Carteira | Preço Justo',
  description: 'Crie uma nova carteira de investimentos e configure sua estratégia de alocação de ativos.',
};

export default function CreatePortfolioPageRoute() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <CreatePortfolioPage />
    </Suspense>
  );
}

