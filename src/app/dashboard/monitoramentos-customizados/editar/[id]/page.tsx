import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user-service';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams } from '@/lib/prisma-wrapper';
import CustomMonitorForm from '@/components/custom-monitor-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Editar Monitoramento Customizado | Preço Justo AI',
  description: 'Edite seu monitoramento customizado',
};

export default async function EditCustomMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const resolvedParams = await params;
  const monitorId = resolvedParams.id;

  // Buscar monitoramento
  const monitor = await safeQueryWithParams(
    'user-custom-monitor-by-id',
    () =>
      prisma.userAssetMonitor.findUnique({
        where: { id: monitorId },
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
      }),
    { monitorId }
  );

  if (!monitor) {
    notFound();
  }

  // Verificar se pertence ao usuário
  if (monitor.userId !== user.id) {
    redirect('/dashboard/monitoramentos-customizados');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard/monitoramentos-customizados">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Monitoramentos
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Editar Monitoramento Customizado</h1>
        <p className="text-muted-foreground">
          Atualize os critérios do seu monitoramento para {monitor.company.ticker}.
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Monitoramento</CardTitle>
          <CardDescription>
            Atualize os critérios que devem ser atendidos para disparar o alerta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomMonitorForm
            initialData={{
              id: monitor.id,
              companyId: monitor.companyId,
              ticker: monitor.company.ticker,
              companyName: monitor.company.name,
              triggerConfig: monitor.triggerConfig as any,
              isActive: monitor.isActive,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

