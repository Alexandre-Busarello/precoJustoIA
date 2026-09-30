import { Metadata } from 'next';
import { PortfolioAnalyticsPage } from '@/components/portfolio-analytics-page';

interface PortfolioAnalyticsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Análise da carteira',
  description: 'Evolução do patrimônio, comparação com CDI e Ibovespa, quedas e retornos mensais da carteira.',
};

export default async function Page({ params }: PortfolioAnalyticsPageProps) {
  const { id } = await params;
  return <PortfolioAnalyticsPage portfolioId={id} />;
}
