'use client';

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { InfoHint } from '@/components/ui/info-hint';
import { Trash2, RefreshCw, Loader2, Play, Save } from 'lucide-react';
import { AssetSearchInput, CompanySearchResult } from '@/components/asset-search-input';
import { BacktestLoadingOverlay } from '@/components/backtest-loading-overlay';
import { formatBRL, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  formatBRLInput,
  maskBRLInput,
  monthsBetween,
  parseBRLInput,
  type BacktestAssetInput,
  type BacktestConfigInput,
  type RebalanceFrequency,
} from '@/app/backtest/backtest-utils';

type BacktestAsset = BacktestAssetInput;
type BacktestConfig = BacktestConfigInput;

interface BacktestConfigFormProps {
  initialConfig?: BacktestConfig | null;
  onConfigChange: (config: BacktestConfig) => void;
  onRunBacktest: (config: BacktestConfig) => void;
  onSaveConfig?: (config: BacktestConfig) => Promise<void>;
  isRunning: boolean;
  isSaving?: boolean;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const REBALANCE_LABEL: Record<RebalanceFrequency, string> = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  yearly: 'anual',
};

const MAX_INITIAL_CAPITAL = 100_000_000;
const MAX_MONTHLY_CONTRIBUTION = 1_000_000;

/** Configuração ainda não gravada no banco (sem id ou com id temporário gerado no cliente). */
function isUnsaved(id?: string) {
  return !id || id.startsWith('temp-');
}

function emptyConfig(): BacktestConfig {
  const now = new Date();
  return {
    name: 'Nova simulação',
    description: '',
    assets: [],
    startDate: new Date(now.getFullYear() - 3, 0, 1),
    endDate: new Date(now.getFullYear(), now.getMonth(), 1),
    initialCapital: 10000,
    monthlyContribution: 1000,
    rebalanceFrequency: 'monthly'
  };
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur();
}

const SECTION = 'rounded-lg border border-border bg-card p-4 sm:p-5';
const SECTION_TITLE = 'text-base font-semibold tracking-tight text-foreground';
const ERROR_TEXT = 'text-sm text-negative';

