import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import SubscriptionsList from '@/components/subscriptions-list';
import ReportPreferences from '@/components/report-preferences';
import { PageHeader } from '@/components/page-header';
import { AlertsTabs } from '@/components/alerts-tabs';
import { NotificationService } from '@/lib/notification-service';

export const metadata: Metadata = {
  title: 'Alertas de preço',
  description: 'Ativos que você acompanha por e-mail: quedas de preço, mudanças de score e relatório mensal',
};

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/dashboard/subscriptions');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?callbackUrl=/dashboard/subscriptions');
  }

  // Buscar inscrições do usuário
  const subscriptions = await safeQueryWithParams(
    'user-subscriptions-with-details',
    () =>
      prisma.userAssetSubscription.findMany({
        where: { userId: user.id },
        include: {
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
              sector: true,
              logoUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    { userId: user.id }
  );

  // Buscar preferências de notificações
  const notificationPreferences = await NotificationService.getUserNotificationPreferences(user.id);

  // Buscar preferências de relatórios diretamente do banco
  const userWithPreferences = await prisma.user.findUnique({
    where: { id: user.id },
    select: { reportPreferences: true },
  });

  const reportPreferences = userWithPreferences?.reportPreferences as {
    MONTHLY_OVERVIEW?: boolean;
    FUNDAMENTAL_CHANGE?: boolean;
    PRICE_VARIATION?: boolean;
  } | null;

  const subscriptionList = subscriptions as Array<{
    id: string;
    createdAt: Date;
    company: { id: number; ticker: string; name: string; sector: string | null; logoUrl: string | null };
  }>;
  const count = subscriptionList.length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <PageHeader
        title="Alertas de preço"
        description={
          count === 0
            ? 'Receba por e-mail quedas relevantes de preço, mudanças de score e um relatório mensal dos ativos que acompanha.'
            : `${count} ${count === 1 ? 'ativo acompanhado' : 'ativos acompanhados'} por e-mail`
        }
      />
      <AlertsTabs />

      <section aria-labelledby="subscriptions-list" className="space-y-3">
        <h2 id="subscriptions-list" className="text-lg font-semibold tracking-tight text-foreground">
          Ativos acompanhados
        </h2>
        <SubscriptionsList
          subscriptions={subscriptionList}
          emailNotificationsEnabled={notificationPreferences.emailNotificationsEnabled}
        />
      </section>

      <ReportPreferences initialPreferences={reportPreferences} />

      <section aria-labelledby="subscriptions-how" className="space-y-2 text-sm">
        <h2 id="subscriptions-how" className="text-lg font-semibold tracking-tight text-foreground">
          Como funciona
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Os ativos da lista são analisados continuamente.</li>
          <li>Quando o score geral varia mais de 10 pontos, ou o preço cai de forma relevante, você recebe um e-mail.</li>
          <li>Cada aviso traz um resumo gerado por IA explicando o que mudou. É uma estimativa, não é recomendação.</li>
          <li>
            Para preço-alvo e limites de indicadores, use os monitoramentos. Para parar de receber, cancele o ativo na lista acima.
          </li>
        </ul>
      </section>
    </div>
  );
}
