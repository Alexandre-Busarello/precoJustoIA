'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { CompanyLogo } from '@/components/company-logo';
import { Plus, Loader2, Check, X } from 'lucide-react';
import { formatBRL, formatDate, formatDeltaPct, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RankingResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  logoUrl?: string | null;
  fairValue: number | null;
  upside: number | null;
  marginOfSafety: number | null;
  rational: string;
  key_metrics?: Record<string, number | null>;
}

interface BacktestConfig {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
  assets: Array<{
    ticker: string;
    targetAllocation: number;
  }>;
  results?: Array<{
    totalReturn: number;
    annualizedReturn: number;
    calculatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface BatchBacktestSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  rankingResults: RankingResult[];
  onConfigSelected: () => void;
}

interface NewConfigForm {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  monthlyContribution: number;
}

export function BatchBacktestSelector({ 
  isOpen, 
  onClose, 
  rankingResults, 
  onConfigSelected 
}: BatchBacktestSelectorProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<BacktestConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState<'select-companies' | 'choose-config'>('select-companies');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isAddingAssets, setIsAddingAssets] = useState(false);
  const [topCount, setTopCount] = useState(5); // Número de empresas do top para selecionar

  // Form para nova configuração
  const [newConfigForm, setNewConfigForm] = useState<NewConfigForm>({
    name: '',
    description: '',
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    monthlyContribution: 1000
  });

