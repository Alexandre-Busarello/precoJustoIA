import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user-service';
import CustomMonitorForm from '@/components/custom-monitor-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Criar Monitoramento Customizado | Preço Justo AI',
  description: 'Configure um monitoramento customizado para receber alertas personalizados',
};

export default async function CreateCustomMonitorPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
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

        <h1 className="text-3xl font-bold mb-2">Criar Monitoramento Customizado</h1>
        <p className="text-muted-foreground">
          Configure critérios personalizados para receber alertas quando uma ação atender suas condições.
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Monitoramento</CardTitle>
          <CardDescription>
            Selecione a empresa e defina os critérios que devem ser atendidos para disparar o alerta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomMonitorForm />
        </CardContent>
      </Card>
    </div>
  );
}

