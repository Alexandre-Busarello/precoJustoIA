'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import {
  Edit,
  Trash2,
  Bell,
  BellOff,
  Calendar,
} from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { TriggerConfig } from '@/lib/custom-trigger-service';

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
}

interface CustomMonitorsListProps {
  monitors: Monitor[];
}

export default function CustomMonitorsList({ monitors }: CustomMonitorsListProps) {
  const router = useRouter();
  const [monitorsList, setMonitorsList] = useState<Monitor[]>(monitors);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const skipSyncRef = useRef(false);
  const { toast } = useToast();

  // Sincronizar estado quando props mudarem, mas evitar sobrescrever durante atualizações
  useEffect(() => {
    if (skipSyncRef.current) {
      // Pular esta sincronização se acabamos de atualizar manualmente
      skipSyncRef.current = false;
      return;
    }
    
    // Sincronizar normalmente quando props mudarem
    setMonitorsList(monitors);
  }, [monitors]);

  const handleToggleActive = async (monitorId: string, currentStatus: boolean) => {
    setIsLoading(monitorId);
    
    // Guardar estado anterior para reverter em caso de erro
    const previousState = monitorsList;
    
    // Atualização otimista para melhor UX
    setMonitorsList((prev) =>
      prev.map((m) =>
        m.id === monitorId ? { ...m, isActive: !currentStatus } : m
      )
    );

    try {
      const response = await fetch(`/api/user-asset-monitor/${monitorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar monitoramento');
      }

      const data = await response.json();
      const updatedMonitor = data.monitor;

      // Atualizar estado local com os dados retornados pela API (fonte da verdade)
      // Isso garante que temos os dados corretos antes de qualquer refresh
      setMonitorsList((prev) =>
        prev.map((m) =>
          m.id === monitorId
            ? {
                ...m,
                isActive: updatedMonitor.isActive,
                triggerConfig: updatedMonitor.triggerConfig,
                lastTriggeredAt: updatedMonitor.lastTriggeredAt,
              }
            : m
        )
      );

      // Marcar para pular próxima sincronização do useEffect
      // Isso evita que dados antigos do cache sobrescrevam nossa atualização
      skipSyncRef.current = true;

      toast({
        title: 'Monitoramento atualizado',
        description: currentStatus
          ? 'Monitoramento desativado com sucesso.'
          : 'Monitoramento ativado com sucesso.',
      });

      // Aguardar um pouco antes de fazer refresh para garantir que o cache foi invalidado
      // O revalidatePath no backend já foi executado, mas pode levar alguns ms para propagar
      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (error) {
      console.error('Erro ao atualizar monitoramento:', error);
      
      // Reverter estado em caso de erro
      setMonitorsList(previousState);
      
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar monitoramento.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!monitorToDelete) return;

    setIsLoading(monitorToDelete);
    try {
      const response = await fetch(`/api/user-asset-monitor/${monitorToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao remover monitoramento');
      }

      setMonitorsList((prev) => prev.filter((m) => m.id !== monitorToDelete));
      setDeleteDialogOpen(false);
      setMonitorToDelete(null);

      toast({
        title: 'Monitoramento removido',
        description: 'Monitoramento removido com sucesso.',
      });

      // Atualizar página para garantir sincronização
      router.refresh();
    } catch (error) {
      console.error('Erro ao remover monitoramento:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao remover monitoramento.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(null);
    }
  };

  const formatTriggerConfig = (config: TriggerConfig): string[] => {
    const conditions: string[] = [];

    // Básicos
    if (config.minPl !== undefined) conditions.push(`P/L ≥ ${config.minPl}`);
    if (config.maxPl !== undefined) conditions.push(`P/L ≤ ${config.maxPl}`);
    if (config.minPvp !== undefined) conditions.push(`P/VP ≥ ${config.minPvp}`);
    if (config.maxPvp !== undefined) conditions.push(`P/VP ≤ ${config.maxPvp}`);
    if (config.minScore !== undefined) conditions.push(`Score ≥ ${config.minScore}`);
    if (config.maxScore !== undefined) conditions.push(`Score ≤ ${config.maxScore}`);
    
    // Preço
    if (config.priceReached !== undefined) conditions.push(`Preço = R$ ${config.priceReached.toFixed(2)}`);
    if (config.priceBelow !== undefined) conditions.push(`Preço < R$ ${config.priceBelow.toFixed(2)}`);
    if (config.priceAbove !== undefined) conditions.push(`Preço > R$ ${config.priceAbove.toFixed(2)}`);

    // Indicadores que oscilam com preço
    if (config.minForwardPE !== undefined) conditions.push(`Forward P/E ≥ ${config.minForwardPE}`);
    if (config.maxForwardPE !== undefined) conditions.push(`Forward P/E ≤ ${config.maxForwardPE}`);
    if (config.minEarningsYield !== undefined) conditions.push(`Earnings Yield ≥ ${(config.minEarningsYield * 100).toFixed(2)}%`);
    if (config.maxEarningsYield !== undefined) conditions.push(`Earnings Yield ≤ ${(config.maxEarningsYield * 100).toFixed(2)}%`);
    if (config.minDy !== undefined) conditions.push(`DY ≥ ${(config.minDy * 100).toFixed(2)}%`);
    if (config.maxDy !== undefined) conditions.push(`DY ≤ ${(config.maxDy * 100).toFixed(2)}%`);
    if (config.minEvEbitda !== undefined) conditions.push(`EV/EBITDA ≥ ${config.minEvEbitda}`);
    if (config.maxEvEbitda !== undefined) conditions.push(`EV/EBITDA ≤ ${config.maxEvEbitda}`);
    if (config.minPsr !== undefined) conditions.push(`P/S ≥ ${config.minPsr}`);
    if (config.maxPsr !== undefined) conditions.push(`P/S ≤ ${config.maxPsr}`);
    if (config.minLpa !== undefined) conditions.push(`LPA ≥ ${config.minLpa.toFixed(2)}`);
    if (config.maxLpa !== undefined) conditions.push(`LPA ≤ ${config.maxLpa.toFixed(2)}`);
    if (config.minVpa !== undefined) conditions.push(`VPA ≥ ${config.minVpa.toFixed(2)}`);
    if (config.maxVpa !== undefined) conditions.push(`VPA ≤ ${config.maxVpa.toFixed(2)}`);

    // Rentabilidade
    if (config.minRoe !== undefined) conditions.push(`ROE ≥ ${(config.minRoe * 100).toFixed(2)}%`);
    if (config.maxRoe !== undefined) conditions.push(`ROE ≤ ${(config.maxRoe * 100).toFixed(2)}%`);
    if (config.minRoic !== undefined) conditions.push(`ROIC ≥ ${(config.minRoic * 100).toFixed(2)}%`);
    if (config.maxRoic !== undefined) conditions.push(`ROIC ≤ ${(config.maxRoic * 100).toFixed(2)}%`);
    if (config.minRoa !== undefined) conditions.push(`ROA ≥ ${(config.minRoa * 100).toFixed(2)}%`);
    if (config.maxRoa !== undefined) conditions.push(`ROA ≤ ${(config.maxRoa * 100).toFixed(2)}%`);

    // Margem
    if (config.minMargemBruta !== undefined) conditions.push(`Margem Bruta ≥ ${(config.minMargemBruta * 100).toFixed(2)}%`);
    if (config.maxMargemBruta !== undefined) conditions.push(`Margem Bruta ≤ ${(config.maxMargemBruta * 100).toFixed(2)}%`);
    if (config.minMargemEbitda !== undefined) conditions.push(`Margem EBITDA ≥ ${(config.minMargemEbitda * 100).toFixed(2)}%`);
    if (config.maxMargemEbitda !== undefined) conditions.push(`Margem EBITDA ≤ ${(config.maxMargemEbitda * 100).toFixed(2)}%`);
    if (config.minMargemLiquida !== undefined) conditions.push(`Margem Líquida ≥ ${(config.minMargemLiquida * 100).toFixed(2)}%`);
    if (config.maxMargemLiquida !== undefined) conditions.push(`Margem Líquida ≤ ${(config.maxMargemLiquida * 100).toFixed(2)}%`);

    // Endividamento
    if (config.minDividaLiquidaPl !== undefined) conditions.push(`Dívida Líq/PL ≥ ${config.minDividaLiquidaPl}`);
    if (config.maxDividaLiquidaPl !== undefined) conditions.push(`Dívida Líq/PL ≤ ${config.maxDividaLiquidaPl}`);
    if (config.minDebtToEquity !== undefined) conditions.push(`Debt/Equity ≥ ${config.minDebtToEquity}`);
    if (config.maxDebtToEquity !== undefined) conditions.push(`Debt/Equity ≤ ${config.maxDebtToEquity}`);

    // Crescimento
    if (config.minCagrLucros5a !== undefined) conditions.push(`CAGR Lucros 5a ≥ ${(config.minCagrLucros5a * 100).toFixed(2)}%`);
    if (config.maxCagrLucros5a !== undefined) conditions.push(`CAGR Lucros 5a ≤ ${(config.maxCagrLucros5a * 100).toFixed(2)}%`);
    if (config.minPayout !== undefined) conditions.push(`Payout ≥ ${(config.minPayout * 100).toFixed(2)}%`);
    if (config.maxPayout !== undefined) conditions.push(`Payout ≤ ${(config.maxPayout * 100).toFixed(2)}%`);

    return conditions;
  };

  if (monitorsList.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum monitoramento customizado</h3>
            <p className="text-muted-foreground mb-6">
              Crie seu primeiro monitoramento customizado para receber alertas personalizados.
            </p>
            <Button asChild>
              <Link href="/dashboard/monitoramentos-customizados/criar">
                <Bell className="w-4 h-4 mr-2" />
                Criar Monitoramento
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {monitorsList.map((monitor) => {
          const conditions = formatTriggerConfig(monitor.triggerConfig);
          const isProcessing = isLoading === monitor.id;

          return (
            <Card key={monitor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Informações da Empresa */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <CompanyLogo
                      ticker={monitor.ticker}
                      companyName={monitor.companyName}
                      logoUrl={monitor.companyLogoUrl}
                      size={48}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/acao/${monitor.ticker.toLowerCase()}`}
                          className="font-semibold text-lg hover:underline"
                        >
                          {monitor.ticker}
                        </Link>
                        <Badge variant={monitor.isActive ? 'default' : 'secondary'}>
                          {monitor.isActive ? (
                            <>
                              <Bell className="w-3 h-3 mr-1" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <BellOff className="w-3 h-3 mr-1" />
                              Inativo
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 truncate">
                        {monitor.companyName}
                      </p>

                      {/* Condições do Gatilho */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {conditions.map((condition, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {condition}
                          </Badge>
                        ))}
                      </div>

                      {/* Datas */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Criado em {format(new Date(monitor.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </div>
                        {monitor.lastTriggeredAt && (
                          <div className="flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            Disparado em {format(new Date(monitor.lastTriggeredAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(monitor.id, monitor.isActive)}
                      disabled={isProcessing}
                    >
                      {monitor.isActive ? (
                        <>
                          <BellOff className="w-4 h-4 mr-2" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/dashboard/monitoramentos-customizados/editar/${monitor.id}`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMonitorToDelete(monitor.id);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Monitoramento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente o monitoramento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMonitorToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