export function BacktestConfigForm({
  initialConfig,
  onConfigChange,
  onRunBacktest,
  onSaveConfig,
  isRunning,
  isSaving = false
}: BacktestConfigFormProps) {
  // O primeiro render já usa a configuração recebida (evita o estado vazio no HTML do servidor)
  const [config, setConfig] = useState<BacktestConfig & { id?: string }>(() => initialConfig ?? emptyConfig());

  // Textos dos campos (permitem digitação livre; o valor numérico vai para `config`)
  const [initialCapitalInput, setInitialCapitalInput] = useState(() => formatBRLInput(config.initialCapital));
  const [monthlyContributionInput, setMonthlyContributionInput] = useState(() => formatBRLInput(config.monthlyContribution));
  const [startYearInput, setStartYearInput] = useState(() => String(config.startDate.getFullYear()));
  const [endYearInput, setEndYearInput] = useState(() => String(config.endDate.getFullYear()));

  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isRemovingAsset, setIsRemovingAsset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialConfigRef = useRef<string>(initialConfig ? JSON.stringify(initialConfig) : '');
  const isInitialLoad = useRef(true);
  const configChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncInputsWithConfig = (newConfig: BacktestConfig) => {
    setInitialCapitalInput(formatBRLInput(newConfig.initialCapital));
    setMonthlyContributionInput(formatBRLInput(newConfig.monthlyContribution));
    setStartYearInput(newConfig.startDate.getFullYear().toString());
    setEndYearInput(newConfig.endDate.getFullYear().toString());
  };

  // Carrega a configuração inicial sempre que ela mudar de fato
  useEffect(() => {
    if (initialConfig) {
      const configString = JSON.stringify(initialConfig);
      if (configString !== initialConfigRef.current) {
        initialConfigRef.current = configString;
        setConfig(initialConfig);
        syncInputsWithConfig(initialConfig);
        isInitialLoad.current = true;
      }
    }
  }, [initialConfig]);

  // Notifica mudanças com debounce
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (configChangeTimeoutRef.current) {
      clearTimeout(configChangeTimeoutRef.current);
    }

    configChangeTimeoutRef.current = setTimeout(() => {
      onConfigChange(config);
    }, 100);

    return () => {
      if (configChangeTimeoutRef.current) {
        clearTimeout(configChangeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); // onConfigChange fora das dependências para evitar loop

  const withEqualAllocation = (assets: BacktestAsset[]) => {
    const equalAllocation = assets.length > 0 ? 1 / assets.length : 0;
    return assets.map(asset => ({ ...asset, allocation: equalAllocation }));
  };

  const addAssetLocally = (company: CompanySearchResult) => {
    setConfig(prev => ({
      ...prev,
      assets: withEqualAllocation([
        ...prev.assets,
        { ticker: company.ticker, companyName: company.name, allocation: 0 }
      ])
    }));
  };

  const addAsset = async (company: CompanySearchResult) => {
    if (config.assets.find(a => a.ticker === company.ticker)) {
      return;
    }

    // Carteira ainda não salva com ativos (ex.: carteira de exemplo): adiciona só no cliente.
    // O endpoint de ativos criaria uma configuração nova apenas com o ativo adicionado.
    if (isUnsaved(config.id) && config.assets.length > 0) {
      addAssetLocally(company);
      return;
    }

    setIsAddingAsset(true);
    const configId = config.id ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    try {
      const isFirstAsset = config.assets.length === 0;
      const requestBody: Record<string, unknown> = { ticker: company.ticker };

      if (isFirstAsset) {
        requestBody.configData = {
          name: config.name,
          description: config.description,
          startDate: config.startDate.toISOString(),
          endDate: config.endDate.toISOString(),
          initialCapital: config.initialCapital,
          monthlyContribution: config.monthlyContribution,
          rebalanceFrequency: config.rebalanceFrequency
        };
      }

      const response = await fetch(`/api/backtest/configs/${configId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar ativo');
      }

      const { config: updatedConfig } = await response.json();

      // O backend devolve as alocações recalculadas
      const updatedAssets: BacktestAsset[] = updatedConfig.assets.map((asset: { ticker: string; targetAllocation: number | string }) => ({
        ticker: asset.ticker,
        companyName: company.ticker === asset.ticker ? company.name : asset.ticker,
        allocation: parseFloat(asset.targetAllocation.toString())
      }));

      setConfig(prev => ({
        ...prev,
        id: updatedConfig.id,
        assets: updatedAssets
      }));
    } catch (error) {
      console.error('Erro ao adicionar ativo:', error);
      addAssetLocally(company);
    } finally {
      setIsAddingAsset(false);
    }
  };

  const removeAsset = async (ticker: string) => {
    setIsRemovingAsset(true);

    try {
      if (!isUnsaved(config.id)) {
        const response = await fetch(`/api/backtest/configs/${config.id}/assets?ticker=${ticker}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao remover ativo');
        }

        const { config: updatedConfig } = await response.json();

        const updatedAssets: BacktestAsset[] = updatedConfig.assets.map((asset: { ticker: string; targetAllocation: number | string }) => ({
          ticker: asset.ticker,
          companyName: config.assets.find(a => a.ticker === asset.ticker)?.companyName ?? asset.ticker,
          allocation: parseFloat(asset.targetAllocation.toString())
        }));

        setConfig(prev => ({ ...prev, assets: updatedAssets }));
      } else {
        setConfig(prev => ({ ...prev, assets: withEqualAllocation(prev.assets.filter(a => a.ticker !== ticker)) }));
      }
    } catch (error) {
      console.error('Erro ao remover ativo:', error);
    } finally {
      setIsRemovingAsset(false);
    }
  };

  const clearAssets = () => {
    setConfig(prev => ({ ...prev, assets: [] }));
  };

  const updateAllocation = (ticker: string, allocation: number) => {
    setConfig(prev => ({
      ...prev,
      assets: prev.assets.map(asset => (asset.ticker === ticker ? { ...asset, allocation } : asset))
    }));
  };

  const redistributeEqually = () => {
    setConfig(prev => ({ ...prev, assets: withEqualAllocation(prev.assets) }));
  };

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.name.trim()) {
      newErrors.name = 'Informe um nome para a simulação';
    }

    if (config.assets.length > 20) {
      newErrors.assets = 'Máximo de 20 ativos por carteira';
    }

    if (config.assets.length > 0) {
      const total = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
      if (Math.abs(total - 1) > 0.01) {
        newErrors.allocation = 'Os pesos devem somar 100%';
      }
    }

    if ((!config.initialCapital && config.initialCapital !== 0) || config.initialCapital < 0) {
      newErrors.initialCapital = 'O capital inicial deve ser positivo';
    }

    if (config.monthlyContribution < 0) {
      newErrors.monthlyContribution = 'O aporte mensal não pode ser negativo';
    }

    if (!newErrors.initialCapital && !newErrors.monthlyContribution && config.initialCapital <= 0 && config.monthlyContribution <= 0) {
      newErrors.initialCapital = 'Informe um capital inicial ou um aporte mensal';
    }

    if (config.startDate >= config.endDate) {
      newErrors.dates = 'O início deve ser anterior ao fim';
    } else if (monthsBetween(config.startDate, config.endDate) < 12) {
      newErrors.dates = 'Use um período de pelo menos 12 meses';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRunBacktest = () => {
    if (validateConfig()) {
      onRunBacktest(config);
    }
  };

  const handleSaveConfig = async () => {
    if (validateConfig() && onSaveConfig) {
      await onSaveConfig(config);
    }
  };

  const setYear = (field: 'startDate' | 'endDate', rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '').slice(0, 4);
    if (field === 'startDate') setStartYearInput(digits);
    else setEndYearInput(digits);

    const year = parseInt(digits);
    if (!isNaN(year) && year >= 2000 && year <= new Date().getFullYear()) {
      setConfig(prev => ({ ...prev, [field]: new Date(year, prev[field].getMonth(), 1) }));
    }
  };

  const setMonth = (field: 'startDate' | 'endDate', month: string) => {
    setConfig(prev => ({ ...prev, [field]: new Date(prev[field].getFullYear(), parseInt(month) - 1, 1) }));
  };

  const totalAllocation = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
  const isValidAllocation = Math.abs(totalAllocation - 1) < 0.01;
  const periodMonths = monthsBetween(config.startDate, config.endDate);
  const canRun = config.assets.length > 0 && isValidAllocation && !isRunning && !isSaving;

  const isLoading = isAddingAsset || isRemovingAsset || isSaving || isRunning;

  const renderPeriodField = (field: 'startDate' | 'endDate', label: string) => {
    const date = config[field];
    const yearValue = field === 'startDate' ? startYearInput : endYearInput;
    const monthId = `${field}-month`;
    return (
      <div className="min-w-0 space-y-2">
        <Label htmlFor={monthId}>{label}</Label>
        <div className="flex min-w-0 gap-2">
          <Select value={String(date.getMonth() + 1).padStart(2, '0')} onValueChange={(month) => setMonth(field, month)}>
            <SelectTrigger id={monthId} className="min-w-0 flex-1" aria-label={`Mês de ${label.toLowerCase()}`}>
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, index) => (
                <SelectItem key={name} value={String(index + 1).padStart(2, '0')}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={`Ano de ${label.toLowerCase()}`}
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={4}
            placeholder="Ano"
            value={yearValue}
            onChange={(e) => setYear(field, e.target.value)}
            onKeyDown={blurOnEnter}
            aria-invalid={!!errors.dates}
            className="w-20 shrink-0 tabular-nums sm:w-24"
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {isLoading && (
        <BacktestLoadingOverlay
          title={
            (isAddingAsset && 'Adicionando ativo') ||
            (isRemovingAsset && 'Removendo ativo') ||
            (isSaving && 'Salvando configuração') ||
            (isRunning && 'Executando backtest') ||
            ''
          }
          description={
            (isAddingAsset && 'Recalculando os pesos da carteira') ||
            (isRemovingAsset && 'Redistribuindo os pesos') ||
            (isSaving && 'Gravando suas configurações') ||
            (isRunning && 'Processando a simulação histórica') ||
            undefined
          }
        />
      )}

      <div className="space-y-4" id="backtest-config-form-start">
        {/* Ativos */}
        <section aria-labelledby="backtest-assets-title" className={SECTION}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <h3 id="backtest-assets-title" className={SECTION_TITLE}>
                Ativos da carteira
              </h3>
              <span className="text-sm tabular-nums text-muted-foreground">({config.assets.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {config.assets.length > 0 && isUnsaved(config.id) && (
                <Button variant="ghost" size="sm" onClick={clearAssets}>
                  Limpar
                </Button>
              )}
              {config.assets.length > 1 && (
                <Button variant="outline" size="sm" onClick={redistributeEqually}>
                  <RefreshCw strokeWidth={1.75} aria-hidden="true" />
                  Pesos iguais
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <AssetSearchInput
              label="Adicionar ativo"
              placeholder="Ticker ou nome da empresa"
              onCompanySelect={addAsset}
              disabled={isAddingAsset || isRemovingAsset}
            />
          </div>

          {config.assets.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">Nenhum ativo na carteira</p>
              <p className="mt-1 text-sm text-muted-foreground">Use a busca acima para adicionar ações.</p>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {config.assets.map((asset) => (
                  <li key={asset.ticker} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{asset.ticker}</p>
                        {asset.companyName && asset.companyName !== asset.ticker && (
                          <p className="truncate text-xs text-muted-foreground">{asset.companyName}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAsset(asset.ticker)}
                        aria-label={`Remover ${asset.ticker}`}
                        className="text-muted-foreground hover:text-negative"
                      >
                        <Trash2 strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Peso</span>
                        <span className="font-medium tabular-nums text-foreground">{formatPct(asset.allocation)}</span>
                      </div>
                      <Slider
                        value={[asset.allocation * 100]}
                        onValueChange={(value) => updateAllocation(asset.ticker, value[0] / 100)}
                        max={100}
                        min={0}
                        step={0.1}
                        aria-label={`Peso de ${asset.ticker}`}
                        className="py-2"
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  Proventos simulados
                  <InfoHint
                    label="Como os proventos são simulados"
                    content="A simulação usa os proventos efetivamente pagos por cada ativo no período (dividendos e JCP líquido de IR), creditados pela data-com e reinvestidos no mês seguinte."
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <Badge variant={isValidAllocation ? 'neutral' : 'negative'} className="tabular-nums">
                    {formatPct(totalAllocation)}
                  </Badge>
                </div>
              </div>
              {!isValidAllocation && <p className={cn(ERROR_TEXT, 'mt-2')}>Os pesos devem somar 100%.</p>}
            </>
          )}

          {errors.assets && <p className={cn(ERROR_TEXT, 'mt-2')}>{errors.assets}</p>}
        </section>

        {/* Período e valores */}
        <section aria-labelledby="backtest-params-title" className={SECTION}>
          <div className="flex items-center gap-1">
            <h3 id="backtest-params-title" className={SECTION_TITLE}>
              Período e valores
            </h3>
            <InfoHint
              label="Sobre o período"
              content="A simulação usa o primeiro dia de cada mês. Se algum ativo não tiver histórico no início escolhido, o período é ajustado para o intervalo em que todos têm dados."
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {renderPeriodField('startDate', 'Início')}
            {renderPeriodField('endDate', 'Fim')}
          </div>
          {errors.dates && <p className={cn(ERROR_TEXT, 'mt-2')}>{errors.dates}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="initialCapital">Capital inicial</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
                <Input
                  id="initialCapital"
                  inputMode="decimal"
                  enterKeyHint="next"
                  autoComplete="off"
                  value={initialCapitalInput}
                  onChange={(e) => {
                    const masked = maskBRLInput(e.target.value);
                    setInitialCapitalInput(masked);
                    const numericValue = parseBRLInput(masked);
                    if (numericValue <= MAX_INITIAL_CAPITAL) {
                      setConfig(prev => ({ ...prev, initialCapital: numericValue }));
                    }
                  }}
                  onBlur={() => setInitialCapitalInput(formatBRLInput(parseBRLInput(initialCapitalInput)))}
                  onKeyDown={blurOnEnter}
                  placeholder="10.000"
                  aria-invalid={!!errors.initialCapital}
                  className="pl-10 tabular-nums"
                />
              </div>
              {errors.initialCapital && <p className={ERROR_TEXT}>{errors.initialCapital}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">Aporte mensal</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
                <Input
                  id="monthlyContribution"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  value={monthlyContributionInput}
                  onChange={(e) => {
                    const masked = maskBRLInput(e.target.value);
                    setMonthlyContributionInput(masked);
                    const numericValue = parseBRLInput(masked);
                    if (numericValue <= MAX_MONTHLY_CONTRIBUTION) {
                      setConfig(prev => ({ ...prev, monthlyContribution: numericValue }));
                    }
                  }}
                  onBlur={() => setMonthlyContributionInput(formatBRLInput(parseBRLInput(monthlyContributionInput)))}
                  onKeyDown={blurOnEnter}
                  placeholder="0"
                  aria-invalid={!!errors.monthlyContribution}
                  aria-describedby="monthlyContribution-hint"
                  className="pl-10 tabular-nums"
                />
              </div>
              <p id="monthlyContribution-hint" className="text-xs text-muted-foreground">
                Use 0 para simular apenas o capital inicial.
              </p>
              {errors.monthlyContribution && <p className={ERROR_TEXT}>{errors.monthlyContribution}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rebalanceFrequency">Rebalanceamento</Label>
              <Select
                value={config.rebalanceFrequency}
                onValueChange={(value) => setConfig(prev => ({ ...prev, rebalanceFrequency: value as RebalanceFrequency }))}
              >
                <SelectTrigger id="rebalanceFrequency" className="w-full">
                  <SelectValue placeholder="Frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Frequência em que a carteira volta aos pesos definidos.</p>
            </div>
          </div>
        </section>

        {/* Identificação */}
        <section aria-labelledby="backtest-name-title" className={SECTION}>
          <h3 id="backtest-name-title" className={SECTION_TITLE}>
            Identificação
          </h3>
          <div className="mt-4 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da simulação</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={blurOnEnter}
                enterKeyHint="done"
                placeholder="Ex.: carteira de dividendos"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className={ERROR_TEXT}>{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva a estratégia"
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* Resumo e ações */}
        <section aria-label="Executar simulação" className={SECTION}>
          <p className="text-sm text-muted-foreground">
            {config.assets.length > 0 ? (
              <>
                <span className="tabular-nums">{config.assets.length}</span> {config.assets.length === 1 ? 'ativo' : 'ativos'} ·{' '}
                <span className="tabular-nums">{periodMonths}</span> meses · {formatBRL(config.initialCapital)} iniciais ·{' '}
                {config.monthlyContribution > 0 ? `${formatBRL(config.monthlyContribution)} por mês` : 'sem aportes'} · rebalanceamento{' '}
                {REBALANCE_LABEL[config.rebalanceFrequency]}
              </>
            ) : (
              'Adicione pelo menos um ativo para executar a simulação.'
            )}
          </p>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row-reverse lg:justify-start">
            {/* No mobile o botão principal fica fixo no rodapé, acima da navegação inferior */}
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background px-4 py-2 pr-20 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
              <Button onClick={handleRunBacktest} disabled={!canRun} className="h-12 w-full text-base md:h-12 lg:h-10 lg:w-auto lg:text-sm">
                {isRunning ? (
                  <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Play strokeWidth={1.75} aria-hidden="true" />
                )}
                {isRunning ? 'Executando backtest' : 'Executar backtest'}
              </Button>
            </div>

            {onSaveConfig && (
              <Button
                onClick={handleSaveConfig}
                disabled={isSaving || isRunning || (config.assets.length > 0 && !isValidAllocation)}
                variant="outline"
                className="w-full lg:w-auto"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Save strokeWidth={1.75} aria-hidden="true" />
                )}
                {isSaving ? 'Salvando configuração' : 'Salvar configuração'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
