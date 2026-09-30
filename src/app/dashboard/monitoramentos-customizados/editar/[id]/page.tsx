import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import type { TriggerConfig } from '@/lib/custom-trigger-service';
import CustomMonitorForm from '@/components/custom-monitor-form';
import { PageHeader } from '@/components/page-header';
import { AlertsTabs } from '@/components/alerts-tabs';

export const metadata: Metadata = {
  title: 'Editar monitoramento',
  description: 'Edite os critérios do seu monitoramento',
};

interface MonitorWithCompany {
  id: string;
  userId: string;
  companyId: number;
  isActive: boolean | null;
  triggerConfig: unknown;
  company: { id: number; ticker: string; name: string; logoUrl: string | null };
}

export default async function EditCustomMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: monitorId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/dashboard/monitoramentos-customizados/editar/${monitorId}`)}`);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?callbackUrl=/dashboard/monitoramentos-customizados');
  }

  const monitor = (await safeQueryWithParams(
    'user-custom-monitor-by-id',
    () =>
      prisma.userAssetMonitor.findUnique({
        where: { id: monitorId },
        include: {
          company: {
            select: { id: true, ticker: true, name: true, logoUrl: true },
          },
        },
      }),
    { monitorId }
  )) as MonitorWithCompany | null;

  if (!monitor) {
    notFound();
  }

  if (monitor.userId !== user.id) {
    redirect('/dashboard/monitoramentos-customizados');
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title={`Editar monitoramento de ${monitor.company.ticker}`}
        description="Ajuste os critérios ou pause o monitoramento."
        breadcrumb={[
          { label: 'Monitoramentos', href: '/dashboard/monitoramentos-customizados' },
          { label: monitor.company.ticker },
        ]}
      />
      <AlertsTabs />
      <CustomMonitorForm
        initialData={{
          id: monitor.id,
          companyId: monitor.companyId,
          ticker: monitor.company.ticker,
          companyName: monitor.company.name,
          triggerConfig: (monitor.triggerConfig || {}) as TriggerConfig,
          isActive: monitor.isActive ?? true,
        }}
      />
    </div>
  );
}
