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
import { isAlertType, isPrefillType } from '../../monitor-fields';

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

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.trim() : null;
}

export default async function EditCustomMonitorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: monitorId } = await params;
  const query = await searchParams;
  // `?type=` vem do redirecionamento da criação quando o ativo já tem monitoramento ativo
  // Só tipos conhecidos pré-preenchem um critério; ausentes ou inválidos são ignorados.
  const rawType = firstParam(query.type);
  const type = isPrefillType(rawType) ? rawType : null;
  const fromCreate = firstParam(query.origem) === 'criar';

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
    { monitorId },
    // Leitura por usuário: sem cache, para não abrir a edição com critérios antigos
    { skipCache: true }
  )) as MonitorWithCompany | null;

  if (!monitor) {
    notFound();
  }

  if (monitor.userId !== user.id) {
    redirect('/dashboard/monitoramentos-customizados');
  }

  const ticker = monitor.company.ticker;
  const isPaused = monitor.isActive === false;
  let description = isPaused
    ? 'Este monitoramento está pausado. Ajuste os critérios ou reative para voltar a receber avisos.'
    : 'Ajuste os critérios ou pause o monitoramento.';
  if (fromCreate) {
    const opening = isPaused ? `Você já tem um monitoramento pausado de ${ticker}.` : `Você já monitora ${ticker}.`;
    const next = type
      ? isAlertType(type)
        ? `O novo critério já aparece junto aos atuais: revise${isPaused ? ', reative' : ''} e salve.`
        : `Preencha o novo critério junto aos atuais${isPaused ? ', reative' : ''} e salve.`
      : isPaused
        ? 'Ajuste os critérios e reative para voltar a receber avisos.'
        : 'Ajuste os critérios ou pause o monitoramento.';
    description = `${opening} ${next}`;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title={`Editar monitoramento de ${monitor.company.ticker}`}
        description={description}
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
        focusField={type}
      />
    </div>
  );
}
