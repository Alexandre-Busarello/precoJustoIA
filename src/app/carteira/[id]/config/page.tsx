/**
 * Portfolio Configuration Page
 * /carteira/[id]/config
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioConfigPage } from '@/components/portfolio-config-page';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  
  return {
    title: `Configurações da Carteira | Preço Justo`,
    description: 'Configure sua carteira de investimentos: nome, descrição, aportes mensais e alocações de ativos.',
  };
}

export default async function PortfolioConfigPageRoute({ params }: PageProps) {
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <PortfolioConfigPage portfolioId={resolvedParams.id} />
    </Suspense>
  );
}

