'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, Loader2, MailWarning } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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

const PREFERENCES_KEY = ['user', 'preferences', 'notifications'];

export default function SubscriptionsList({
  subscriptions: initialSubscriptions,
  emailNotificationsEnabled: initialEmailNotificationsEnabled,
}: SubscriptionsListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null);

  const { data: preferences } = useQuery<{ emailNotificationsEnabled: boolean }>({
    queryKey: PREFERENCES_KEY,
    queryFn: async () => {
      const res = await fetch('/api/user/preferences/notifications');
      if (!res.ok) throw new Error('Erro ao buscar preferências');
      return res.json();
    },
    initialData: { emailNotificationsEnabled: initialEmailNotificationsEnabled },
  });
  const emailNotificationsEnabled = preferences?.emailNotificationsEnabled ?? initialEmailNotificationsEnabled;

  const updatePreferences = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/user/preferences/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotificationsEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar preferências');
      return res.json();
    },
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(PREFERENCES_KEY, { emailNotificationsEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
      toast({
        title: 'Preferências atualizadas',
        description: enabled ? 'Você voltará a receber os alertas por e-mail.' : 'Alertas por e-mail desligados.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Não foi possível atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const handleUnsubscribe = async (subscription: Subscription) => {
    setLoadingId(subscription.id);
    try {
      const response = await fetch(`/api/asset-subscriptions/${subscription.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao cancelar inscrição');
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscription.id));
      toast({ title: 'Inscrição cancelada', description: data.message });
    } catch (error) {
      console.error('Erro ao cancelar inscrição:', error);
      toast({
        title: 'Não foi possível cancelar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoadingId(null);
      setSubscriptionToDelete(null);
    }
  };

  const columns: DataTableColumn<Subscription>[] = [
    {
      key: 'ticker',
      header: 'Ativo',
      sortable: true,
      sortValue: (row) => row.company.ticker,
      cell: (row) => (
        <Link
          href={`/acao/${row.company.ticker.toLowerCase()}`}
          prefetch={false}
          className="block max-w-40 py-1 underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block font-medium text-foreground">{row.company.ticker}</span>
          <span className="block truncate text-xs text-muted-foreground">{row.company.name}</span>
        </Link>
      ),
    },
    {
      key: 'sector',
      header: 'Setor',
      sortable: true,
      sortValue: (row) => row.company.sector,
      cell: (row) => <span className="block max-w-48 truncate text-muted-foreground">{row.company.sector || '—'}</span>,
      className: 'max-sm:hidden',
      headerClassName: 'max-sm:hidden',
    },
    {
      key: 'createdAt',
      header: 'Desde',
      align: 'right',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt).getTime(),
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      width: 56,
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          onClick={(e) => {
            e.stopPropagation();
            setSubscriptionToDelete(row);
          }}
          disabled={loadingId === row.id}
          aria-label={`Cancelar alertas de ${row.company.ticker}`}
        >
          {loadingId === row.id ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <BellOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {!emailNotificationsEnabled && subscriptions.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">Alertas por e-mail desligados</p>
              <p className="text-muted-foreground">
                Você acompanha {subscriptions.length} {subscriptions.length === 1 ? 'ativo' : 'ativos'}, mas não recebe os e-mails.
              </p>
            </div>
          </div>
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 font-medium text-foreground">
            <Switch
              checked={emailNotificationsEnabled}
              onCheckedChange={(checked) => updatePreferences.mutate(checked)}
              disabled={updatePreferences.isPending}
            />
            Receber por e-mail
          </label>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={subscriptions}
        getRowId={(row) => row.id}
        stickyFirstColumn
        caption="Ativos com alertas por e-mail"
        defaultSort={{ key: 'createdAt', direction: 'desc' }}
        onRowClick={(row) => router.push(`/acao/${row.company.ticker.toLowerCase()}`)}
        empty={{
          title: 'Nenhum ativo acompanhado',
          description: 'Na página de um ativo, use "Acompanhar" para receber os alertas por e-mail.',
          action: (
            <Button asChild size="sm" variant="outline">
              <Link href="/ranking">Encontrar ativos</Link>
            </Button>
          ),
        }}
      />

      <AlertDialog open={!!subscriptionToDelete} onOpenChange={(open) => !open && setSubscriptionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar alertas de {subscriptionToDelete?.company.ticker}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixará de receber e-mails sobre este ativo. Dá para se inscrever de novo a qualquer momento na página dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => subscriptionToDelete && handleUnsubscribe(subscriptionToDelete)}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              Cancelar alertas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
