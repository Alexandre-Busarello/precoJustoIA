'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BacktestConfigForm } from '@/components/backtest-config-form';
import { BacktestResults } from '@/components/backtest-results';
import { BacktestHistory } from '@/components/backtest-history';
import { BacktestDataQualityPanel } from '@/components/backtest-data-quality-panel';
import { BacktestConfigHistory } from '@/components/backtest-config-history';
import { BacktestLoadingOverlay } from '@/components/backtest-loading-overlay';
import { useToast } from '@/hooks/use-toast';
import { useTracking } from '@/hooks/use-tracking';
import { EventType } from '@/lib/tracking-types';
import { formatDeltaPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FilePlus2 } from 'lucide-react';
import {
  buildExampleConfig,
  dateFromApi,
  needsValidationReview,
  type BacktestAssetInput,
  type BacktestConfigInput,
} from '@/app/backtest/backtest-utils';

type BacktestAsset = BacktestAssetInput;
type BacktestConfig = BacktestConfigInput;

interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  finalCashReserve?: number;
  totalDividendsReceived?: number;
  monthlyReturns: Array<{
    date: string;
    return: number;
    portfolioValue: number;
    contribution: number;
  }>;
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
    reinvestment: number;
    rebalanceAmount?: number;
    averagePrice?: number;
    totalShares?: number;
    totalDividends?: number;
  }>;
  portfolioEvolution: Array<{
    date: string;
    value: number;
    holdings: Record<string, number>;
    monthlyReturn: number;
  }>;
}

interface DataValidation {
  isValid: boolean;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  assetsAvailability: Array<{
    ticker: string;
    availableFrom: Date;
    availableTo: Date;
    totalMonths: number;
    missingMonths: number;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    warnings: string[];
  }>;
  globalWarnings: string[];
  recommendations: string[];
}

type TabValue = 'configure' | 'results' | 'history' | 'lista';
const TABS: TabValue[] = ['configure', 'results', 'history', 'lista'];

function toTab(view: string | null): TabValue {
  return TABS.includes(view as TabValue) ? (view as TabValue) : 'configure';
}

// Resultado salvo no banco → formato usado pela tela de resultados
function formatSavedResult(saved: any, config: { startDate: string | Date; endDate: string | Date }) {
  return {
    totalReturn: saved.totalReturn,
    annualizedReturn: saved.annualizedReturn,
    volatility: saved.volatility,
    sharpeRatio: saved.sharpeRatio,
    maxDrawdown: saved.maxDrawdown,
    positiveMonths: saved.positiveMonths,
    negativeMonths: saved.negativeMonths,
    totalInvested: saved.totalInvested,
    finalValue: saved.finalValue,
    finalCashReserve: saved.finalCashReserve || 0,
    totalDividendsReceived: saved.totalDividendsReceived || 0,
    monthlyReturns: saved.monthlyReturns || [],
    assetPerformance: saved.assetPerformance || [],
    portfolioEvolution: saved.portfolioEvolution || [],
    dataValidation: null,
    dataQualityIssues: [],
    effectiveStartDate: dateFromApi(config.startDate),
    effectiveEndDate: dateFromApi(config.endDate),
    actualInvestment: saved.totalInvested,
    plannedInvestment: saved.totalInvested,
    missedContributions: 0,
    missedAmount: 0
  };
}

// Preview de configuração (lista/API) → configuração do formulário
function configFromPreview(preview: any, name = preview.name): BacktestConfig {
  return {
    name,
    description: preview.description,
    assets: preview.assets.map((asset: any) => ({
      ticker: asset.ticker,
      companyName: asset.ticker,
      allocation: asset.targetAllocation,
      averageDividendYield: asset.averageDividendYield
    })),
    startDate: dateFromApi(preview.startDate),
    endDate: dateFromApi(preview.endDate),
    initialCapital: preview.initialCapital ?? 10000,
    monthlyContribution: preview.monthlyContribution,
    rebalanceFrequency: preview.rebalanceFrequency
  };
}

