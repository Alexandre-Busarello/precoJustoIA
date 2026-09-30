import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PredecessorTickerLink } from '@/components/predecessor-ticker-link';
import { isCurrentUserPremium, getCurrentUser } from '@/lib/user-service';
import { AIReportsService } from '@/lib/ai-reports-service';
import { ReportsListView, reportsSummary } from './reports-list-view';
import type { ReportsTableRow } from './reports-table';
import { reportTitle, reportTypeLabel, windowLabel } from './report-utils';

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
      title: 'Empresa não encontrada',
    };
  }

  return {
    title: `Relatórios: ${company.name} (${company.ticker})`,
    description: `Relatórios e análises dos últimos 6 meses de ${company.name}. Acompanhe a evolução recente do ativo.`,
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
      predecessor: {
        select: {
          ticker: true,
        },
      },
    },
  });

  if (!company) {
    notFound();
  }

  const isPremium = await isCurrentUserPremium();
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id || null;

  // Apenas relatórios dos últimos 6 meses (mais antigos perdem relevância na tela do ativo)
  const displayCutoff = AIReportsService.getDisplayCutoffDate();
  const allReports = await prisma.aIReport.findMany({
    where: {
      companyId: company.id,
      status: 'COMPLETED',
      createdAt: { gte: displayCutoff },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  // Flags ativos ligados aos relatórios indicam perda de fundamento
  const flaggedReportIds = new Set<string>();
  try {
    const activeFlags = await prisma.companyFlag.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        reportId: {
          in: allReports.map((r) => r.id),
        },
      },
      select: {
        reportId: true,
      },
    });
    activeFlags.forEach((flag) => {
      if (flag.reportId) flaggedReportIds.add(flag.reportId);
    });
  } catch (error) {
    console.warn('Erro ao buscar flags para relatórios:', error);
  }

  // CUSTOM_TRIGGER só aparece para quem criou o gatilho
  const reports = allReports.filter((report) => report.type !== 'CUSTOM_TRIGGER' || report.userId === currentUserId);

  const basePath = `/acao/${ticker.toLowerCase()}`;
  const rows: ReportsTableRow[] = reports.map((report) => {
    const type = report.type as string;
    const isChange = type === 'FUNDAMENTAL_CHANGE';
    const window = type === 'PRICE_VARIATION' ? windowLabel(report.windowDays) : null;
    const extra: ReportsTableRow['extra'] =
      type === 'PRICE_VARIATION' && isPremium && flaggedReportIds.has(report.id)
        ? { label: 'Perda de fundamentos', variant: 'negative' }
        : window
          ? { label: window, variant: 'neutral' }
          : undefined;
    return {
      id: report.id,
      href: `${basePath}/relatorios/${report.id}`,
      createdAt: report.createdAt.toISOString(),
      title: reportTitle(report.content, type),
      typeLabel: isChange ? (report.changeDirection === 'positive' ? 'Melhora fundamental' : 'Piora fundamental') : reportTypeLabel(type),
      tone: isChange ? (report.changeDirection === 'positive' ? 'positive' : 'negative') : 'neutral',
      extra,
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
      aside={
        company.predecessor ? (
          <PredecessorTickerLink
            predecessorTicker={company.predecessor.ticker}
            currentTicker={company.ticker}
            pageType="relatorios"
          />
        ) : undefined
      }
    />
  );
}
