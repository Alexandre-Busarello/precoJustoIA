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
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Settings, 
  Calendar,
  DollarSign,
  TrendingUp,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface AssetData {
  ticker: string;
  companyName?: string;
  sector?: string;
  currentPrice?: number;
}

interface BacktestConfigSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetData;
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

export function BacktestConfigSelector({ 
  isOpen, 
  onClose, 
  asset, 
  onConfigSelected 
}: BacktestConfigSelectorProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<BacktestConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isAddingAsset, setIsAddingAsset] = useState(false);

  // Form para nova configuração
  const [newConfigForm, setNewConfigForm] = useState<NewConfigForm>({
    name: '',
    description: '',
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    monthlyContribution: 1000
  });

  // Carregar configurações existentes (apenas as 10 mais recentes)
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

  // Criar nova configuração
  const createNewConfig = async () => {
    if (!session?.user?.id || !newConfigForm.name.trim()) return;

    setIsCreating(true);
    try {
      // Buscar dividend yield médio do ativo
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

      const configData = {
        name: newConfigForm.name.trim(),
        description: newConfigForm.description.trim() || undefined,
        startDate: newConfigForm.startDate,
        endDate: newConfigForm.endDate,
        initialCapital: newConfigForm.initialCapital,
        monthlyContribution: newConfigForm.monthlyContribution,
        rebalanceFrequency: 'monthly',
        assets: [{
          ticker: asset.ticker,
          allocation: 1.0, // 100% inicialmente
          averageDividendYield: averageDividendYield
        }]
      };

      const response = await fetch('/api/backtest/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });

      if (response.ok) {
        await response.json();
        toast({
          title: "Configuração criada!",
          description: `${asset.ticker} foi adicionado à nova configuração "${newConfigForm.name}".`,
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

  // Adicionar ativo à configuração existente
  const addAssetToConfig = async (configId: string) => {
    if (!session?.user?.id) return;

    setIsAddingAsset(true);
    try {
      const response = await fetch(`/api/backtest/configs/${configId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: asset.ticker
        })
      });

      if (response.ok) {
        const selectedConfig = configs.find(c => c.id === configId);
        toast({
          title: "Ativo adicionado!",
          description: `${asset.ticker} foi adicionado à configuração "${selectedConfig?.name}".`,
        });
        onConfigSelected();
        onClose();
      } else {
        const error = await response.json();
        console.error('Erro ao adicionar ativo:', error);
        toast({
          title: "Erro ao adicionar ativo",
          description: error.error || 'Erro desconhecido',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar ativo:', error);
      toast({
        title: "Erro ao adicionar ativo",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingAsset(false);
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
      setShowCreateForm(false);
      setSelectedConfigId(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-full sm:w-[95vw] sm:h-auto sm:max-h-[90vh] overflow-hidden p-4 sm:p-6 sm:rounded-lg rounded-none">
        <DialogHeader className="pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl flex-1 min-w-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Adicionar {asset.ticker} ao Backtest</span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="sm:hidden flex-shrink-0 ml-2"
            >
              ✕
            </Button>
          </div>
          <DialogDescription className="text-sm sm:text-base">
            Escolha uma configuração existente ou crie uma nova para adicionar {asset.companyName || asset.ticker}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full min-h-0">
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

          <ScrollArea className="flex-1 max-h-[calc(100vh-200px)] sm:max-h-[400px] md:max-h-[500px]">
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
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">{config.name}</CardTitle>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 md:gap-4 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{format(new Date(config.startDate), 'MMM/yy', { locale: ptBR })} - {format(new Date(config.endDate), 'MMM/yy', { locale: ptBR })}</span>
                                <span className="sm:hidden">{format(new Date(config.startDate), 'MM/yy', { locale: ptBR })}</span>
                              </span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <DollarSign className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{formatCurrency(config.initialCapital)}</span>
                                <span className="sm:hidden">R$ {(config.initialCapital / 1000).toFixed(0)}k</span>
                              </span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Settings className="w-3 h-3 flex-shrink-0" />
                                {config.assets.length} ativo{config.assets.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          {config.results && config.results.length > 0 && (
                            <Badge variant="secondary" className="text-xs w-fit">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {config.results[0].annualizedReturn.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3 p-3 sm:p-4">
                        {config.assets.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {config.assets.slice(0, 3).map((asset) => (
                              <Badge key={asset.ticker} variant="outline" className="text-xs">
                                <span className="hidden sm:inline">{asset.ticker} ({(asset.targetAllocation * 100).toFixed(0)}%)</span>
                                <span className="sm:hidden">{asset.ticker}</span>
                              </Badge>
                            ))}
                            {config.assets.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{config.assets.length - 3}
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
                  <Label htmlFor="name" className="text-sm font-medium">Nome da Configuração *</Label>
                  <Input
                    id="name"
                    value={newConfigForm.name}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Carteira Conservadora"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newConfigForm.description}
                    onChange={(e) => setNewConfigForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva a estratégia ou objetivo desta configuração"
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm font-medium">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newConfigForm.startDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm font-medium">Data de Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newConfigForm.endDate}
                      onChange={(e) => setNewConfigForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="initialCapital" className="text-sm font-medium">Capital Inicial (R$)</Label>
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
                    <Label htmlFor="monthlyContribution" className="text-sm font-medium">Aporte Mensal (R$)</Label>
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

                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">Ativo Inicial</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Badge variant="default" className="w-fit">{asset.ticker}</Badge>
                    <span className="text-xs sm:text-sm text-blue-700">
                      <span className="hidden sm:inline">{asset.companyName} - 100% da carteira inicialmente</span>
                      <span className="sm:hidden">100% da carteira inicialmente</span>
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Você poderá ajustar as alocações após criar a configuração
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Botões de ação */}
          <Separator className="my-3 sm:my-4 flex-shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            
            {!showCreateForm ? (
              <Button
                onClick={() => selectedConfigId && addAssetToConfig(selectedConfigId)}
                disabled={!selectedConfigId || isAddingAsset}
                className="w-full sm:w-auto"
              >
                {isAddingAsset ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Adicionar à Configuração</span>
                <span className="sm:hidden">Adicionar</span>
              </Button>
            ) : (
              <Button
                onClick={createNewConfig}
                disabled={!newConfigForm.name.trim() || isCreating}
                className="w-full sm:w-auto"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Criar e Adicionar</span>
                <span className="sm:hidden">Criar</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
