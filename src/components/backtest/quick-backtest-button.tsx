'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BarChart3, ChevronDown, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useToast } from '@/hooks/use-toast';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  QUICK_DEFAULTS,
  QUICK_TOP_DEFAULT,
  QUICK_TOP_OPTIONS,
  busyLabel,
  formatMonthYear,
  quickLandingUrl,
  rebalanceLabel,
  type QuickBacktestSource,
} from '@/lib/backtest/quick-backtest';

// O resultado completo (gráficos) só carrega quando o usuário grátis roda a simulação
const BacktestResults = dynamic(() => import('@/components/backtest-results').then((m) => m.BacktestResults), {
  ssr: false,
  loading: () => (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando resultado">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  ),
});

export interface QuickBacktestRequest {
  tickers: string[];
  source: QuickBacktestSource;
  /** Nome exibido na faixa do resultado: ticker, modelo do ranking ou nome da carteira. */
  sourceLabel?: string;
  weights?: number[];
  /** Carteira: tickers e pesos são lidos no servidor. */
  portfolioId?: string;
}

type UpgradeReason = 'limit' | 'premium';

interface FreeRun {
  sourceLabel: string;
  adjustments: string[];
  configId: string;
  // Formato do resultado de /api/backtest/run (mesmo usado em BacktestResults)
  result: any;
  config: {
    name: string;
    assets: Array<{ ticker: string; allocation: number }>;
    startDate: string;
    endDate: string;
    initialCapital: number;
    monthlyContribution: number;
    rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
  };
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Transações do histórico mensal (mesmo formato da aba Transações da ferramenta). */
function transactionsOf(result: any): any[] {
  const transactions: any[] = [];
  for (const month of result?.monthlyHistory ?? []) {
    for (const transaction of month.transactions ?? []) {
      transactions.push({
        ...transaction,
        totalContribution: month.totalContribution,
        portfolioValue: month.portfolioValue,
        cashBalance: transaction.cashBalance ?? month.cashBalance,
      });
    }
  }
  return transactions;
}

/** "out. 2021 a out. 2026" a partir de datas à meia-noite UTC. */
export function formatQuickPeriod(start: Date, end: Date): string {
  return `${formatMonthYear(start)} a ${formatMonthYear(end)}`;
}

/** Data local do formulário (meia-noite local) → mesma data à meia-noite UTC. */
export function localToUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

interface QuickRunStripProps {
  sourceLabel: string;
  period: string;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: string;
  adjustments?: string[];
  actions?: ReactNode;
}

/** Faixa acima dos KPIs: o que foi simulado (origem, período, valores) e as próximas ações. */
export function QuickRunStrip({
  sourceLabel,
  period,
  initialCapital,
  monthlyContribution,
  rebalanceFrequency,
  adjustments = [],
  actions,
}: QuickRunStripProps) {
  const money =
    monthlyContribution > 0
      ? `${formatBRL(initialCapital, { digits: 0 })} + ${formatBRL(monthlyContribution, { digits: 0 })}/mês`
      : `${formatBRL(initialCapital, { digits: 0 })} sem aportes`;
  return (
    <section aria-label="Simulação rápida" className="space-y-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Simulação rápida de {sourceLabel}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{period}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{money}</span>
          <span aria-hidden="true"> · </span>
          <span>{rebalanceLabel(rebalanceFrequency)}</span>
        </p>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {adjustments.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {adjustments.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
              <span className="min-w-0">{note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Backtest de um clique. Premium: simula e leva ao resultado em /backtest. Grátis: 1 simulação por mês, com o
 * resultado completo numa janela; depois, o estado de upgrade. Visitante: login. `dialogs` precisa ser renderizado.
 */
export function useQuickBacktest() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus();
  const [busy, setBusy] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
  const [freeRun, setFreeRun] = useState<FreeRun | null>(null);

  const isLoggedIn = Boolean(session?.user);
  const loading = status === 'loading' || (isLoggedIn && premiumLoading);
  const premium = isLoggedIn && isPremium;

  const run = async (request: QuickBacktestRequest, mode: 'run' | 'prepare' = 'run') => {
    if (busy || loading) return;
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath())}`);
      return;
    }
    if (mode === 'prepare' && !premium) {
      setUpgrade('premium');
      return;
    }

    setBusy(true);
    let navigating = false;
    try {
      const response = await fetch('/api/backtest/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, mode }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(currentPath())}`);
        return;
      }
      if (data.code === 'FREE_LIMIT_REACHED') {
        setUpgrade('limit');
        return;
      }
      if (data.code === 'PREMIUM_REQUIRED') {
        setUpgrade('premium');
        return;
      }
      if (!response.ok || !data.configId) {
        toast({
          title: 'Não foi possível simular',
          description: data.error || 'Tente de novo em instantes.',
          variant: 'destructive',
        });
        return;
      }

      if (data.tier === 'FREE' && data.result) {
        setFreeRun({
          sourceLabel: data.sourceLabel,
          adjustments: data.adjustments ?? [],
          configId: data.configId,
          result: data.result,
          config: data.config,
        });
        return;
      }

      navigating = true;
      router.push(
        mode === 'prepare'
          ? quickLandingUrl({ configId: data.configId, view: 'configure', source: request.source })
          : quickLandingUrl({
              configId: data.configId,
              view: 'results',
              source: request.source,
              sourceLabel: data.sourceLabel,
              returnTo: currentPath(),
              adjustments: data.adjustments,
            })
      );
    } catch (error) {
      console.error('Erro no backtest rápido:', error);
      toast({ title: 'Não foi possível simular', description: 'Verifique a conexão e tente de novo.', variant: 'destructive' });
    } finally {
      // Navegando: o botão continua ocupado até a página do resultado abrir
      if (!navigating) setBusy(false);
    }
  };

  const dialogs = (
    <>
      <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} />
      <FreeResultDialog run={freeRun} onClose={() => setFreeRun(null)} onAdjust={() => setUpgrade('premium')} />
    </>
  );

  return { run, busy, loading, isLoggedIn, premium, dialogs };
}

