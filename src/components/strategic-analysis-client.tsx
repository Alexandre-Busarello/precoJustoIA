'use client';

import { forwardRef, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart3, Bell, Check, GitCompare, Loader2, TriangleAlert, type LucideIcon, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { useCompanyAnalysis } from '@/hooks/use-company-data';
import { marginOfSafety } from '@/lib/valuation-metrics';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetHeader, type AssetHeaderAction, type AssetHeaderBadge } from '@/components/asset/asset-header';
import { ValuationTable, payoutPhrase } from '@/components/asset/valuation-table';
import {
  getAvailableModels,
  getValuationModel,
  isFinancialCompany,
  isModelLocked,
  localizeStrategyText,
  pickDefaultModel,
  type StrategiesMap,
  type StrategyResult,
} from '@/components/asset/valuation-models';
import { useQuickBacktest } from '@/components/backtest/quick-backtest-button';
import { busyLabel } from '@/lib/backtest/quick-backtest';
import { BenPageContextRegistrar } from '@/components/ben/page-context-registrar';
import { buildAssetContext } from '@/lib/ben-context/builders';

interface StatementsAnalysis {
  score: number;
  redFlags: string[];
  positiveSignals: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface OverallScore {
  score: number;
  grade: string;
  classification: string;
  statementsAnalysis?: StatementsAnalysis;
}

interface CompanyAnalysisResponse {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  overallScore: OverallScore | null;
  strategies: StrategiesMap;
}

const subscribeNoop = () => () => {};

/** Ícone girando para a ação "Backtest" enquanto a simulação roda. */
const SpinnerIcon = forwardRef<SVGSVGElement, LucideProps>(function SpinnerIcon({ className, ...props }, ref) {
  return <Loader2 ref={ref} className={cn('animate-spin', className)} {...props} />;
}) as LucideIcon;

/**
 * false no servidor e durante a hidratação; true depois da montagem no cliente.
 * Evita renderizar na hidratação dados que só existem no cliente (cache do localStorage).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/**
 * useCompanyAnalysis semeia initialData/placeholderData a partir do localStorage, então o primeiro
 * render do cliente pode ter dados que o HTML do servidor não tem. Até a hidratação terminar,
 * devolvemos o mesmo estado do servidor (carregando, sem dados) e só depois o cache.
 */
export function useHydratedCompanyAnalysis(ticker: string, isPremium?: boolean) {
  const query = useCompanyAnalysis(ticker, isPremium);
  const hydrated = useHydrated();
  if (hydrated) return query;
  return { ...query, data: undefined, dataUpdatedAt: 0, isLoading: true };
}

function useTypedCompanyAnalysis(ticker: string, isPremium: boolean) {
  const query = useHydratedCompanyAnalysis(ticker, isPremium);
  return { ...query, data: query.data as unknown as CompanyAnalysisResponse | undefined };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/** Lucro positivo com payout até 30% (ou sem dividendos): a empresa reinveste o lucro. */
function reinvestmentInfo(latestFinancials: Record<string, unknown>): { payout: number | null } | null {
  const payout = toNumberOrNull(latestFinancials.payout);
  const lpa = toNumberOrNull(latestFinancials.lpa);
  const dy = toNumberOrNull(latestFinancials.dy);
  const hasPositiveProfit = lpa !== null && lpa > 0;
  const lowPayout = payout === null || payout <= 0.3;
  const noDividends = dy === null || dy === 0;
  return hasPositiveProfit && (lowPayout || noDividends) ? { payout } : null;
}

interface Props {
  ticker: string;
  currentPrice: number;
  latestFinancials: Record<string, unknown>;
  userIsPremium?: boolean; // Status Premium do servidor (fonte da verdade)
  sector?: string | null;
  industry?: string | null;
}

/** Seção "Valuation": tabela com preço justo, margem de segurança e critérios de cada modelo. */
export default function StrategicAnalysisClient({
  ticker,
  currentPrice,
  latestFinancials,
  userIsPremium: serverIsPremium,
  sector,
  industry,
}: Props) {
  const { data: session } = useSession();
  const { isPremium: clientIsPremium } = usePremiumStatus();
  // Status Premium do servidor é a fonte da verdade; o do cliente é só fallback
  const isPremium = serverIsPremium ?? clientIsPremium ?? false;
  const { data, isLoading, error, refetch } = useTypedCompanyAnalysis(ticker, isPremium);
  const isFinancial = isFinancialCompany(sector ?? data?.sector, industry);
  const reinvestment = reinvestmentInfo(latestFinancials);
  const price = currentPrice > 0 ? currentPrice : null;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Valuation"
        description="Preço justo estimado por modelo e a margem de segurança em relação ao preço atual."
      />

      {reinvestment && (
        <p className="text-sm text-muted-foreground">
          Empresa em fase de reinvestimento: lucro positivo e {payoutPhrase(reinvestment.payout)}.
          Os modelos de dividendos têm alcance limitado e não penalizam o score.
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar os modelos de valuation</p>
          <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <ValuationTable
          price={price}
          strategies={data?.strategies}
          access={{ isPremium, isLoggedIn: !!session?.user }}
          isFinancial={isFinancial}
          reinvestment={reinvestment}
          loading={isLoading && !data}
        />
      )}
    </div>
  );
}

interface StockSummaryHeaderProps {
  ticker: string;
  name: string;
  subtitle?: string;
  logoUrl?: string | null;
  price: number | null;
  /** Variação do último pregão como fração. */
  dayChange?: number | null;
  updatedAt?: Date | string | null;
  badges?: AssetHeaderBadge[];
  sector?: string | null;
  industry?: string | null;
  /** Premium ou anônimo com acesso completo liberado (mesmo valor passado à tabela de valuation). */
  canViewFullContent: boolean;
  isLoggedIn: boolean;
  compareHref: string;
  /** id do card "Acompanhar" na página, alvo do botão para visitantes anônimos. */
  followAnchorId?: string;
}

/**
 * Cabeçalho da página de ação: AssetHeader com Preço · Preço justo (modelo selecionável) · Margem · Score.
 * Usa a mesma consulta da tabela de valuation (cache compartilhado do React Query).
 */
export function StockSummaryHeader({
  ticker,
  name,
  subtitle,
  logoUrl,
  price,
  dayChange,
  updatedAt,
  badges,
  sector,
  industry,
  canViewFullContent,
  isLoggedIn,
  compareHref,
  followAnchorId = 'acompanhar',
}: StockSummaryHeaderProps) {
  const { data } = useTypedCompanyAnalysis(ticker, canViewFullContent);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const quickBacktest = useQuickBacktest();

  const access = { isPremium: canViewFullContent, isLoggedIn };
  const isFinancial = isFinancialCompany(sector, industry);
  const strategies = data?.strategies;
  const options = getAvailableModels(strategies, isFinancial).filter((model) => {
    const fair = strategies?.[model.key]?.fairValue;
    return !isModelLocked(model, access) && typeof fair === 'number' && fair > 0;
  });
  const defaultKey = pickDefaultModel(strategies, { ...access, isFinancial });
  const activeKey = selectedKey && options.some((m) => m.key === selectedKey) ? selectedKey : defaultKey;
  const activeModel = activeKey ? getValuationModel(activeKey) : undefined;
  const activeStrategy = activeKey ? (strategies?.[activeKey] as (StrategyResult & { discount?: number | null }) | null | undefined) : null;
  const fairValue = activeStrategy?.fairValue ?? null;
  // Margem de segurança = desconto do modelo (1 − preço ÷ preço justo); sem ele, calcula com o preço exibido.
  const strategyDiscount = activeStrategy?.discount;
  const headerMargin =
    typeof strategyDiscount === 'number' && Number.isFinite(strategyDiscount) ? strategyDiscount : marginOfSafety(price, fairValue);

  const fairLocked = !canViewFullContent && !isLoggedIn;
  const scoreLocked = !canViewFullContent;
  const overallScore = data?.overallScore ?? null;

  const scrollToFollow = () => {
    const target = document.getElementById(followAnchorId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.querySelector<HTMLInputElement>('input[type="email"]')?.focus({ preventScroll: true });
  };

  // Um clique: simula 5 anos com os padrões e abre o resultado (grátis: 1 por mês; visitante: login)
  const openBacktest = () => {
    void quickBacktest.run({ tickers: [ticker], source: 'asset', sourceLabel: ticker });
  };

  const actions: AssetHeaderAction[] = [
    isLoggedIn
      ? { label: 'Acompanhar', icon: Bell, href: `/dashboard/monitoramentos-customizados/criar?ticker=${ticker}` }
      : { label: 'Acompanhar', icon: Bell, onClick: scrollToFollow },
    { label: 'Comparar', icon: GitCompare, href: compareHref },
    // Ocupado: mesmo rótulo (sem salto de largura), o ícone vira spinner e o botão fica desabilitado;
    // o texto vai para a região viva
    {
      label: 'Backtest',
      icon: quickBacktest.busy ? SpinnerIcon : BarChart3,
      onClick: openBacktest,
      busy: quickBacktest.busy,
    },
  ];

  const fairValueSlot = fairLocked ? (
    // O Stat bloqueado não mostra legenda; Graham é liberado com conta grátis (não só no Premium)
    <p className="text-xs text-muted-foreground">Graham com conta grátis</p>
  ) : options.length > 1 && activeKey ? (
      <Select value={activeKey} onValueChange={setSelectedKey}>
        <SelectTrigger aria-label="Modelo do preço justo" className="w-full min-w-0 max-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((model) => (
            <SelectItem key={model.key} value={model.key}>
              {model.shortLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : undefined;

  const fairValueLabel = fairValueSlot
    ? undefined
    : activeModel
      ? activeModel.shortLabel
      : data && !fairLocked
        ? 'Sem estimativa'
        : undefined;

  return (
    <>
      {/* Contexto do Ben: só o que o usuário vê (preço justo e score bloqueados ficam de fora) */}
      <BenPageContextRegistrar
        context={buildAssetContext({
          companyName: name,
          price,
          valuations:
            !fairLocked && activeModel
              ? [{ model: activeModel.shortLabel, fairValue, margin: headerMargin, score: activeStrategy?.score }]
              : [],
          ...(scoreLocked ? {} : { score: overallScore?.score ?? null }),
        })}
      />
      <AssetHeader
        ticker={ticker}
        name={name}
        subtitle={subtitle}
        logoUrl={logoUrl}
        price={price}
        dayChange={dayChange}
        fairValue={fairValue}
        fairValueLabel={fairValueLabel}
        fairValueSlot={fairValueSlot}
        marginOfSafety={headerMargin}
        score={overallScore ? { value: overallScore.score, label: overallScore.classification } : null}
        updatedAt={updatedAt}
        actions={actions}
        badges={badges}
        locked={{
          fairValue: fairLocked,
          score: scoreLocked,
          cta: isLoggedIn
            ? { label: 'Desbloquear o score', href: '/planos' }
            : { label: 'Desbloquear com 1 dia grátis', href: '/register' },
        }}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {quickBacktest.busy ? busyLabel() : ''}
      </span>
      {quickBacktest.dialogs}
    </>
  );
}

const RISK_LABEL: Record<StatementsAnalysis['riskLevel'], string> = {
  LOW: 'Risco baixo',
  MEDIUM: 'Risco moderado',
  HIGH: 'Risco alto',
  CRITICAL: 'Risco crítico',
};

/** Leitura automática das demonstrações (DRE, balanço e fluxo de caixa). Só Premium; nada para os demais. */
export function StatementsAnalysisSection({ ticker, userIsPremium }: { ticker: string; userIsPremium: boolean }) {
  const { data } = useTypedCompanyAnalysis(ticker, userIsPremium);
  const analysis = userIsPremium ? data?.overallScore?.statementsAnalysis : undefined;
  if (!analysis) return null;
  const riskTone = analysis.riskLevel === 'LOW' ? 'text-positive' : analysis.riskLevel === 'MEDIUM' ? 'text-warning' : 'text-negative';

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Leitura das demonstrações</h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">{Math.round(analysis.score)}/100</span>
          {' · '}
          <span className={riskTone}>{RISK_LABEL[analysis.riskLevel]}</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Análise automática de todos os anos disponíveis de DRE, balanço e fluxo de caixa.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pontos fortes</p>
          {analysis.positiveSignals.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {analysis.positiveSignals.map((signal) => (
                <li key={signal} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={1.75} aria-hidden="true" />
                  {localizeStrategyText(signal)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum ponto forte identificado.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Alertas</p>
          {analysis.redFlags.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {analysis.redFlags.map((flag) => (
                <li key={flag} className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
                  {localizeStrategyText(flag)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum alerta identificado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