  // Carregar configurações existentes
  const loadConfigs = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/backtest/configs?limit=10');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      } else {
        console.error('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Criar nova configuração com múltiplos ativos
  const createNewConfigWithAssets = async () => {
    if (!session?.user?.id || !newConfigForm.name.trim()) return;

    setIsCreating(true);
    try {
      const selectedAssets = rankingResults.slice(0, topCount);
      const equalAllocation = 1 / selectedAssets.length;

      // Buscar dividend yield médio para todos os ativos em paralelo
      const assetsWithDY = await Promise.all(
        selectedAssets.map(async (asset) => {
          let averageDividendYield: number | null = null;
          try {
            const response = await fetch(`/api/dividend-yield-average/${asset.ticker}`);
            if (response.ok) {
              const data = await response.json();
              averageDividendYield = data.averageDividendYield;
            }
          } catch (error) {
            console.error(`Erro ao buscar DY médio para ${asset.ticker}:`, error);
          }

          return {
            ticker: asset.ticker,
            allocation: equalAllocation,
            averageDividendYield: averageDividendYield
          };
        })
      );

      const configData = {
        name: newConfigForm.name.trim(),
        description: newConfigForm.description.trim() || `Backtest criado a partir do ranking - Top ${topCount} empresas`,
        startDate: newConfigForm.startDate,
        endDate: newConfigForm.endDate,
        initialCapital: newConfigForm.initialCapital,
        monthlyContribution: newConfigForm.monthlyContribution,
        rebalanceFrequency: 'monthly',
        assets: assetsWithDY
      };

      const response = await fetch('/api/backtest/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });

      if (response.ok) {
        toast({
          title: "Configuração criada",
          description: `Backtest criado com ${topCount} empresas do ranking: ${selectedAssets.map(a => a.ticker).join(', ')}.`,
        });
        onConfigSelected();
        onClose();
      } else {
        const error = await response.json();
        console.error('Erro ao criar configuração:', error);
        toast({
          title: "Erro ao criar configuração",
          description: error.error || 'Erro desconhecido',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao criar configuração:', error);
      toast({
        title: "Erro ao criar configuração",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Adicionar múltiplos ativos à configuração existente
  const addAssetsToConfig = async (configId: string) => {
    if (!session?.user?.id) return;

    setIsAddingAssets(true);
    try {
      const selectedAssets = rankingResults.slice(0, topCount);
      const selectedConfig = configs.find(c => c.id === configId);

      // Adicionar ativos um por um (a API já faz a redistribuição automática)
      for (const asset of selectedAssets) {
        const response = await fetch(`/api/backtest/configs/${configId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: asset.ticker
          })
        });

        if (!response.ok) {
          const error = await response.json();
          // Se o ativo já existe, continuar com o próximo
          if (error.error?.includes('já existe')) {
            console.log(`${asset.ticker} já existe na configuração, pulando...`);
            continue;
          }
          throw new Error(`Erro ao adicionar ${asset.ticker}: ${error.error}`);
        }
      }

      toast({
        title: "Ativos adicionados",
        description: `${topCount} empresas foram adicionadas à configuração "${selectedConfig?.name}": ${selectedAssets.map(a => a.ticker).join(', ')}.`,
      });
      onConfigSelected();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar ativos:', error);
      toast({
        title: "Erro ao adicionar ativos",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingAssets(false);
    }
  };

  // Carregar configurações quando o modal abrir
  useEffect(() => {
    if (isOpen && session?.user?.id) {
      loadConfigs();
    }
  }, [isOpen, session?.user?.id, loadConfigs]);

  // Reset form quando fechar
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('select-companies');
      setShowCreateForm(false);
      setSelectedConfigId(null);
      setTopCount(5);
      setNewConfigForm({
        name: '',
        description: '',
        startDate: '2020-01-01',
        endDate: new Date().toISOString().split('T')[0],
        initialCapital: 10000,
        monthlyContribution: 1000
      });
    }
  }, [isOpen]);

  const selectedAssets = rankingResults.slice(0, topCount);
  const allocationLabel = formatPct(1 / topCount);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 space-y-3 border-b border-border px-4 pt-4 pb-3 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold">
              {currentStep === 'select-companies' ? 'Backtest do ranking' : 'Escolha a configuração'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" className="-mt-1 -mr-2 shrink-0">
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
          <DialogDescription>
            {currentStep === 'select-companies'
              ? 'Escolha quantas empresas do topo do ranking entram no backtest.'
              : 'Adicione as empresas a uma configuração existente ou crie uma nova.'}
          </DialogDescription>
          <ol className="flex items-center gap-2 text-xs" aria-label="Etapas">
            {(['select-companies', 'choose-config'] as const).map((step, index) => {
              const active = currentStep === step
              const done = currentStep === 'choose-config' && step === 'select-companies'
              return (
                <li key={step} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-border" />}
                  <span
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-medium',
                      active ? 'bg-brand-subtle text-brand' : 'text-muted-foreground'
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <span className="tabular-nums">{index + 1}</span>
                    )}
                    {step === 'select-companies' ? 'Empresas' : 'Configuração'}
                  </span>
                </li>
              )
            })}
          </ol>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {currentStep === 'select-companies' ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="batch-backtest-top">Empresas do topo do ranking</Label>
                  <span className="text-sm font-medium tabular-nums text-foreground">{topCount}</span>
                </div>
                <Slider
                  id="batch-backtest-top"
                  aria-label="Empresas do topo do ranking"
                  value={[topCount]}
                  onValueChange={(value) => setTopCount(value[0])}
                  max={Math.max(2, Math.min(rankingResults.length, 20))}
                  min={2}
                  step={1}
                  className="h-11 md:h-8"
                />
                <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                  <span>2</span>
                  <span>{Math.max(2, Math.min(rankingResults.length, 20))}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-foreground">Empresas selecionadas</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{allocationLabel} cada</span>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {selectedAssets.map((asset, index) => (
                    <li key={asset.ticker} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <CompanyLogo logoUrl={asset.logoUrl} companyName={asset.name} ticker={asset.ticker} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{asset.ticker}</span>
                        <span className="block truncate text-xs text-muted-foreground">{asset.name}</span>
                      </span>
                      <span className="text-sm tabular-nums text-foreground">{allocationLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                <p className="min-w-0 truncate text-sm text-foreground">
                  <span className="font-medium tabular-nums">{topCount} empresas:</span>{' '}
                  <span className="text-muted-foreground">
                    {selectedAssets.slice(0, 3).map((asset) => asset.ticker).join(', ')}
                    {topCount > 3 ? ` e mais ${topCount - 3}` : ''}
                  </span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep('select-companies')} className="shrink-0">
                  Alterar
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Destino">
                <Button variant={!showCreateForm ? 'default' : 'outline'} onClick={() => setShowCreateForm(false)} aria-pressed={!showCreateForm}>
                  Configurações existentes
                </Button>
                <Button variant={showCreateForm ? 'default' : 'outline'} onClick={() => setShowCreateForm(true)} aria-pressed={showCreateForm}>
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  Nova
                </Button>
              </div>

              {!showCreateForm ? (
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                      <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      Carregando configurações
                    </div>
                  ) : configs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                      <p className="text-sm font-medium text-foreground">Nenhuma configuração encontrada</p>
                      <p className="mt-1 text-sm text-muted-foreground">Crie a primeira configuração de backtest com estas empresas.</p>
                      <Button onClick={() => setShowCreateForm(true)} size="sm" className="mt-4">
                        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                        Criar configuração
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">As 10 configurações mais recentes</p>
                      <ul className="space-y-2">
                        {configs.map((config) => {
                          const selected = selectedConfigId === config.id
                          const lastResult = config.results?.[0]
                          return (
                            <li key={config.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedConfigId(config.id)}
                                aria-pressed={selected}
                                className={cn(
                                  'w-full rounded-lg border bg-card px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                                  selected ? 'border-brand ring-1 ring-brand' : 'border-border'
                                )}
                              >
                                <span className="flex items-start justify-between gap-3">
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-foreground">{config.name}</span>
                                    <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                                      {formatDate(config.startDate)} a {formatDate(config.endDate)} · {formatBRL(config.initialCapital, { digits: 0 })} ·{' '}
                                      {config.assets.length} {config.assets.length === 1 ? 'ativo' : 'ativos'}
                                    </span>
                                  </span>
                                  {lastResult && (
                                    <span
                                      className={cn(
                                        'shrink-0 text-xs font-medium tabular-nums',
                                        lastResult.annualizedReturn >= 0 ? 'text-positive' : 'text-negative'
                                      )}
                                    >
                                      {formatDeltaPct(lastResult.annualizedReturn)} a.a.
                                    </span>
                                  )}
                                </span>
                                {config.assets.length > 0 && (
                                  <span className="mt-2 block truncate text-xs text-muted-foreground">
                                    {config.assets.slice(0, 4).map((asset) => `${asset.ticker} ${formatPct(asset.targetAllocation, { digits: 0 })}`).join(' · ')}
                                    {config.assets.length > 4 ? ` · +${config.assets.length - 4}` : ''}
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch-backtest-name">Nome da configuração</Label>
                    <Input
                      id="batch-backtest-name"
                      value={newConfigForm.name}
                      onChange={(e) => setNewConfigForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={`Top ${topCount} do ranking, ${formatDate(new Date())}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="batch-backtest-description">Descrição (opcional)</Label>
                    <Textarea
                      id="batch-backtest-description"
                      value={newConfigForm.description}
                      onChange={(e) => setNewConfigForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder={`Backtest criado a partir do ranking: top ${topCount} empresas`}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="batch-backtest-start">Data de início</Label>
                      <Input
                        id="batch-backtest-start"
                        type="date"
                        value={newConfigForm.startDate}
                        onChange={(e) => setNewConfigForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-backtest-end">Data de fim</Label>
                      <Input
                        id="batch-backtest-end"
                        type="date"
                        value={newConfigForm.endDate}
                        onChange={(e) => setNewConfigForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="batch-backtest-capital">Capital inicial (R$)</Label>
                      <Input
                        id="batch-backtest-capital"
                        type="number"
                        inputMode="decimal"
                        min="1000"
                        step="1000"
                        value={newConfigForm.initialCapital}
                        onChange={(e) => setNewConfigForm((prev) => ({ ...prev, initialCapital: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batch-backtest-monthly">Aporte mensal (R$)</Label>
                      <Input
                        id="batch-backtest-monthly"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="100"
                        value={newConfigForm.monthlyContribution}
                        onChange={(e) => setNewConfigForm((prev) => ({ ...prev, monthlyContribution: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-sm font-medium text-foreground">Ativos selecionados</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedAssets.map((asset) => asset.ticker).join(', ')} · {allocationLabel} cada
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {currentStep === 'select-companies' ? (
              <Button onClick={() => setCurrentStep('choose-config')}>Continuar com {topCount} empresas</Button>
            ) : !showCreateForm ? (
              <Button onClick={() => selectedConfigId && addAssetsToConfig(selectedConfigId)} disabled={!selectedConfigId || isAddingAssets}>
                {isAddingAssets && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                Adicionar {topCount} empresas
              </Button>
            ) : (
              <Button onClick={createNewConfigWithAssets} disabled={!newConfigForm.name.trim() || isCreating}>
                {isCreating && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                Criar com {topCount} empresas
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