function UpgradeDialog({ reason, onClose }: { reason: UpgradeReason | null; onClose: () => void }) {
  return (
    <Dialog open={reason !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {reason === 'limit' ? 'Você já usou o backtest grátis deste mês' : 'Ajustar o backtest faz parte do Premium'}
          </DialogTitle>
          <DialogDescription>
            {reason === 'limit'
              ? 'O plano gratuito inclui 1 simulação rápida por mês, com os padrões de 5 anos, R$ 10.000 + R$ 1.000/mês. No Premium, as simulações são ilimitadas.'
              : 'No Premium você escolhe período, capital, aportes, pesos e rebalanceamento, salva configurações e simula quantas vezes quiser.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Agora não
          </Button>
          <Button asChild>
            <Link href="/planos">Ver planos</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Resultado completo do backtest grátis do mês (a ferramenta em /backtest é Premium). */
function FreeResultDialog({ run, onClose, onAdjust }: { run: FreeRun | null; onClose: () => void; onAdjust: () => void }) {
  const config = run
    ? {
        ...run.config,
        assets: run.config.assets.map((asset) => ({ ...asset, companyName: asset.ticker })),
        startDate: new Date(run.config.startDate),
        endDate: new Date(run.config.endDate),
      }
    : null;
  return (
    <Dialog open={run !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Resultado do backtest</DialogTitle>
          <DialogDescription>
            Este é o seu backtest grátis deste mês. Rentabilidade passada não garante resultados futuros. Simulação, não é
            recomendação.
          </DialogDescription>
        </DialogHeader>
        {run && config && (
          <div className="min-w-0 space-y-4">
            <QuickRunStrip
              sourceLabel={run.sourceLabel}
              period={formatQuickPeriod(config.startDate, config.endDate)}
              initialCapital={config.initialCapital}
              monthlyContribution={config.monthlyContribution}
              rebalanceFrequency={config.rebalanceFrequency}
              adjustments={run.adjustments}
              actions={
                <Button variant="outline" size="sm" onClick={onAdjust} className="max-md:h-11">
                  <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  Ajustar configuração
                </Button>
              }
            />
            <BacktestResults
              result={run.result}
              config={{ ...config, startDate: localFromUtc(config.startDate), endDate: localFromUtc(config.endDate) }}
              transactions={transactionsOf(run.result)}
              configId={run.configId}
              autoScroll={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Meia-noite UTC → meia-noite local do mesmo dia (formato de data do formulário e dos resultados). */
function localFromUtc(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary';

interface QuickBacktestButtonProps {
  request: QuickBacktestRequest;
  label?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'default';
  /** Só o ícone (célula de tabela); o rótulo vira aria-label. */
  iconOnly?: boolean;
  /** Mostra o menu com "Personalizar antes" (e o top N quando `topOf` existe). */
  customizable?: boolean;
  /** Ranking: lista ordenada de onde sai o top N escolhido no menu. */
  topOf?: string[];
  /** Ativo indisponível para backtest (ex.: FII), com o motivo. */
  unavailableReason?: string;
  className?: string;
}

/** Opções de top N cabíveis na quantidade de resultados (2 resultados → só "Top 2"). */
function topOptions(available: number): number[] {
  const options: number[] = QUICK_TOP_OPTIONS.filter((n) => n <= available);
  if (available < QUICK_TOP_OPTIONS[QUICK_TOP_OPTIONS.length - 1] && !options.includes(available)) options.push(available);
  return options;
}

/** Botão de backtest rápido: um clique simula com os padrões e abre o resultado. */
export function QuickBacktestButton({
  request,
  label = 'Backtest',
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  customizable = false,
  topOf,
  unavailableReason,
  className,
}: QuickBacktestButtonProps) {
  const quick = useQuickBacktest();
  const [menuOpen, setMenuOpen] = useState(false);
  const options = topOf ? topOptions(topOf.length) : [];
  const [topN, setTopN] = useState(() => Math.min(QUICK_TOP_DEFAULT, topOf?.length ?? QUICK_TOP_DEFAULT));

  const effectiveRequest: QuickBacktestRequest = topOf ? { ...request, tickers: topOf.slice(0, topN) } : request;
  const busyText = busyLabel(QUICK_DEFAULTS.years);
  const sizeClass = size === 'sm' ? 'max-md:h-11' : undefined;

  if (unavailableReason) {
    return (
      <Button
        variant={variant}
        size={iconOnly ? 'icon-sm' : size}
        disabled
        title={unavailableReason}
        aria-label={iconOnly ? unavailableReason : undefined}
        className={cn(sizeClass, className)}
      >
        <BarChart3 className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        {!iconOnly && 'Backtest indisponível'}
      </Button>
    );
  }

  const start = (mode: 'run' | 'prepare' = 'run') => {
    setMenuOpen(false);
    void quick.run(effectiveRequest, mode);
  };

  const icon = quick.busy ? (
    <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
  ) : (
    <BarChart3 className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
  );
  const accessibleLabel = quick.busy ? busyText : label;

  const mainButton = (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? 'icon-sm' : size}
      onClick={() => start('run')}
      disabled={quick.busy || quick.loading}
      aria-busy={quick.busy || undefined}
      aria-label={iconOnly ? accessibleLabel : undefined}
      title={iconOnly ? label : undefined}
      className={cn(sizeClass, customizable && 'rounded-r-none', !customizable && className)}
    >
      {icon}
      {!iconOnly && (
        // As duas legendas ocupam a mesma célula: o botão não muda de largura ao ficar ocupado
        <span className="grid">
          <span className={cn('col-start-1 row-start-1', quick.busy && 'invisible')}>{label}</span>
          <span className={cn('col-start-1 row-start-1', !quick.busy && 'invisible')}>{busyText}</span>
        </span>
      )}
    </Button>
  );

  return (
    <>
      {customizable ? (
        <div className={cn('inline-flex', className)}>
          {mainButton}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={variant}
                size={size === 'sm' ? 'icon-sm' : 'icon'}
                disabled={quick.busy || quick.loading}
                aria-label="Opções do backtest"
                className={cn('-ml-px rounded-l-none', size === 'sm' && 'max-md:size-11')}
              >
                <ChevronDown className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="space-y-4">
              {options.length > 0 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Empresas do ranking</legend>
                  <div className="flex gap-1 rounded-md bg-muted p-1">
                    {options.map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={topN === n}
                        onClick={() => setTopN(n)}
                        className={cn(
                          'min-h-11 flex-1 rounded-sm px-2 text-sm tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none md:min-h-9',
                          topN === n ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Top {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Pesos iguais entre as {topN} primeiras.</p>
                </fieldset>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Padrão: últimos 5 anos, R$ 10.000 + R$ 1.000/mês e rebalanceamento mensal.
              </p>
              <div className="flex flex-col gap-2">
                {options.length > 0 && <Button onClick={() => start('run')}>Simular top {topN}</Button>}
                <Button variant="outline" onClick={() => start('prepare')}>
                  {!quick.premium && <Lock className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
                  Personalizar antes
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        mainButton
      )}
      {quick.dialogs}
    </>
  );
}
