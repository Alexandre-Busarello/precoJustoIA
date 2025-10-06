'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  Info,
  Settings,
  BarChart3
} from 'lucide-react';

// Interfaces
interface BacktestAsset {
  ticker: string;
  companyName?: string;
  allocation: number;
  averageDividendYield?: number; // DY médio dos últimos 5 anos (formato decimal, ex: 0.085 = 8.5%)
}

interface BacktestConfig {
  name: string;
  description?: string;
  assets: BacktestAsset[];
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
}

interface BacktestConfigFormProps {
  initialConfig?: BacktestConfig | null;
  onConfigChange: (config: BacktestConfig) => void;
  onRunBacktest: (config: BacktestConfig) => void;
  onSaveConfig?: (config: BacktestConfig) => Promise<void>;
  isRunning: boolean;
  isSaving?: boolean;
}

interface CompanySearchResult {
  id: string;
  ticker: string;
  name: string;
  sector?: string;
  logoUrl?: string;
}

export function BacktestConfigForm({ 
  initialConfig, 
  onConfigChange, 
  onRunBacktest, 
  onSaveConfig,
  isRunning,
  isSaving = false
}: BacktestConfigFormProps) {
  const [config, setConfig] = useState<BacktestConfig & { id?: string }>({
    name: 'Nova Simulação',
    description: '',
    assets: [],
    startDate: new Date(new Date().getFullYear() - 3, 0, 1), // 3 anos atrás
    endDate: new Date(),
    initialCapital: 10000,
    monthlyContribution: 1000,
    rebalanceFrequency: 'monthly'
  });

  // Estados locais para os inputs numéricos (permite digitação natural)
  const [initialCapitalInput, setInitialCapitalInput] = useState('10.000');
  const [monthlyContributionInput, setMonthlyContributionInput] = useState('1.000');
  const [startYearInput, setStartYearInput] = useState('2021');
  const [endYearInput, setEndYearInput] = useState('2024');
  
  // Estados locais para DY de cada ativo (mapa ticker -> valor input)
  const [dividendYieldInputs, setDividendYieldInputs] = useState<Record<string, string>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isRemovingAsset, setIsRemovingAsset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const initialConfigRef = useRef<string>('');
  const isInitialLoad = useRef(true);
  const configChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Funções para sincronizar inputs com config
  const syncInputsWithConfig = (newConfig: BacktestConfig) => {
    setInitialCapitalInput(newConfig.initialCapital.toLocaleString('pt-BR'));
    setMonthlyContributionInput(newConfig.monthlyContribution.toLocaleString('pt-BR'));
    setStartYearInput(newConfig.startDate.getFullYear().toString());
    setEndYearInput(newConfig.endDate.getFullYear().toString());
    
    // Sincronizar DY inputs
    const newDividendYieldInputs: Record<string, string> = {};
    newConfig.assets.forEach(asset => {
      newDividendYieldInputs[asset.ticker] = asset.averageDividendYield ? 
        (asset.averageDividendYield * 100).toFixed(2) : '';
    });
    setDividendYieldInputs(newDividendYieldInputs);
  };

  // Carregar configuração inicial apenas uma vez
  useEffect(() => {
    if (initialConfig) {
      const configString = JSON.stringify(initialConfig);
      if (configString !== initialConfigRef.current) {
        console.log('🔄 Carregando nova configuração inicial:', initialConfig.name);
        initialConfigRef.current = configString;
        setConfig(initialConfig);
        syncInputsWithConfig(initialConfig);
        isInitialLoad.current = true; // Reset flag quando carrega nova config
      }
    }
  }, [initialConfig]);

  // Notificar mudanças na configuração com debounce
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    // Cancelar timeout anterior
    if (configChangeTimeoutRef.current) {
      clearTimeout(configChangeTimeoutRef.current);
    }
    
    // Debounce para evitar chamadas excessivas
    configChangeTimeoutRef.current = setTimeout(() => {
      onConfigChange(config);
    }, 100);
    
    return () => {
      if (configChangeTimeoutRef.current) {
        clearTimeout(configChangeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); // Removido onConfigChange das dependências para evitar loop infinito

  // Cleanup do timeout quando componente for desmontado
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Buscar empresas com debounce
  const searchCompanies = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-companies?q=${encodeURIComponent(term)}`);
      
      if (!response.ok) {
        throw new Error('Erro na busca de empresas');
      }

      const data = await response.json();
      setSearchResults(data.companies || []);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Função para busca com debounce
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Definir novo timeout
    if (value.length >= 2) {
      const timeout = setTimeout(() => {
        searchCompanies(value);
      }, 300); // 300ms de debounce
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  };

  // Adicionar ativo
  const addAsset = async (company: CompanySearchResult) => {
    if (config.assets.find(a => a.ticker === company.ticker)) {
      return; // Já existe
    }

    setIsAddingAsset(true);
    try {
      // Se não tem ID ainda, gerar um temporário
      if (!config.id) {
        config.id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Usar o endpoint do backend para adicionar o ativo
      const isFirstAsset = config.assets.length === 0;
      const requestBody: any = {
        ticker: company.ticker
      };

      // Se é o primeiro ativo, enviar dados da configuração
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

      const response = await fetch(`/api/backtest/configs/${config.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar ativo');
      }

      const { config: updatedConfig } = await response.json();

      // Atualizar config local com os dados do backend (inclui alocações corretas)
      const updatedAssets = updatedConfig.assets.map((asset: any) => ({
        ticker: asset.ticker,
        companyName: company.ticker === asset.ticker ? company.name : asset.ticker,
        allocation: parseFloat(asset.targetAllocation.toString()),
        averageDividendYield: asset.averageDividendYield ? parseFloat(asset.averageDividendYield.toString()) : undefined
      }));

      setConfig(prev => ({
        ...prev,
        id: updatedConfig.id,
        assets: updatedAssets
      }));

      // Inicializar DY inputs para todos os ativos
      const newDYInputs: Record<string, string> = {};
      updatedAssets.forEach((asset: BacktestAsset) => {
        if (asset.averageDividendYield) {
          newDYInputs[asset.ticker] = (asset.averageDividendYield * 100).toFixed(2);
        }
      });
      setDividendYieldInputs(newDYInputs);

      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      console.error('Erro ao adicionar ativo:', error);
      // Em caso de erro, fallback para lógica local
      const newAssets = [...config.assets, {
        ticker: company.ticker,
        companyName: company.name,
        allocation: 0,
        averageDividendYield: undefined
      }];

      const equalAllocation = 1 / newAssets.length;
      newAssets.forEach(asset => {
        asset.allocation = equalAllocation;
      });

      setConfig(prev => ({ ...prev, assets: newAssets }));
      setSearchTerm('');
      setSearchResults([]);
    } finally {
      setIsAddingAsset(false);
    }
  };

  // Remover ativo
  const removeAsset = async (ticker: string) => {
    setIsRemovingAsset(true);
    
    try {
      // Se a config tem ID e está salva, usar o endpoint do backend
      if (config.id && !config.id.startsWith('temp-')) {
        const response = await fetch(`/api/backtest/configs/${config.id}/assets?ticker=${ticker}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao remover ativo');
        }

        const { config: updatedConfig } = await response.json();

        // Atualizar config local com os dados do backend (inclui alocações corretas)
        const updatedAssets = updatedConfig.assets.map((asset: any) => ({
          ticker: asset.ticker,
          companyName: asset.ticker,
          allocation: parseFloat(asset.targetAllocation.toString()),
          averageDividendYield: asset.averageDividendYield ? parseFloat(asset.averageDividendYield.toString()) : undefined
        }));

        setConfig(prev => ({
          ...prev,
          assets: updatedAssets
        }));

        // Remover DY input do ativo removido
        setDividendYieldInputs(prev => {
          const newInputs = { ...prev };
          delete newInputs[ticker];
          return newInputs;
        });

        return;
      }

      // Fallback: lógica local (para configs não salvas ou em caso de erro)
      const newAssets = config.assets.filter(a => a.ticker !== ticker);
      
      if (newAssets.length > 0) {
        // Redistribuir alocações igualmente
        const equalAllocation = 1 / newAssets.length;
        newAssets.forEach(asset => {
          asset.allocation = equalAllocation;
        });
      }

      setConfig(prev => ({ ...prev, assets: newAssets }));
      
      // Remover DY input do ativo removido
      setDividendYieldInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[ticker];
        return newInputs;
      });
    } finally {
      setIsRemovingAsset(false);
    }
  };

  // Atualizar alocação de um ativo
  const updateAllocation = (ticker: string, allocation: number) => {
    const newAssets = config.assets.map(asset => 
      asset.ticker === ticker ? { ...asset, allocation } : asset
    );
    setConfig(prev => ({ ...prev, assets: newAssets }));
  };

  // Atualizar dividend yield médio
  const updateDividendYield = (ticker: string, dividendYieldPercent: number) => {
    const newAssets = config.assets.map(asset => 
      asset.ticker === ticker 
        ? { ...asset, averageDividendYield: dividendYieldPercent / 100 } // Converter de % para decimal
        : asset
    );
    setConfig(prev => ({ ...prev, assets: newAssets }));
  };

  // Redistribuir alocações igualmente (fallback local, o backend faz isso automaticamente ao adicionar/remover)
  const redistributeEqually = () => {
    if (config.assets.length === 0) return;
    
    const equalAllocation = 1 / config.assets.length;
    const newAssets = config.assets.map(asset => ({
      ...asset,
      allocation: equalAllocation
    }));
    
    setConfig(prev => ({ ...prev, assets: newAssets }));
  };

  // Validar configuração
  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    // Permitir config sem ativos (serão adicionados depois)
    // if (config.assets.length === 0) {
    //   newErrors.assets = 'Adicione pelo menos um ativo';
    // }

    if (config.assets.length > 20) {
      newErrors.assets = 'Máximo 20 ativos por carteira';
    }

    // Validar alocações apenas se houver ativos
    if (config.assets.length > 0) {
      const totalAllocation = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
      if (Math.abs(totalAllocation - 1) > 0.01) {
        newErrors.allocation = 'Alocações devem somar 100%';
      }
    }

    if (config.initialCapital < 0) {
      newErrors.initialCapital = 'Capital inicial deve ser positivo';
    }

    if (config.monthlyContribution < 0) {
      newErrors.monthlyContribution = 'Aporte mensal não pode ser negativo';
    }

    if (config.startDate >= config.endDate) {
      newErrors.dates = 'Data de início deve ser anterior à data de fim';
    }

    const monthsDiff = (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsDiff < 12) {
      newErrors.dates = 'Período mínimo de 12 meses';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Executar backtesting
  const handleRunBacktest = () => {
    if (validateConfig()) {
      onRunBacktest(config);
    }
  };

  // Salvar configuração sem executar
  const handleSaveConfig = async () => {
    if (validateConfig() && onSaveConfig) {
      await onSaveConfig(config);
    }
  };

  const totalAllocation = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
  const isValidAllocation = Math.abs(totalAllocation - 1) < 0.01;
  
  const isLoading = isAddingAsset || isRemovingAsset || isSaving || isRunning;

  return (
    <>
      {/* Loading Overlay Fullscreen - Similar ao quick-ranker */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md shadow-2xl">
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <BarChart3 className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {isAddingAsset && 'Adicionando ativo...'}
                  {isRemovingAsset && 'Removendo ativo...'}
                  {isSaving && 'Salvando configuração...'}
                  {isRunning && 'Executando backtest...'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 px-2">
                  {isAddingAsset && 'Calculando alocações proporcionais'}
                  {isRemovingAsset && 'Redistribuindo alocações'}
                  {isSaving && 'Salvando suas configurações'}
                  {isRunning && 'Processando simulação histórica'}
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    <div className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Informações da Simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Simulação</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Carteira Conservadora"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialCapital">Capital Inicial (R$)</Label>
              <Input
                id="initialCapital"
                type="text"
                value={initialCapitalInput}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  setInitialCapitalInput(rawValue);
                  
                  // Sincronizar com config apenas se for um valor válido
                  const numericValue = parseInt(rawValue.replace(/\D/g, '')) || 0;
                  if (numericValue >= 0 && numericValue <= 100000000) {
                    setConfig(prev => ({ ...prev, initialCapital: numericValue }));
                  }
                }}
                onBlur={() => {
                  // Formatar quando sair do campo
                  const numericValue = parseInt(initialCapitalInput.replace(/\D/g, '')) || 0;
                  setInitialCapitalInput(numericValue.toLocaleString('pt-BR'));
                }}
                placeholder="10.000"
                className={errors.initialCapital ? 'border-red-500' : ''}
              />
              {errors.initialCapital && (
                <p className="text-sm text-red-500">{errors.initialCapital}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">
                Aporte Mensal (R$)
                <span className="text-xs text-muted-foreground ml-2">
                  • Use 0 para simular sem aportes
                </span>
              </Label>
              <Input
                id="monthlyContribution"
                type="text"
                value={monthlyContributionInput}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  setMonthlyContributionInput(rawValue);
                  
                  // Sincronizar com config apenas se for um valor válido
                  const numericValue = parseInt(rawValue.replace(/\D/g, '')) || 0;
                  if (numericValue >= 0 && numericValue <= 1000000) {
                    setConfig(prev => ({ ...prev, monthlyContribution: numericValue }));
                  }
                }}
                onBlur={() => {
                  // Formatar quando sair do campo
                  const numericValue = parseInt(monthlyContributionInput.replace(/\D/g, '')) || 0;
                  setMonthlyContributionInput(numericValue.toLocaleString('pt-BR'));
                }}
                placeholder="0"
                className={errors.monthlyContribution ? 'border-red-500' : ''}
              />
              {errors.monthlyContribution && (
                <p className="text-sm text-red-500">{errors.monthlyContribution}</p>
              )}
              {config.monthlyContribution === 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Simulação apenas com capital inicial, sem novos aportes
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              value={config.description}
              onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva sua estratégia de investimento..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Período da Simulação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Período da Simulação
          </CardTitle>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Selecione o mês e ano. A simulação sempre considera o primeiro dia do mês para os preços mensais.
            </p>
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">⚠️ Ajuste Automático de Período</p>
                <p>
                  O período pode ser ajustado automaticamente para o período ótimo onde todos os ativos selecionados 
                  possuem dados históricos disponíveis. Ativos mais recentes (ex: IPOs de 2021) podem limitar o período de análise.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <div className="flex gap-2">
                <Select
                  value={String(config.startDate.getMonth() + 1).padStart(2, '0')}
                  onValueChange={(month) => {
                    const newDate = new Date(config.startDate.getFullYear(), parseInt(month) - 1, 1);
                    setConfig(prev => ({ ...prev, startDate: newDate }));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">Janeiro</SelectItem>
                    <SelectItem value="02">Fevereiro</SelectItem>
                    <SelectItem value="03">Março</SelectItem>
                    <SelectItem value="04">Abril</SelectItem>
                    <SelectItem value="05">Maio</SelectItem>
                    <SelectItem value="06">Junho</SelectItem>
                    <SelectItem value="07">Julho</SelectItem>
                    <SelectItem value="08">Agosto</SelectItem>
                    <SelectItem value="09">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Ano"
                  value={startYearInput}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    setStartYearInput(rawValue);
                    
                    // Sincronizar com config apenas se for um ano válido
                    const year = parseInt(rawValue);
                    if (!isNaN(year) && year >= 2000 && year <= new Date().getFullYear()) {
                      const newDate = new Date(year, config.startDate.getMonth(), 1);
                      setConfig(prev => ({ ...prev, startDate: newDate }));
                    }
                  }}
                  className={`w-24 ${errors.dates ? 'border-red-500' : ''}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Fim</Label>
              <div className="flex gap-2">
                <Select
                  value={String(config.endDate.getMonth() + 1).padStart(2, '0')}
                  onValueChange={(month) => {
                    const newDate = new Date(config.endDate.getFullYear(), parseInt(month) - 1, 1);
                    setConfig(prev => ({ ...prev, endDate: newDate }));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">Janeiro</SelectItem>
                    <SelectItem value="02">Fevereiro</SelectItem>
                    <SelectItem value="03">Março</SelectItem>
                    <SelectItem value="04">Abril</SelectItem>
                    <SelectItem value="05">Maio</SelectItem>
                    <SelectItem value="06">Junho</SelectItem>
                    <SelectItem value="07">Julho</SelectItem>
                    <SelectItem value="08">Agosto</SelectItem>
                    <SelectItem value="09">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Ano"
                  value={endYearInput}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    setEndYearInput(rawValue);
                    
                    // Sincronizar com config apenas se for um ano válido
                    const year = parseInt(rawValue);
                    if (!isNaN(year) && year >= 2000 && year <= new Date().getFullYear()) {
                      const newDate = new Date(year, config.endDate.getMonth(), 1);
                      setConfig(prev => ({ ...prev, endDate: newDate }));
                    }
                  }}
                  className={`w-24 ${errors.dates ? 'border-red-500' : ''}`}
                />
              </div>
            </div>

          </div>
          
          {errors.dates && (
            <p className="text-sm text-red-500">{errors.dates}</p>
          )}
        </CardContent>
      </Card>

      {/* Seleção de Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Ativos da Carteira
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca de Ativos */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Ativo</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Digite o ticker ou nome da empresa..."
                className="pl-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
              )}
            </div>
            
            {/* Resultados da Busca */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((company) => (
                  <div
                    key={company.ticker}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b last:border-b-0"
                    onClick={() => addAsset(company)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{company.ticker}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{company.name}</p>
                      </div>
                      {company.sector && (
                        <Badge variant="outline" className="text-xs">
                          {company.sector}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de Ativos Selecionados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Ativos Selecionados ({config.assets.length})</h4>
              {config.assets.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={redistributeEqually}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Distribuir Igualmente
                </Button>
              )}
            </div>

            {config.assets.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum ativo selecionado
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Use a busca acima para adicionar ativos à sua carteira
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {config.assets.map((asset) => (
                  <div key={asset.ticker} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{asset.ticker}</p>
                        {asset.companyName && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {asset.companyName}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAsset(asset.ticker)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Alocação */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Alocação</Label>
                          <Badge variant="outline" className="font-mono">
                            {(asset.allocation * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <Slider
                          value={[asset.allocation * 100]}
                          onValueChange={(value) => updateAllocation(asset.ticker, value[0] / 100)}
                          max={100}
                          min={0}
                          step={0.1}
                          className="w-full"
                        />
                      </div>

                      {/* Dividend Yield Médio */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">DY Médio (5 anos)</Label>
                          <Badge variant="outline" className="font-mono">
                            {asset.averageDividendYield ? 
                              `${(asset.averageDividendYield * 100).toFixed(2)}%` : 
                              'N/A'
                            }
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={dividendYieldInputs[asset.ticker] || ''}
                            onChange={(e) => {
                              const rawValue = e.target.value;
                              
                              // Atualizar estado local (permite digitação livre)
                              setDividendYieldInputs(prev => ({
                                ...prev,
                                [asset.ticker]: rawValue
                              }));
                              
                              // Sincronizar com config se for um valor válido
                              const value = rawValue.replace(',', '.'); // Converte vírgula para ponto
                              const numericValue = parseFloat(value) || 0;
                              if (numericValue >= 0 && numericValue <= 50) {
                                updateDividendYield(asset.ticker, numericValue);
                              }
                            }}
                            onBlur={() => {
                              // Formatar quando sair do campo
                              const currentValue = dividendYieldInputs[asset.ticker] || '';
                              const value = currentValue.replace(',', '.');
                              const numericValue = parseFloat(value) || 0;
                              const formattedValue = numericValue > 0 ? numericValue.toFixed(2) : '';
                              
                              setDividendYieldInputs(prev => ({
                                ...prev,
                                [asset.ticker]: formattedValue
                              }));
                            }}
                            placeholder="0,00"
                            className="w-20 text-sm"
                          />
                          <span className="text-sm text-gray-500">%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateDividendYield(asset.ticker, 0);
                              setDividendYieldInputs(prev => ({
                                ...prev,
                                [asset.ticker]: ''
                              }));
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                            title="Zerar dividendos"
                          >
                            Zerar
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          <strong>Simulação de dividendos:</strong> Yield médio anual pago em 3 meses (Mar/Ago/Out) com reinvestimento automático. 
                          <strong>Configure 0% para analisar apenas valorização.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Resumo das Alocações */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Alocado:</span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={isValidAllocation ? "default" : "destructive"}
                        className="font-mono"
                      >
                        {(totalAllocation * 100).toFixed(1)}%
                      </Badge>
                      {isValidAllocation ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  {!isValidAllocation && (
                    <p className="text-sm text-red-500 mt-1">
                      As alocações devem somar exatamente 100%
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {errors.assets && (
            <p className="text-sm text-red-500">{errors.assets}</p>
          )}
          {errors.allocation && (
            <p className="text-sm text-red-500">{errors.allocation}</p>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <Card>
        <CardContent className="p-6 space-y-3">
          {/* Botão Salvar Configuração */}
          {onSaveConfig && (
            <Button
              onClick={handleSaveConfig}
              disabled={isSaving || isRunning || (config.assets.length > 0 && !isValidAllocation)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Salvando Configuração...
                </>
              ) : (
                <>
                  <Settings className="w-5 h-5 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>
          )}

          {/* Botão Executar Backtesting */}
          <Button
            onClick={handleRunBacktest}
            disabled={isRunning || isSaving || config.assets.length === 0 || !isValidAllocation}
            className="w-full"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Executando Simulação...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 mr-2" />
                Executar Backtesting
              </>
            )}
          </Button>
          
          {config.assets.length > 0 && isValidAllocation && (
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              Simulação de {config.assets.length} ativo(s) • 
              Período: {((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)).toFixed(0)} meses
              {config.monthlyContribution > 0 ? (
                <> • Aporte: R$ {config.monthlyContribution.toLocaleString()}/mês</>
              ) : (
                <> • Sem aportes mensais</>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
