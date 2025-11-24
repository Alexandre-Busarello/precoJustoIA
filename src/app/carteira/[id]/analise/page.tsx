import { PortfolioAnalyticsPage } from '@/components/portfolio-analytics-page';

interface PortfolioAnalyticsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: PortfolioAnalyticsPageProps) {
  const resolvedParams = await params;
  return <PortfolioAnalyticsPage portfolioId={resolvedParams.id} />;
}