const SIDE_NOTES = [
  'Rebalanceamento automático na frequência escolhida.',
  'Aportes mensais regulares ou apenas o capital inicial.',
  'Proventos simulados pelo DY médio informado, pagos em março, agosto e outubro e reinvestidos. Com o campo vazio, a simulação considera só a variação de preço.',
  'Métricas: retorno total e anualizado, volatilidade, Sharpe, drawdown máximo e consistência mensal, com comparação com CDI e Ibovespa.',
];

interface BacktestPageClientProps {
  /** Mês de referência da carteira de exemplo (calculado no servidor, fuso de Brasília), para o HTML do servidor e do navegador coincidirem. */
  exampleMonth?: { year: number; month: number };
}

// Dados enviados para salvar/criar a configuração (mesmo formato no POST e no PUT)
function toSaveParams(config: BacktestConfig) {
  return {
    name: config.name,
    description: config.description,
    assets: config.assets,
    startDate: config.startDate.toISOString(),
    endDate: config.endDate.toISOString(),
    initialCapital: config.initialCapital,
    monthlyContribution: config.monthlyContribution,
    rebalanceFrequency: config.rebalanceFrequency
  };
}

function savedIdOf(config: BacktestConfig | null): string | undefined {
  const id = (config as any)?.id as string | undefined;
  return id && !id.startsWith('temp-') ? id : undefined;
}

