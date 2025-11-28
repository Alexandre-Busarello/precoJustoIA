import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import SubscriptionsList from '@/components/subscriptions-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Bell, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationService } from '@/lib/notification-service';

export const metadata: Metadata = {
  title: 'Minhas Inscrições | Preço Justo AI',
  description: 'Gerencie suas inscrições para receber notificações sobre mudanças fundamentais em ações',
};

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Link>
        </Button>

        <div className="flex items-center space-x-3 mb-2">
          <Bell className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Minhas Inscrições</h1>
        </div>
        <p className="text-muted-foreground">
          Gerencie os ativos que você está monitorando. Você receberá notificações por email quando houver
          mudanças significativas nos fundamentos.
        </p>
      </div>

      {/* Stats Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Ativos Monitorados</p>
              <p className="text-3xl font-bold">{(subscriptions as any[]).length}</p>
            </div>
            <Bell className="w-12 h-12 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      {/* Lista de inscrições */}
      <SubscriptionsList 
        subscriptions={subscriptions as any[]} 
        emailNotificationsEnabled={notificationPreferences.emailNotificationsEnabled}
      />

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como Funciona?</CardTitle>
          <CardDescription>
            Entenda o sistema de monitoramento de ativos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">📊 Monitoramento Contínuo</h4>
            <p className="text-muted-foreground">
              Nosso sistema analisa continuamente os fundamentos dos ativos que você está monitorando.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">🔔 Notificações Inteligentes</h4>
            <p className="text-muted-foreground">
              Você receberá um email sempre que o Score Geral de um ativo variar significativamente
              (mais de 5 pontos).
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">📝 Relatórios Detalhados</h4>
            <p className="text-muted-foreground">
              Cada notificação inclui um relatório gerado por IA explicando as principais mudanças
              detectadas nos fundamentos da empresa.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">✅ Gestão Fácil</h4>
            <p className="text-muted-foreground">
              Você pode se inscrever ou cancelar inscrições a qualquer momento, diretamente na página
              de cada ativo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

