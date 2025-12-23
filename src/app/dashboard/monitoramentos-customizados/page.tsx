import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import CustomMonitorsList from '@/components/custom-monitors-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Bell, ArrowLeft, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Monitoramentos Customizados | Preço Justo AI',
  description: 'Gerencie seus monitoramentos customizados de ações com gatilhos personalizados',
};

export default async function CustomMonitorsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Buscar monitoramentos customizados do usuário
  const monitorsRaw = await safeQueryWithParams(
    'user-custom-monitors',
    () =>
      prisma.userAssetMonitor.findMany({
        where: { userId: user.id },
        include: {
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
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

  // Transformar dados para o formato esperado pelo componente
  const monitors = (monitorsRaw as any[]).map((m: any) => {
    // Garantir que company existe antes de acessar propriedades
    if (!m.company) {
      console.error('Monitor sem company:', m.id);
      return null;
    }
    
    return {
      id: m.id,
      companyId: m.companyId,
      ticker: m.company.ticker,
      companyName: m.company.name,
      companyLogoUrl: m.company.logoUrl,
      triggerConfig: (m.triggerConfig || {}) as any,
      isActive: m.isActive ?? true,
      createdAt: m.createdAt,
      lastTriggeredAt: m.lastTriggeredAt,
    };
  }).filter((m): m is NonNullable<typeof m> => m !== null);

  // Debug: log temporário para verificar dados
  if (process.env.NODE_ENV === 'development') {
    console.log('[Monitoramentos] Total encontrado:', monitors.length);
    console.log('[Monitoramentos] Dados:', monitors);
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/subscriptions">
              <Bell className="w-4 h-4 mr-2" />
              Minhas Inscrições
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Settings className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">Monitoramentos Customizados</h1>
            </div>
            <p className="text-muted-foreground">
              Configure gatilhos personalizados para receber alertas quando ações atendem seus critérios específicos.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/dashboard/monitoramentos-customizados/criar">
              <Plus className="w-4 h-4 mr-2" />
              Criar Monitoramento
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total de Monitoramentos</p>
              <p className="text-3xl font-bold">{monitors.length}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {monitors.filter((m) => m.isActive).length} ativo(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de monitoramentos */}
      <CustomMonitorsList monitors={monitors} />

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como Funciona?</CardTitle>
          <CardDescription>
            Entenda o sistema de monitoramentos customizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">🎯 Gatilhos Personalizados</h4>
            <p className="text-muted-foreground">
              Configure critérios específicos como P/L mínimo, P/VP máximo, Score mínimo ou alertas de preço.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">🔔 Alertas Inteligentes</h4>
            <p className="text-muted-foreground">
              Você receberá um relatório gerado por IA quando seus critérios forem atendidos, explicando o que aconteceu.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">📊 Monitoramento Contínuo</h4>
            <p className="text-muted-foreground">
              Nosso sistema verifica seus gatilhos regularmente e dispara alertas automaticamente.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">✅ Gestão Fácil</h4>
            <p className="text-muted-foreground">
              Ative, desative ou edite seus monitoramentos a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

