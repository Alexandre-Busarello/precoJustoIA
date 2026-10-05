import { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';

import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import { checkMonitorLimit, type TriggerConfig } from '@/lib/custom-trigger-service';
import CustomMonitorsList from '@/components/custom-monitors-list';
import { MonitorLimitBanner } from '@/components/monitor-limit-banner';
import { PageHeader } from '@/components/page-header';
import { AlertsTabs } from '@/components/alerts-tabs';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Monitoramentos',
  description: 'Gerencie seus alertas de preço-teto Bazin, desconto vs preço justo, dividend yield e indicadores',
};

interface MonitorRow {
  id: string;
  companyId: number;
  isActive: boolean | null;
  createdAt: Date;
  lastTriggeredAt: Date | null;
  isAlertActive: boolean | null;
  triggerConfig: unknown;
  company: { id: number; ticker: string; name: string; logoUrl: string | null } | null;
}

export default async function CustomMonitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login?callbackUrl=/dashboard/monitoramentos-customizados');
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?callbackUrl=/dashboard/monitoramentos-customizados');
  }

  const monitorsRaw = (await safeQueryWithParams(
    'user_asset_monitor',
    () =>
      prisma.userAssetMonitor.findMany({
        where: { userId: user.id },
        include: {
          company: {
            select: { id: true, ticker: true, name: true, logoUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    { userId: user.id },
    // Lista do próprio usuário: sem cache, para refletir na hora o que acabou de ser criado ou editado
    { skipCache: true }
  )) as MonitorRow[];

  const monitors = monitorsRaw
    .filter((m): m is MonitorRow & { company: NonNullable<MonitorRow['company']> } => m.company !== null)
    .map((m) => ({
      id: m.id,
      companyId: m.companyId,
      ticker: m.company.ticker,
      companyName: m.company.name,
      companyLogoUrl: m.company.logoUrl,
      triggerConfig: (m.triggerConfig || {}) as TriggerConfig,
      isActive: m.isActive ?? true,
      createdAt: m.createdAt,
      lastTriggeredAt: m.lastTriggeredAt,
      isAlertActive: m.isAlertActive ?? false,
    }));

  const activeCount = monitors.filter((m) => m.isActive).length;
  const pausedCount = monitors.length - activeCount;
  const { allowed, max: maxMonitors } = checkMonitorLimit(user.isPremium, activeCount); // max null = sem limite
  const isLimitReached = !allowed;
  const summary =
    monitors.length === 0
      ? 'Preço-teto, desconto vs preço justo, dividend yield e indicadores dos ativos que você acompanha.'
      : `${monitors.length} ${monitors.length === 1 ? 'monitoramento' : 'monitoramentos'}${
          pausedCount > 0 ? ` · ${pausedCount} ${pausedCount === 1 ? 'pausado' : 'pausados'}` : ''
        }`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <PageHeader
        title="Monitoramentos"
        description={summary}
        actions={
          isLimitReached ? (
            <Button disabled title="Limite do plano gratuito atingido">
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Criar monitoramento
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/monitoramentos-customizados/criar">
                <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Criar monitoramento
              </Link>
            </Button>
          )
        }
      />
      <AlertsTabs />

      {maxMonitors !== null && <MonitorLimitBanner current={activeCount} max={maxMonitors} showUpgrade={isLimitReached} />}

      <CustomMonitorsList monitors={monitors} />

      <section aria-labelledby="monitors-how" className="space-y-2 text-sm">
        <h2 id="monitors-how" className="text-lg font-semibold tracking-tight text-foreground">
          Como funciona
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Os critérios são verificados periodicamente com os dados mais recentes do ativo.</li>
          <li>Quando qualquer um dos critérios é atingido, você recebe um aviso com um resumo gerado por IA.</li>
          <li>Preço-teto Bazin: média de dividendos e JCP dos últimos 5 anos completos dividida pelo DY-alvo (6% por padrão).</li>
          <li>Desconto vs preço justo usa o preço justo do modelo escolhido; DY 12 meses soma os proventos com data-com no último ano.</li>
          <li>Você pode pausar, editar ou remover um monitoramento a qualquer momento.</li>
        </ul>
      </section>
    </div>
  );
}
