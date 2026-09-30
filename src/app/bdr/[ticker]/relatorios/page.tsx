import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isCurrentUserPremium, getCurrentUser } from '@/lib/user-service';
import { AIReportsService } from '@/lib/ai-reports-service';
import { ReportsListView, reportsSummary } from '@/app/acao/[ticker]/relatorios/reports-list-view';
import type { ReportsTableRow } from '@/app/acao/[ticker]/relatorios/reports-table';
import { reportTitle, reportTypeLabel } from '@/app/acao/[ticker]/relatorios/report-utils';

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;

  const company = await prisma.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: {
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    return {
      title: 'BDR não encontrado',
    };
  }

  return {
    title: `Relatórios: ${company.name} (${company.ticker})`,
    description: `Relatórios e análises dos últimos 6 meses do BDR ${company.name}. Acompanhe a evolução recente do ativo.`,
  };
}

export default async function ReportsListPage({ params }: PageProps) {
  const { ticker } = await params;

  const company = await prisma.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: {
      id: true,
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    notFound();
  }

  const isPremium = await isCurrentUserPremium();
  const currentUser = await getCurrentUser();

  const displayCutoff = AIReportsService.getDisplayCutoffDate();
  const reports = await prisma.aIReport.findMany({
    where: {
      companyId: company.id,
      status: 'COMPLETED',
      createdAt: { gte: displayCutoff },
      // Gatilhos personalizados só aparecem para quem os criou
      OR: [{ type: { not: 'CUSTOM_TRIGGER' } }, ...(currentUser ? [{ userId: currentUser.id }] : [])],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
    select: {
      id: true,
      type: true,
      content: true,
      changeDirection: true,
      createdAt: true,
    },
  });

  const basePath = `/bdr/${ticker.toLowerCase()}`;
  const rows: ReportsTableRow[] = reports.map((report) => {
    const type = report.type as string;
    const isChange = type === 'FUNDAMENTAL_CHANGE';
    return {
      id: report.id,
      href: `${basePath}/relatorios/${report.id}`,
      createdAt: report.createdAt.toISOString(),
      title: reportTitle(report.content, type),
      typeLabel: isChange ? (report.changeDirection === 'positive' ? 'Melhora fundamental' : 'Piora fundamental') : reportTypeLabel(type),
      tone: isChange ? (report.changeDirection === 'positive' ? 'positive' : 'negative') : 'neutral',
    };
  });

  return (
    <ReportsListView
      company={company}
      assetHref={basePath}
      rows={rows}
      windowMonths={AIReportsService.DISPLAY_WINDOW_MONTHS}
      isPremium={isPremium}
      isLoggedIn={!!currentUser}
      summary={reportsSummary(reports.map((r) => ({ type: r.type as string, changeDirection: r.changeDirection })))}
    />
  );
}
