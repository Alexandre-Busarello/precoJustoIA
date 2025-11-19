'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CompanyLogo } from '@/components/company-logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellOff, ExternalLink, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Subscription {
  id: string;
  createdAt: Date | string;
  company: {
    id: number;
    ticker: string;
    name: string;
    sector: string | null;
    logoUrl: string | null;
  };
}

interface SubscriptionsListProps {
  subscriptions: Subscription[];
}

export default function SubscriptionsList({ subscriptions: initialSubscriptions }: SubscriptionsListProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null);
  const { toast } = useToast();

  const handleUnsubscribe = async (subscription: Subscription) => {
    setLoadingId(subscription.id);

    try {
      const response = await fetch(`/api/asset-subscriptions/${subscription.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        // Remover da lista
        setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscription.id));

        toast({
          title: 'Inscrição cancelada',
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Erro ao cancelar inscrição');
      }
    } catch (error: any) {
      console.error('Erro ao cancelar inscrição:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar inscrição',
        variant: 'destructive',
      });
    } finally {
      setLoadingId(null);
      setSubscriptionToDelete(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  };

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="flex flex-col items-center space-y-4">
            <BellOff className="w-16 h-16 text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma inscrição ativa</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Você ainda não está monitorando nenhum ativo. Acesse a página de uma empresa e clique em
                "Receber Atualizações" para começar.
              </p>
              <Button asChild>
                <Link href="/ranking">
                  <Bell className="w-4 h-4 mr-2" />
                  Explorar Empresas
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscriptions.map((subscription) => (
          <Card key={subscription.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              {/* Company Info */}
              <Link
                href={`/acao/${subscription.company.ticker.toLowerCase()}`}
                prefetch={false}
                className="block group"
              >
                <div className="flex items-start space-x-3 mb-4">
                  <CompanyLogo
                    logoUrl={subscription.company.logoUrl}
                    companyName={subscription.company.name}
                    ticker={subscription.company.ticker}
                    size={48}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                        {subscription.company.ticker}
                      </h3>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {subscription.company.name}
                    </p>
                  </div>
                </div>
              </Link>

              {/* Sector Badge */}
              {subscription.company.sector && (
                <Badge variant="secondary" className="mb-3">
                  {subscription.company.sector}
                </Badge>
              )}

              {/* Subscription Date */}
              <p className="text-xs text-muted-foreground mb-4">
                Inscrito em {formatDate(subscription.createdAt)}
              </p>

              {/* Actions */}
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <Link href={`/acao/${subscription.company.ticker.toLowerCase()}`}>
                    Ver Ativo
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setSubscriptionToDelete(subscription)}
                  disabled={loadingId === subscription.id}
                >
                  {loadingId === subscription.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!subscriptionToDelete}
        onOpenChange={(open) => !open && setSubscriptionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não receberá mais notificações sobre{' '}
              <strong>{subscriptionToDelete?.company.ticker}</strong>. Você pode se inscrever
              novamente a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter Inscrição</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => subscriptionToDelete && handleUnsubscribe(subscriptionToDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancelar Inscrição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

