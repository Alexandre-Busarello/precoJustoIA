'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { CompanyLogo } from '@/components/company-logo';
import { 
  Plus, 
  Settings, 
  Calendar,
  DollarSign,
  TrendingUp,
  Loader2,
  Check,
  AlertCircle,
  BarChart3,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
          title: "Configuração criada!",
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
        title: "Ativos adicionados!",
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const selectedAssets = rankingResults.slice(0, topCount);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[100vw] sm:w-[95vw] h-[100vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 sm:rounded-lg rounded-none overflow-hidden" showCloseButton={false}>
        <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 border-b">{/* Indicador de passos */}
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl flex-1 min-w-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">
                {currentStep === 'select-companies' ? 'Selecionar Empresas' : 'Escolher Configuração'}
              </span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0 ml-2"
              title="Fechar"
            >
              ✕
            </Button>
          </div>
          <DialogDescription className="text-sm sm:text-base">
            {currentStep === 'select-companies' 
              ? 'Escolha quantas empresas do ranking deseja incluir no backtest'
              : 'Selecione uma configuração existente ou crie uma nova'
            }
          </DialogDescription>
          
          {/* Indicador de passos */}
          <div className="flex items-center gap-2 mt-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              currentStep === 'select-companies' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'select-companies' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-green-500 text-white'
              }`}>
                1
              </span>
              Empresas
            </div>
            <div className={`w-8 h-0.5 ${
              currentStep === 'choose-config' ? 'bg-green-300' : 'bg-gray-300'
            }`} />
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              currentStep === 'choose-config' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 'choose-config' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-400 text-white'
              }`}>
                2
              </span>
              Configuração
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Scrollável */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-3 sm:py-4">
          {currentStep === 'select-companies' ? (
            // PASSO 1: Seleção de Empresas
            <div className="space-y-3 sm:space-y-4 h-full flex flex-col">
              <div className="space-y-3 sm:space-y-4 flex-shrink-0">
                <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-lg border">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-base sm:text-lg">Seleção de Empresas</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Top empresas do ranking</Label>
                        <Badge variant="outline" className="font-mono text-sm">
                          {topCount} empresas
                        </Badge>
                      </div>
                      <Slider
                        value={[topCount]}
                        onValueChange={(value) => setTopCount(value[0])}
                        max={Math.min(rankingResults.length, 20)}
                        min={2}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Top 2</span>
                        <span>Top {Math.min(rankingResults.length, 20)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview das empresas selecionadas */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm sm:text-base font-semibold">Empresas Selecionadas</Label>
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    {(100 / topCount).toFixed(1)}% cada
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                    {selectedAssets.map((asset, index) => (
                      <div key={asset.ticker} className="flex items-center gap-3 p-3 bg-white dark:bg-background rounded-lg border hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                            {index + 1}
                          </div>
                          <CompanyLogo 
                            logoUrl={asset.logoUrl}
                            companyName={asset.name}
                            ticker={asset.ticker}
                            size={24}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{asset.ticker}</div>
                          <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{(100 / topCount).toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">alocação</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            // PASSO 2: Escolha de Configuração
            <div className="flex flex-col h-full min-h-0">
              {/* Resumo das empresas selecionadas - Compacto */}
              <div className="mb-3 p-2 sm:p-2.5 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">✓</span>
                      </div>
                      <span className="font-medium text-green-900 dark:text-green-100 text-xs sm:text-sm whitespace-nowrap">
                        {topCount} empresas
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {selectedAssets.slice(0, 3).map((asset) => (
                        <Badge key={asset.ticker} variant="outline" className="text-xs bg-white dark:bg-background">
                          {asset.ticker}
                        </Badge>
                      ))}
                      {topCount > 3 && (
                        <Badge variant="outline" className="text-xs bg-white dark:bg-background">
                          +{topCount - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep('select-companies')}
                    className="text-xs text-green-700 hover:text-green-900 h-6 px-2 flex-shrink-0"
                  >
                    Alterar
                  </Button>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3 flex-shrink-0">
                <Button
                  variant={!showCreateForm ? "default" : "outline"}
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 h-11 sm:h-10"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline text-sm">Configurações Existentes</span>
                  <span className="sm:hidden text-sm">Existentes</span>
                </Button>
                <Button
                  variant={showCreateForm ? "default" : "outline"}
                  onClick={() => setShowCreateForm(true)}
                  className="flex-1 h-11 sm:h-10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline text-sm">Nova Configuração</span>
                  <span className="sm:hidden text-sm">Nova</span>
                </Button>
              </div>
              
            {!showCreateForm ? (
              // Lista de configurações existentes
              <div className="space-y-2 sm:space-y-3">
                {configs.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2 sm:mb-3 px-1">
                    Mostrando as 10 configurações mais recentes
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mr-2" />
                    <span className="text-sm sm:text-base">Carregando configurações...</span>
                  </div>
                ) : configs.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 px-4">
                      Nenhuma configuração encontrada
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-3 sm:mb-4 px-4">
                      Crie sua primeira configuração de backtest para começar
                    </p>
                    <Button onClick={() => setShowCreateForm(true)} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      <span className="text-sm">Criar Primeira Configuração</span>
                    </Button>
                  </div>
                ) : (
                  configs.map((config) => (
                    <Card 
                      key={config.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedConfigId === config.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedConfigId(config.id)}
                    >
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">{config.name}</CardTitle>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="hidden sm:inline">{format(new Date(config.startDate), 'MMM/yy', { locale: ptBR })} - {format(new Date(config.endDate), 'MMM/yy', { locale: ptBR })}</span>
                                <span className="sm:hidden">{format(new Date(config.startDate), 'MM/yy', { locale: ptBR })}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                <span className="hidden sm:inline">{formatCurrency(config.initialCapital)}</span>
                                <span className="sm:hidden">R$ {(config.initialCapital / 1000).toFixed(0)}k</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Settings className="w-3 h-3" />
                                {config.assets.length} ativo{config.assets.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {config.results && config.results.length > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {config.results[0].annualizedReturn.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-2 sm:pb-3 p-3 sm:p-4">
                        {config.assets.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {config.assets.slice(0, 3).map((asset) => (
                              <Badge key={asset.ticker} variant="outline" className="text-xs whitespace-nowrap">
                                <span className="hidden sm:inline">{asset.ticker} ({(asset.targetAllocation * 100).toFixed(0)}%)</span>
                                <span className="sm:hidden">{asset.ticker}</span>
                              </Badge>
                            ))}
                            {config.assets.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                <span className="hidden sm:inline">+{config.assets.length - 3} mais</span>
                                <span className="sm:hidden">+{config.assets.length - 3}</span>
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              // Formulário para nova configuração
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm sm:text-base">Nome da Configuração *</Label>
                  <Input
                    id="name"
                    value={newConfigForm.name}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`Backtest Top ${topCount} - ${new Date().toLocaleDateString('pt-BR')}`}
                    className="mt-1 text-sm sm:text-base h-9 sm:h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm sm:text-base">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newConfigForm.description}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={`Backtest criado a partir do ranking - Top ${topCount} empresas`}
                    className="mt-1 text-sm sm:text-base min-h-[60px] sm:min-h-[70px]"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm sm:text-base">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newConfigForm.startDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="mt-1 text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm sm:text-base">Data de Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newConfigForm.endDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1 text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="initialCapital" className="text-sm sm:text-base">Capital Inicial (R$)</Label>
                    <Input
                      id="initialCapital"
                      type="number"
                      min="1000"
                      step="1000"
                      value={newConfigForm.initialCapital}
                      onChange={(e) => setNewConfigForm(prev => ({ 
                        ...prev, 
                        initialCapital: parseFloat(e.target.value) || 0 
                      }))}
                      className="mt-1 text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthlyContribution" className="text-sm sm:text-base">Aporte Mensal (R$)</Label>
                    <Input
                      id="monthlyContribution"
                      type="number"
                      min="0"
                      step="100"
                      value={newConfigForm.monthlyContribution}
                      onChange={(e) => setNewConfigForm(prev => ({ 
                        ...prev, 
                        monthlyContribution: parseFloat(e.target.value) || 0 
                      }))}
                      className="mt-1 text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm sm:text-base">Ativos Selecionados</h4>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {selectedAssets.map((asset, index) => (
                        <Badge key={asset.ticker} variant="default" className="text-xs">
                          #{index + 1} {asset.ticker}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {topCount} empresas com {(100 / topCount).toFixed(1)}% de alocação cada
                    </p>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Botões - Fixo no fundo */}
        <div className="border-t bg-background flex-shrink-0">
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full sm:w-auto h-9 sm:h-10"
              size="sm"
            >
              <span className="text-sm">Cancelar</span>
            </Button>
            
            {currentStep === 'select-companies' ? (
              <Button
                onClick={() => setCurrentStep('choose-config')}
                className="w-full sm:w-auto h-9 sm:h-10"
                size="sm"
              >
                <span className="hidden sm:inline text-sm">Continuar com {topCount} Empresas</span>
                <span className="sm:hidden text-sm">Continuar</span>
              </Button>
            ) : !showCreateForm ? (
              <Button
                onClick={() => selectedConfigId && addAssetsToConfig(selectedConfigId)}
                disabled={!selectedConfigId || isAddingAssets}
                className="w-full sm:w-auto h-9 sm:h-10"
                size="sm"
              >
                {isAddingAssets ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                )}
                <span className="hidden sm:inline text-sm">Adicionar {topCount} Empresas</span>
                <span className="sm:hidden text-sm">Adicionar</span>
              </Button>
            ) : (
              <Button
                onClick={createNewConfigWithAssets}
                disabled={!newConfigForm.name.trim() || isCreating}
                className="w-full sm:w-auto h-9 sm:h-10"
                size="sm"
              >
                {isCreating ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                )}
                <span className="hidden sm:inline text-sm">Criar com {topCount} Empresas</span>
                <span className="sm:hidden text-sm">Criar</span>
              </Button>
            )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
