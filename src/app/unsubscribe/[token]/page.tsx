import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function UnsubscribePage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  if (!token || token.length < 10) {
    notFound();
  }

  try {
    // Buscar subscription pelo token
    const subscription = await safeQueryWithParams(
      'subscription-by-unsubscribe-token',
      () => prisma.userAssetSubscription.findFirst({
        where: { unsubscribeToken: token },
        include: {
          company: {
            select: {
              ticker: true,
              name: true,
            },
          },
        },
      }),
      { token }
    );

    if (!subscription) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Token Inválido
                </h1>
                <p className="text-muted-foreground mb-6">
                  O link de descadastro não é válido ou já foi utilizado.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Voltar para a página inicial
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Remover subscription
    await safeWrite(
      'delete-subscription-by-token',
      () => prisma.userAssetSubscription.deleteMany({
        where: { unsubscribeToken: token },
      }),
      ['user_asset_subscriptions']
    );

    const ticker = subscription.company.ticker;
    const companyName = subscription.company.name || ticker;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Descadastro Confirmado
              </h1>
              <p className="text-muted-foreground mb-4">
                Você foi removido da lista de notificações sobre{' '}
                <strong className="text-foreground">{ticker}</strong> ({companyName}).
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Você não receberá mais emails sobre mudanças nos fundamentos desta ação.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/acao/${ticker.toLowerCase()}`}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Ver análise de {ticker}
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Página inicial
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error('Erro ao processar descadastro:', error);
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Erro ao Processar
              </h1>
              <p className="text-muted-foreground mb-6">
                Ocorreu um erro ao processar seu descadastro. Por favor, tente novamente mais tarde.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Voltar para a página inicial
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

