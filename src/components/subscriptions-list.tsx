'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CompanyLogo } from '@/components/company-logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellOff, ExternalLink, Loader2, Mail, AlertCircle } from 'lucide-react';
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
  emailNotificationsEnabled: boolean;
}

export default function SubscriptionsList({ 
  subscriptions: initialSubscriptions,
  emailNotificationsEnabled: initialEmailNotificationsEnabled 
}: SubscriptionsListProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(initialEmailNotificationsEnabled);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar preferências atualizadas
  const { data: preferencesData } = useQuery({
    queryKey: ['user', 'preferences', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/user/preferences/notifications')
      if (!res.ok) throw new Error('Erro ao buscar preferências')
      return res.json()
    },
    initialData: { emailNotificationsEnabled: initialEmailNotificationsEnabled }
  })

  useEffect(() => {
    if (preferencesData?.emailNotificationsEnabled !== undefined) {
      setEmailNotificationsEnabled(preferencesData.emailNotificationsEnabled)
    }
  }, [preferencesData])

  // Mutation para atualizar preferências
  const updatePreferencesMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/user/preferences/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotificationsEnabled: enabled })
      })
      if (!res.ok) throw new Error('Erro ao atualizar preferências')
      return res.json()
    },
    onSuccess: (_, enabled) => {
      setEmailNotificationsEnabled(enabled)
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences', 'notifications'] })
      toast({
        title: 'Preferências atualizadas',
        description: enabled 
          ? 'Notificações por email habilitadas. Você voltará a receber notificações sobre seus ativos.'
          : 'Notificações por email desabilitadas',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar preferências',
        variant: 'destructive',
      })
    }
  })

  const handleToggleEmailNotifications = () => {
    const newValue = !emailNotificationsEnabled
    updatePreferencesMutation.mutate(newValue)
  }

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

  // Se notificações por email estão desabilitadas, mostrar mensagem
  if (!emailNotificationsEnabled && subscriptions.length > 0) {
    return (
      <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <AlertCircle className="w-12 h-12 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-orange-900 dark:text-orange-100">
                Notificações por email desabilitadas
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Você tem <strong>{subscriptions.length}</strong> ativo{subscriptions.length !== 1 ? 's' : ''} inscrito{subscriptions.length !== 1 ? 's' : ''}, 
                mas não está recebendo notificações por email porque essa configuração está desligada.
              </p>
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 p-4 bg-background rounded-lg border">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Receber notificações por email</span>
                  <Switch
                    checked={emailNotificationsEnabled}
                    onCheckedChange={handleToggleEmailNotifications}
                    disabled={updatePreferencesMutation.isPending}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao habilitar, você voltará a receber notificações sobre mudanças nos ativos que está monitorando.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
                &quot;Receber Atualizações&quot; para começar.
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

