import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import CustomMonitorForm, { type MonitorCompany } from '@/components/custom-monitor-form';
import { PageHeader } from '@/components/page-header';
import { AlertsTabs } from '@/components/alerts-tabs';

export const metadata: Metadata = {
  title: 'Criar monitoramento',
  description: 'Configure um preço-alvo ou limites de indicadores e receba um aviso quando o ativo atingir',
};

const TICKER_PATTERN = /^[A-Z0-9]{4,12}$/;

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.trim() : null;
}

export default async function CreateCustomMonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tickerParam = firstParam(params.ticker)?.toUpperCase() ?? null;
  const ticker = tickerParam && TICKER_PATTERN.test(tickerParam) ? tickerParam : null;
  const type = firstParam(params.type);

  const session = await getServerSession(authOptions);
  if (!session) {
    const query = new URLSearchParams();
    if (ticker) query.set('ticker', ticker);
    if (type) query.set('type', type);
    const qs = query.toString();
    const target = `/dashboard/monitoramentos-customizados/criar${qs ? `?${qs}` : ''}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?callbackUrl=/dashboard/monitoramentos-customizados/criar');
  }

  // ?ticker=PETR4 (link "Acompanhar" da página do ativo) já chega com a empresa selecionada
  const defaultCompany: MonitorCompany | null = ticker
    ? ((await safeQueryWithParams(
        'company-by-ticker-for-monitor',
        () => prisma.company.findUnique({ where: { ticker }, select: { id: true, ticker: true, name: true } }),
        { ticker }
      )) as MonitorCompany | null)
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Criar monitoramento"
        description={
          defaultCompany
            ? `Defina quando você quer ser avisado sobre ${defaultCompany.ticker}.`
            : 'Escolha o ativo e defina quando você quer ser avisado.'
        }
        breadcrumb={[
          { label: 'Monitoramentos', href: '/dashboard/monitoramentos-customizados' },
          { label: 'Criar' },
        ]}
      />
      <AlertsTabs />
      <CustomMonitorForm defaultCompany={defaultCompany} focusField={type} />
    </div>
  );
}
