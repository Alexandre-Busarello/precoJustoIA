'use client';

import { useState, useEffect } from 'react';
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
  const loadConfigs = async () => {
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
  };

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
  }, [isOpen, session?.user?.id]);

  // Reset form quando fechar
  useEffect(() => {
    if (!isOpen) {
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
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Criar Backtest em Lote
          </DialogTitle>
          <DialogDescription>
            Selecione quantas empresas do ranking deseja incluir no backtest e escolha uma configuração
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Seletor de Top X */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/10 dark:to-violet-950/10 rounded-lg border">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold">Seleção de Empresas</h4>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Top empresas do ranking</Label>
                  <Badge variant="outline" className="font-mono">
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

              {/* Preview das empresas selecionadas */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Empresas selecionadas:</Label>
                <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {selectedAssets.map((asset, index) => (
                    <div key={asset.ticker} className="flex items-center gap-2 bg-white dark:bg-background px-2 py-1 rounded-md border text-xs">
                      <CompanyLogo 
                        logoUrl={asset.logoUrl}
                        companyName={asset.name}
                        ticker={asset.ticker}
                        size={16}
                      />
                      <span className="font-medium">#{index + 1}</span>
                      <span>{asset.ticker}</span>
                      <span className="text-muted-foreground">({(100 / topCount).toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada empresa terá {(100 / topCount).toFixed(1)}% de alocação na carteira
                </p>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button
              variant={!showCreateForm ? "default" : "outline"}
              onClick={() => setShowCreateForm(false)}
              className="flex-1"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Configurações Existentes</span>
              <span className="sm:hidden">Existentes</span>
            </Button>
            <Button
              variant={showCreateForm ? "default" : "outline"}
              onClick={() => setShowCreateForm(true)}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nova Configuração</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>

          <ScrollArea className="flex-1 max-h-[400px]">
            {!showCreateForm ? (
              // Lista de configurações existentes
              <div className="space-y-3">
                {configs.length > 0 && (
                  <div className="text-xs text-gray-500 mb-3 px-1">
                    Mostrando as 10 configurações mais recentes
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Carregando configurações...
                  </div>
                ) : configs.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma configuração encontrada
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Crie sua primeira configuração de backtest para começar
                    </p>
                    <Button onClick={() => setShowCreateForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeira Configuração
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
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{config.name}</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500 mt-1">
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
                      <CardContent className="pt-0 pb-3">
                        {config.assets.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {config.assets.slice(0, 4).map((asset) => (
                              <Badge key={asset.ticker} variant="outline" className="text-xs">
                                {asset.ticker} ({(asset.targetAllocation * 100).toFixed(0)}%)
                              </Badge>
                            ))}
                            {config.assets.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{config.assets.length - 4}
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
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Configuração *</Label>
                  <Input
                    id="name"
                    value={newConfigForm.name}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={`Backtest Top ${topCount} - ${new Date().toLocaleDateString('pt-BR')}`}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newConfigForm.description}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={`Backtest criado a partir do ranking - Top ${topCount} empresas`}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newConfigForm.startDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Data de Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newConfigForm.endDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="initialCapital">Capital Inicial (R$)</Label>
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
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthlyContribution">Aporte Mensal (R$)</Label>
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
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Ativos Selecionados</h4>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {selectedAssets.map((asset, index) => (
                        <Badge key={asset.ticker} variant="default" className="text-xs">
                          #{index + 1} {asset.ticker}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600">
                      {topCount} empresas com {(100 / topCount).toFixed(1)}% de alocação cada
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Botões de ação */}
          <Separator className="my-4" />
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {!showCreateForm ? (
              <Button
                onClick={() => selectedConfigId && addAssetsToConfig(selectedConfigId)}
                disabled={!selectedConfigId || isAddingAssets}
              >
                {isAddingAssets ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Adicionar {topCount} Empresas
              </Button>
            ) : (
              <Button
                onClick={createNewConfigWithAssets}
                disabled={!newConfigForm.name.trim() || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar com {topCount} Empresas
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
