import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isCurrentUserPremium } from '@/lib/user-service';
import { ReportDetailView } from '../report-detail-view';

interface PageProps {
  params: Promise<{
    ticker: string;
    reportId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker, reportId } = await params;

  const report = await prisma.aIReport.findUnique({
    where: { id: reportId },
    select: {
      type: true,
      changeDirection: true,
      company: {
        select: {
          ticker: true,
          name: true,
        },
      },
    },
  });

  if (!report || report.company.ticker !== ticker.toUpperCase()) {
    return {
      title: 'Relatório não encontrado',
    };
  }

  const { name, ticker: companyTicker } = report.company;

  if (report.type === 'MONTHLY_OVERVIEW') {
    return {
      title: `Análise mensal: ${name} (${companyTicker})`,
      description: `Análise mensal gerada por IA de ${name}, com valuation, indicadores e demonstrações financeiras.`,
    };
  }

  if (report.type === 'CUSTOM_TRIGGER') {
    return {
      title: `Gatilho personalizado: ${name} (${companyTicker})`,
      description: `Relatório de gatilho personalizado disparado para ${name}.`,
    };
  }

  if (report.type === 'PRICE_VARIATION') {
    return {
      title: `Variação de preço: ${name} (${companyTicker})`,
      description: `Análise da variação de preço de ${name} e do impacto nos fundamentos.`,
    };
  }

  const changeText = report.changeDirection === 'positive' ? 'Melhora' : 'Piora';
  return {
    title: `${changeText} fundamental: ${name} (${companyTicker})`,
    description: `Análise gerada por IA das mudanças nos fundamentos de ${name}.`,
  };
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { ticker, reportId } = await params;

  const report = await prisma.aIReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      type: true,
      content: true,
      changeDirection: true,
      previousScore: true,
      currentScore: true,
      likeCount: true,
      dislikeCount: true,
      createdAt: true,
      windowDays: true,
      conclusion: true,
      company: {
        select: {
          ticker: true,
          name: true,
        },
      },
    },
  });

  if (!report || report.company.ticker !== ticker.toUpperCase()) {
    notFound();
  }

  const [isPremium, currentUser] = await Promise.all([isCurrentUserPremium(), getCurrentUser()]);

  return (
    <ReportDetailView
      report={report}
      company={report.company}
      assetHref={`/acao/${ticker.toLowerCase()}`}
      isPremium={isPremium}
      isLoggedIn={!!currentUser}
    />
  );
}
