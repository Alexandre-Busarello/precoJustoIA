/**
 * Portfolio (Carteira) Main Page
 * /carteira
 */

import { Metadata } from 'next';
import { PortfolioPageClient } from '@/components/portfolio-page-client';

export const metadata: Metadata = {
  title: 'Minhas Carteiras | Preço Justo',
  description: 'Gerencie suas carteiras de investimento com acompanhamento de transações, métricas de performance e análise de risco.',
};

export default function CarteiraPage() {
  return <PortfolioPageClient />;
}

