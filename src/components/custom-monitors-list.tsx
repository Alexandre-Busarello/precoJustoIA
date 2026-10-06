'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { CompanyLogo } from '@/components/company-logo';
import { describeTriggerConfig } from '@/components/custom-monitor-form';
import type { TriggerConfig } from '@/lib/custom-trigger-service';

interface Monitor {
  id: string;
  companyId: number;
  ticker: string;
  companyName: string;
  companyLogoUrl: string | null;
  triggerConfig: TriggerConfig;
  isActive: boolean;
  createdAt: Date;
  lastTriggeredAt: Date | null;
  /** Critério atingido na última verificação (o aviso não se repete enquanto continuar atingido). */
  isAlertActive?: boolean;
}

interface CustomMonitorsListProps {
  monitors: Monitor[];
}

export default function CustomMonitorsList({ monitors }: CustomMonitorsListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [monitorsList, setMonitorsList] = useState<Monitor[]>(monitors);
  const [monitorToDelete, setMonitorToDelete] = useState<Monitor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const skipSyncRef = useRef(false);

  // Sincroniza com as props, exceto logo após uma atualização local (evita sobrescrever com dados antigos)
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setMonitorsList(monitors);
  }, [monitors]);

  const handleToggleActive = async (monitor: Monitor) => {
    const next = !monitor.isActive;
    const previous = monitorsList;
    setBusyId(monitor.id);
    setMonitorsList((list) => list.map((m) => (m.id === monitor.id ? { ...m, isActive: next } : m)));

    try {
      const response = await fetch(`/api/user-asset-monitor/${monitor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Erro ao atualizar monitoramento');

      const updated = data.monitor;
      setMonitorsList((list) =>
        list.map((m) =>
          m.id === monitor.id
            ? { ...m, isActive: updated.isActive, triggerConfig: updated.triggerConfig, lastTriggeredAt: updated.lastTriggeredAt }
            : m
        )
      );
      skipSyncRef.current = true;
      toast({ title: next ? 'Monitoramento ativado' : 'Monitoramento pausado', description: monitor.ticker });
      router.refresh();
    } catch (error) {
      console.error('Erro ao atualizar monitoramento:', error);
      setMonitorsList(previous);
      toast({
        title: 'Não foi possível atualizar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!monitorToDelete) return;
    const target = monitorToDelete;
    setBusyId(target.id);
    try {
      const response = await fetch(`/api/user-asset-monitor/${target.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao remover monitoramento');
      }
      setMonitorsList((list) => list.filter((m) => m.id !== target.id));
      setMonitorToDelete(null);
      toast({ title: 'Monitoramento removido', description: target.ticker });
      router.refresh();
    } catch (error) {
      console.error('Erro ao remover monitoramento:', error);
      toast({
        title: 'Não foi possível remover',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (monitorsList.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Nenhum monitoramento criado</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Receba um aviso quando o preço ficar abaixo do preço-teto Bazin ou do preço justo, quando o dividend yield subir
          ou quando um indicador chegar ao valor que você definiu.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/dashboard/monitoramentos-customizados/criar">Criar monitoramento</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {monitorsList.map((monitor) => {
          const conditions = describeTriggerConfig(monitor.triggerConfig);
          const busy = busyId === monitor.id;
          return (
            <li key={monitor.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <CompanyLogo ticker={monitor.ticker} companyName={monitor.companyName} logoUrl={monitor.companyLogoUrl} size={36} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/acao/${monitor.ticker.toLowerCase()}`}
                      className="-my-2.5 inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline sm:my-0 sm:min-h-0"
                    >
                      {monitor.ticker}
                    </Link>
                    <Badge variant={monitor.isActive ? 'positive' : 'neutral'}>{monitor.isActive ? 'Ativo' : 'Pausado'}</Badge>
                    {monitor.isActive && monitor.isAlertActive && <Badge variant="brand">Critério atingido</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{monitor.companyName}</p>
                  {conditions.length > 0 ? (
                    <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Critérios">
                      {conditions.map((condition) => (
                        <li key={condition} className="max-w-full">
                          <Badge variant="neutral" className="h-auto max-w-full whitespace-normal text-left tabular-nums">
                            {condition}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem critérios definidos</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {monitor.lastTriggeredAt ? (
                      <time
                        dateTime={new Date(monitor.lastTriggeredAt).toISOString()}
                        // Tempo relativo muda entre o render do servidor e a hidratação (virada de minuto)
                        suppressHydrationWarning
                        title={formatDate(monitor.lastTriggeredAt, { style: 'datetime' })}>
                        Último aviso {formatDate(monitor.lastTriggeredAt, { style: 'relative' })}
                      </time>
                    ) : (
                      'Nenhum aviso ainda'
                    )}
                    {` · criado em ${formatDate(monitor.createdAt)}`}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 pl-12 sm:pl-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 pr-2 text-sm text-muted-foreground">
                  <Switch
                    checked={monitor.isActive}
                    onCheckedChange={() => handleToggleActive(monitor)}
                    disabled={busy}
                    aria-label={monitor.isActive ? `Pausar monitoramento de ${monitor.ticker}` : `Ativar monitoramento de ${monitor.ticker}`}
                  />
                  <span className="sm:sr-only">{monitor.isActive ? 'Ativo' : 'Pausado'}</span>
                </label>
                <Button variant="ghost" size="icon" asChild className="size-11 sm:size-9">
                  <Link href={`/dashboard/monitoramentos-customizados/editar/${monitor.id}`} aria-label={`Editar monitoramento de ${monitor.ticker}`}>
                    <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-9"
                  onClick={() => setMonitorToDelete(monitor)}
                  disabled={busy}
                  aria-label={`Remover monitoramento de ${monitor.ticker}`}
                >
                  <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!monitorToDelete} onOpenChange={(open) => !open && setMonitorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover monitoramento de {monitorToDelete?.ticker}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os critérios serão apagados e você deixará de receber avisos deste ativo. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-primary-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
