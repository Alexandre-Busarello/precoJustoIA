'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Receipt, Settings, LineChart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/page-header';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { formatBRL, formatDeltaPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PortfolioTutorialLink } from '@/components/portfolio-tutorial-banner';
import { PortfolioEmptyState } from '@/components/portfolio-empty-state';
import { ConvertBacktestModal } from '@/components/convert-backtest-modal';
import { DeletePortfolioDialog } from '@/components/delete-portfolio-dialog';
import { REBALANCE_FREQUENCY_LABELS, returnToneClass } from '@/components/portfolio-page-shell';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  monthlyContribution: number;
  rebalanceFrequency: string;
  trackingStarted: boolean;
  createdAt: Date;
  assetCount: number;
  metrics?: {
    currentValue: number;
    totalInvested: number;
    totalWithdrawn: number;
    netInvested: number;
    totalReturn: number;
    cashBalance: number;
  } | null;
}

const fetchPortfolios = async (): Promise<Portfolio[]> => {
  try {
    const response = await fetch('/api/portfolio');
    if (!response.ok) {
      throw new Error('Erro ao carregar carteiras');
    }
    const data = await response.json();
    return Array.isArray(data?.portfolios) ? data.portfolios : [];
  } catch (error) {
    console.error('Erro ao buscar carteiras:', error);
    return [];
  }
};

type DeleteTarget = { id: string; name: string } | null;

interface PortfolioActionsMenuProps {
  portfolio: Portfolio;
  onDelete: (target: DeleteTarget) => void;
}

/** Menu "Mais ações" da carteira (transações, análise, configurações, excluir). */
function PortfolioActionsMenu({ portfolio, onDelete }: PortfolioActionsMenuProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Mais ações para ${portfolio.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onClick={() => router.push(`/carteira/${portfolio.id}/transacoes`)}>
          <Receipt className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          Transações
        </DropdownMenuItem>
        {portfolio.trackingStarted && (
          <DropdownMenuItem onClick={() => router.push(`/carteira/${portfolio.id}/analise`)}>
            <LineChart className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Análise
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push(`/carteira/${portfolio.id}/config`)}>
          <Settings className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete({ id: portfolio.id, name: portfolio.name })}
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">Carregando carteiras</span>
      {Array.from({ length: 2 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full md:h-10" />
      ))}
    </div>
  );
}