export function BacktestPageClient({ exampleMonth }: BacktestPageClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { trackEvent } = useTracking();

  const urlConfigId = searchParams.get('configId');

  const exampleYear = exampleMonth?.year;
  const exampleMonthIndex = exampleMonth?.month;
  const makeExample = useCallback(
    () =>
      buildExampleConfig(
        exampleYear !== undefined && exampleMonthIndex !== undefined ? new Date(exampleYear, exampleMonthIndex, 1) : new Date()
      ),
    [exampleYear, exampleMonthIndex]
  );

  const [activeTab, setActiveTab] = useState<TabValue>(toTab(searchParams.get('view')));
  // Sem configuração na URL, a ferramenta abre com a carteira de exemplo (roda sem nenhum ajuste)
  const [currentConfig, setCurrentConfig] = useState<BacktestConfig | null>(() => (urlConfigId ? null : makeExample()));
  const [currentResult, setCurrentResult] = useState<BacktestResult | null>(null);
  const [currentTransactions, setCurrentTransactions] = useState<any[]>([]);
  const [dataValidation, setDataValidation] = useState<DataValidation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  // Muda a cada "Nova simulação": remonta o formulário sem erros nem textos da configuração anterior
  const [formKey, setFormKey] = useState(0);

  const updateUrl = useCallback((view?: TabValue, configId?: string) => {
    const params = new URLSearchParams();
    if (view && view !== 'configure') params.set('view', view);
    if (configId && !configId.startsWith('temp-')) params.set('configId', configId);
    const query = params.toString();
    router.push(`/backtest${query ? `?${query}` : ''}`, { scroll: false });
  }, [router]);

  const selectTab = useCallback((tab: TabValue) => {
    setActiveTab(tab);
    updateUrl(tab, (currentConfig as any)?.id);
  }, [currentConfig, updateUrl]);

  // Busca a configuração (e o último resultado) quando a URL traz um configId
  const loadConfigFromUrl = async (configId: string, loadResults: boolean) => {
    try {
      setIsLoadingConfig(!loadResults);
      if (loadResults) setIsLoadingResults(true);

      const response = await fetch(`/api/backtest/configs/${configId}`);
      if (!response.ok) return;

      const data = await response.json();
      const loadedConfig = configFromPreview(data.config);
      (loadedConfig as any).id = configId;
      setCurrentConfig(loadedConfig);

      if (loadResults) {
        const latest = data.config?.results?.[0];
        setCurrentResult(latest ? formatSavedResult(latest, data.config) : null);
        setCurrentTransactions(latest ? data.config.transactions || [] : []);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração da URL:', error);
    } finally {
      setIsLoadingConfig(false);
      setIsLoadingResults(false);
    }
  };

  // Volta a uma simulação nova (carteira de exemplo, sem vínculo com configuração salva)
  const resetToExample = useCallback(() => {
    setCurrentConfig(makeExample());
    setCurrentResult(null);
    setCurrentTransactions([]);
    setDataValidation(null);
    setIsLoadingResults(false);
    setFormKey(key => key + 1);
  }, [makeExample]);

  const startNewSimulation = () => {
    resetToExample();
    setActiveTab('configure');
    router.push('/backtest', { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Voltar/avançar do navegador não deve descartar a configuração em edição
  const isHistoryNavigationRef = useRef(false);
  useEffect(() => {
    const markHistoryNavigation = () => {
      isHistoryNavigationRef.current = true;
    };
    window.addEventListener('popstate', markHistoryNavigation);
    return () => window.removeEventListener('popstate', markHistoryNavigation);
  }, []);

  // Sincroniza a aba e a configuração com a URL (voltar/avançar e links diretos)
  useEffect(() => {
    const view = searchParams.get('view');
    const configId = searchParams.get('configId');
    const isHistoryNavigation = isHistoryNavigationRef.current;
    isHistoryNavigationRef.current = false;
    setActiveTab(toTab(view));

    if (!configId) {
      // Link para /backtest sem configId (menu, rodapé): abre uma simulação nova em vez de editar a salva
      if (!isHistoryNavigation && savedIdOf(currentConfig)) resetToExample();
      return;
    }
    const shouldLoadResults = view === 'results';
    const sameConfig = configId === (currentConfig as any)?.id;
    if (sameConfig && (!shouldLoadResults || currentResult)) return;
    loadConfigFromUrl(configId, shouldLoadResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Ativos enviados por outras telas ("Adicionar ao backtest") substituem a carteira de exemplo
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('backtest-preconfigured-assets');
    } catch {
      return;
    }
    if (!stored) return;

    try {
      const assets = JSON.parse(stored) as Array<{ ticker: string; companyName?: string }>;
      if (assets.length > 0) {
        const processedAssets: BacktestAsset[] = assets.map(asset => ({
          ticker: asset.ticker,
          companyName: asset.companyName,
          allocation: 1 / assets.length
        }));
        const example = makeExample();
        setCurrentConfig({
          ...example,
          name: 'Carteira personalizada',
          description: 'Carteira criada a partir de ativos selecionados',
          assets: processedAssets,
          monthlyContribution: 1000
        });
        setActiveTab('configure');
      }
    } catch (error) {
      console.error('Erro ao carregar ativos pré-configurados:', error);
    } finally {
      try {
        localStorage.removeItem('backtest-preconfigured-assets');
      } catch {
        // armazenamento indisponível: nada a limpar
      }
    }
  }, [makeExample]);

  const handleConfigChange = useCallback((config: BacktestConfig) => {
    setCurrentConfig(prev => {
      const updatedConfig = { ...config };
      const prevId = (prev as any)?.id;
      const nextId = (config as any).id;
      if (!nextId && prevId) (updatedConfig as any).id = prevId;

      const strip = (value: BacktestConfig | null) => {
        if (!value) return null;
        const copy = { ...value };
        delete (copy as any).id;
        return JSON.stringify(copy);
      };

      if (!prev || strip(prev) !== strip(config)) {
        // Mudou a configuração: o resultado anterior deixa de valer
        setCurrentResult(null);
      }
      return updatedConfig;
    });
    setDataValidation(null);
  }, []);

  const executeBacktest = async (config: BacktestConfig) => {
    setIsRunning(true);
    try {
      const params = {
        assets: config.assets,
        startDate: config.startDate.toISOString(),
        endDate: config.endDate.toISOString(),
        initialCapital: config.initialCapital,
        monthlyContribution: config.monthlyContribution,
        rebalanceFrequency: config.rebalanceFrequency
      };
      let savedId = savedIdOf(config);

      // Carteira ainda não salva: grava antes com o nome do formulário. Sem isso a execução cria uma
      // configuração "Backtest <data>" e o nome exibido nos resultados não bate com Minhas configurações.
      if (!savedId) {
        try {
          const saveResponse = await fetch('/api/backtest/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toSaveParams(config))
          });
          if (saveResponse.ok) savedId = (await saveResponse.json()).configId || undefined;
        } catch (error) {
          console.error('Erro ao salvar a configuração antes da execução:', error);
        }
      }

      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedId ? { configId: savedId, params } : { params })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar o backtest');
      }

      const data = await response.json();
      const configId: string | undefined = data.configId || savedId;
      setCurrentResult(data.result);

      trackEvent(EventType.BACKTEST_RUN, undefined, {
        assetCount: config.assets.length,
        startDate: config.startDate.toISOString(),
        endDate: config.endDate.toISOString(),
        initialCapital: config.initialCapital,
        monthlyContribution: config.monthlyContribution,
        rebalanceFrequency: config.rebalanceFrequency,
        configId,
      });

      if (configId && configId !== savedIdOf(config)) {
        setCurrentConfig({ ...config, id: configId } as BacktestConfig);
      }

      const transactions: any[] = [];
      for (const monthData of data.result.monthlyHistory ?? []) {
        for (const transaction of monthData.transactions) {
          transactions.push({
            ...transaction,
            totalContribution: monthData.totalContribution,
            portfolioValue: monthData.portfolioValue,
            cashBalance: transaction.cashBalance || monthData.cashBalance
          });
        }
      }
      setCurrentTransactions(transactions);

      setActiveTab('results');
      updateUrl('results', configId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Erro no backtest:', error);
      toast({
        title: 'Erro ao executar o backtest',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Valida os dados históricos; só abre a janela de revisão quando há avisos ou dados insuficientes
  const handleRunBacktest = async (config: BacktestConfig) => {
    if (!config.assets.length) return;

    setIsRunning(true);
    let validation: DataValidation;
    try {
      const response = await fetch('/api/backtest/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: config.assets,
          startDate: config.startDate.toISOString(),
          endDate: config.endDate.toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao validar os dados');
      }

      validation = (await response.json()).validation;
    } catch (error) {
      console.error('Erro na validação:', error);
      toast({
        title: 'Erro na validação',
        description: error instanceof Error ? error.message : 'Erro ao validar os dados',
        variant: 'destructive'
      });
      setIsRunning(false);
      return;
    }

    if (needsValidationReview(validation, config)) {
      setDataValidation(validation);
      setIsRunning(false);
      return;
    }

    await executeBacktest(config);
  };

  const handleAcceptValidation = () => {
    setDataValidation(null);
    if (currentConfig) executeBacktest(currentConfig);
  };

  const handleSaveConfig = async (config: BacktestConfig) => {
    if (!config.assets.length) return;

    try {
      setIsSaving(true);
      const params = toSaveParams(config);
      const savedId = savedIdOf(config);
      const response = await fetch(savedId ? `/api/backtest/configs/${savedId}` : '/api/backtest/config', {
        method: savedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar a configuração');
      }

      const data = await response.json();
      if (!savedId && data.configId) {
        setCurrentConfig({ ...config, id: data.configId } as BacktestConfig);
      }

      toast({ title: 'Configuração salva', description: 'Ela aparece em Minhas configurações.' });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro ao salvar a configuração',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowDetails = useCallback((result: any, config: any, transactions?: any[]) => {
    setCurrentResult(result);
    setCurrentConfig(config);
    setCurrentTransactions(transactions || []);
    setIsLoadingResults(false);
    setActiveTab('results');
    updateUrl('results', config.id);
  }, [updateUrl]);

  // Referência estável para o formulário (preserva o id da configuração)
  const stableInitialConfig = useMemo(() => {
    if (!currentConfig) return null;
    const stableConfig: any = {
      name: currentConfig.name,
      description: currentConfig.description,
      assets: [...currentConfig.assets],
      startDate: new Date(currentConfig.startDate),
      endDate: new Date(currentConfig.endDate),
      initialCapital: currentConfig.initialCapital,
      monthlyContribution: currentConfig.monthlyContribution,
      rebalanceFrequency: currentConfig.rebalanceFrequency
    };
    if ((currentConfig as any).id) stableConfig.id = (currentConfig as any).id;
    return stableConfig as BacktestConfig;
  }, [currentConfig]);

  const savedConfigId = savedIdOf(currentConfig);

  return (
    <>
      {isLoadingConfig && (
        <BacktestLoadingOverlay title="Carregando configuração" description="Buscando os dados da configuração salva" />
      )}

      {dataValidation && (
        <BacktestDataQualityPanel
          validation={dataValidation}
          requested={currentConfig ?? makeExample()}
          onAccept={handleAcceptValidation}
          onCancel={() => setDataValidation(null)}
        />
      )}

      <Tabs value={activeTab} onValueChange={(value) => selectTab(value as TabValue)} className="gap-6">
        <TabsList variant="underline">
          <TabsTrigger value="configure">Configurar</TabsTrigger>
          <TabsTrigger value="results" disabled={!currentResult && !isLoadingResults}>
            Resultados
            {currentResult && (
              <span
                className={cn(
                  'text-xs tabular-nums',
                  currentResult.totalReturn > 0 ? 'text-positive' : currentResult.totalReturn < 0 ? 'text-negative' : 'text-muted-foreground'
                )}
              >
                {formatDeltaPct(currentResult.totalReturn)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Execuções</TabsTrigger>
          <TabsTrigger value="lista">Minhas configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="configure" id="backtest-configure" className="space-y-4">
          {savedConfigId && currentConfig && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-sm text-muted-foreground">
                Editando <span className="font-medium text-foreground">{currentConfig.name}</span>, salva em Minhas configurações.
                Mudanças nos ativos são gravadas nela.
              </p>
              <Button variant="outline" size="sm" onClick={startNewSimulation} className="shrink-0">
                <FilePlus2 strokeWidth={1.75} aria-hidden="true" />
                Nova simulação
              </Button>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <BacktestConfigForm
              key={formKey}
              initialConfig={stableInitialConfig}
              onConfigChange={handleConfigChange}
              onRunBacktest={handleRunBacktest}
              onSaveConfig={handleSaveConfig}
              isRunning={isRunning}
              isSaving={isSaving}
            />

            <aside aria-labelledby="backtest-notes-title" className="h-fit space-y-3 rounded-lg border border-border bg-surface p-4 text-sm lg:sticky lg:top-24">
              <h3 id="backtest-notes-title" className="font-medium text-foreground">
                Como a simulação funciona
              </h3>
              <ul className="list-disc space-y-2 pl-4 text-muted-foreground marker:text-border">
                {SIDE_NOTES.map(note => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                Resultados passados não garantem resultados futuros. Custos, spread e impostos não são considerados. Não é
                recomendação de investimento.
              </p>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="results">
          {isLoadingResults ? (
            <div className="space-y-4" aria-busy="true" aria-label="Carregando resultados">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : currentResult ? (
            <BacktestResults result={currentResult} config={currentConfig} transactions={currentTransactions} />
          ) : (
            <EmptyState
              title="Nenhuma simulação executada"
              description="Configure a carteira e execute o backtest para ver os resultados."
              action={<Button onClick={() => selectTab('configure')}>Ir para a configuração</Button>}
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          {savedConfigId && currentConfig ? (
            <BacktestConfigHistory configId={savedConfigId} configName={currentConfig.name} onShowResult={handleShowDetails} />
          ) : (
            <EmptyState
              title="Selecione uma configuração"
              description="Execute o backtest ou abra uma configuração salva para ver o histórico de execuções dela."
              action={<Button onClick={() => selectTab('lista')}>Ver minhas configurações</Button>}
            />
          )}
        </TabsContent>

        <TabsContent value="lista">
          <BacktestHistory onShowDetails={handleShowDetails} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