export function PortfolioListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium } = usePremiumStatus();
  const queryClient = useQueryClient();

  const {
    data: portfoliosData,
    isLoading: loading,
    error: portfoliosError,
    refetch,
  } = useQuery({
    queryKey: ['portfolios'],
    queryFn: fetchPortfolios,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const portfolios = Array.isArray(portfoliosData) ? portfoliosData : [];
  const [showConvertBacktestModal, setShowConvertBacktestModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const hasRefetchedRef = useRef(false);

  useEffect(() => {
    // toast do sonner direto: o de useToast muda a cada render e repetiria o aviso.
    if (portfoliosError) sonnerToast.error('Erro', { description: 'Não foi possível carregar suas carteiras' });
  }, [portfoliosError]);

  // A primeira leitura logo após criar uma carteira pode vir vazia: refaz uma vez.
  useEffect(() => {
    if (!loading && portfolios.length === 0 && !portfoliosError && !hasRefetchedRef.current) {
      hasRefetchedRef.current = true;
      refetch();
    }
  }, [loading, portfolios.length, portfoliosError, refetch]);

  const handleCreatePortfolio = () => {
    if (!isPremium && portfolios.length >= 1) {
      toast({
        title: 'Limite do plano gratuito',
        description: 'O plano gratuito permite 1 carteira. Veja os planos para criar outras.',
      });
      router.push('/planos');
      return;
    }
    router.push('/carteira/nova');
  };

  const openPortfolio = (portfolio: Portfolio) => router.push(`/carteira/${portfolio.id}`);

  const columns: DataTableColumn<Portfolio>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortable: true,
      className: 'max-w-72',
      cell: (p) => (
        <div className="min-w-0 py-1">
          <p className="truncate font-medium text-foreground">{p.name}</p>
          {p.description && <p className="truncate text-xs text-muted-foreground">{p.description}</p>}
        </div>
      ),
    },
    {
      key: 'currentValue',
      header: 'Patrimônio',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.metrics?.currentValue ?? null,
      cell: (p) => <span className="font-medium">{formatBRL(p.metrics?.currentValue)}</span>,
    },
    {
      key: 'totalReturn',
      header: 'Retorno',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.metrics?.totalReturn ?? null,
      cell: (p) => (
        <span className={cn('font-medium', returnToneClass(p.metrics?.totalReturn))}>
          {formatDeltaPct(p.metrics?.totalReturn)}
        </span>
      ),
    },
    {
      key: 'cashBalance',
      header: 'Caixa',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.metrics?.cashBalance ?? null,
      cell: (p) => formatBRL(p.metrics?.cashBalance),
    },
    { key: 'assetCount', header: 'Nº ativos', align: 'right', sortable: true },
    {
      key: 'rebalanceFrequency',
      header: 'Rebalanceamento',
      cell: (p) => REBALANCE_FREQUENCY_LABELS[p.rebalanceFrequency] ?? p.rebalanceFrequency,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              openPortfolio(p);
            }}
          >
            Abrir
          </Button>
          <PortfolioActionsMenu portfolio={p} onDelete={setDeleteTarget} />
        </div>
      ),
    },
  ];

  const convertDialog = (
    <Dialog open={showConvertBacktestModal} onOpenChange={setShowConvertBacktestModal}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Criar carteira a partir de um backtest</DialogTitle>
          <DialogDescription>
            Converta um backtest salvo em uma carteira para acompanhamento real.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <ConvertBacktestModal
            onSuccess={(portfolioId) => {
              setShowConvertBacktestModal(false);
              queryClient.invalidateQueries({ queryKey: ['portfolios'] });
              router.push(`/carteira/${portfolioId}`);
            }}
            onCancel={() => setShowConvertBacktestModal(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );

  const hasPortfolios = !loading && portfolios.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader
        title="Minhas carteiras"
        description="Patrimônio, retorno e alocação de cada carteira."
        actions={
          hasPortfolios ? (
            <>
              <PortfolioTutorialLink />
              <Button onClick={handleCreatePortfolio}>
                <Plus strokeWidth={1.75} aria-hidden="true" />
                Nova carteira
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mt-6">
        {loading ? (
          <ListSkeleton />
        ) : !hasPortfolios ? (
          <PortfolioEmptyState
            onCreateClick={handleCreatePortfolio}
            onConvertBacktestClick={() => setShowConvertBacktestModal(true)}
            isPremium={!!isPremium}
          />
        ) : (
          <>
            {/* Mobile: um card por carteira */}
            <ul className="space-y-3 md:hidden">
              {portfolios.map((portfolio) => (
                <li key={portfolio.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-foreground">{portfolio.name}</h2>
                      {portfolio.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{portfolio.description}</p>
                      )}
                    </div>
                    <PortfolioActionsMenu portfolio={portfolio} onDelete={setDeleteTarget} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Patrimônio</dt>
                      <dd className="truncate font-medium tabular-nums text-foreground">
                        {formatBRL(portfolio.metrics?.currentValue)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Retorno</dt>
                      <dd className={cn('font-medium tabular-nums', returnToneClass(portfolio.metrics?.totalReturn))}>
                        {formatDeltaPct(portfolio.metrics?.totalReturn)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Caixa</dt>
                      <dd className="truncate tabular-nums text-foreground">{formatBRL(portfolio.metrics?.cashBalance)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Ativos · rebalanceamento</dt>
                      <dd className="truncate text-foreground">
                        {portfolio.assetCount} ·{' '}
                        {REBALANCE_FREQUENCY_LABELS[portfolio.rebalanceFrequency] ?? portfolio.rebalanceFrequency}
                      </dd>
                    </div>
                  </dl>
                  <Button asChild className="mt-4 w-full">
                    <Link href={`/carteira/${portfolio.id}`}>Abrir</Link>
                  </Button>
                </li>
              ))}
            </ul>

            {/* Desktop: tabela em largura total */}
            <DataTable
              className="hidden md:block"
              caption="Minhas carteiras"
              columns={columns}
              rows={portfolios}
              getRowId={(p) => p.id}
              onRowClick={openPortfolio}
            />

            {!isPremium && portfolios.length >= 1 && (
              <p className="mt-6 text-sm text-muted-foreground">
                No plano gratuito você pode ter 1 carteira.{' '}
                <Link href="/planos" className="text-brand underline-offset-4 hover:underline">
                  Ver planos
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      {convertDialog}

      <DeletePortfolioDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            queryClient.invalidateQueries({ queryKey: ['portfolios'] });
          }
        }}
        portfolioId={deleteTarget?.id ?? ''}
        portfolioName={deleteTarget?.name ?? ''}
      />
    </div>
  );
}
