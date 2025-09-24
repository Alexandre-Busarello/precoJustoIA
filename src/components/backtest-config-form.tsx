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
  Loader2
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
  isRunning: boolean;
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
  isRunning 
}: BacktestConfigFormProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    name: 'Nova Simulação',
    description: '',
    assets: [],
    startDate: new Date(new Date().getFullYear() - 3, 0, 1), // 3 anos atrás
    endDate: new Date(),
    initialCapital: 10000,
    monthlyContribution: 1000,
    rebalanceFrequency: 'monthly'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const initialConfigRef = useRef<string>('');
  const isInitialLoad = useRef(true);
  const configChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar configuração inicial apenas uma vez
  useEffect(() => {
    if (initialConfig) {
      const configString = JSON.stringify(initialConfig);
      if (configString !== initialConfigRef.current) {
        console.log('🔄 Carregando nova configuração inicial:', initialConfig.name);
        initialConfigRef.current = configString;
        setConfig(initialConfig);
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

    // Buscar dividend yield médio dos últimos 5 anos
    let averageDividendYield: number | undefined;
    try {
      const response = await fetch(`/api/dividend-yield-average/${company.ticker}`);
      if (response.ok) {
        const data = await response.json();
        averageDividendYield = data.averageDividendYield;
      }
    } catch (error) {
      console.error(`Erro ao buscar DY médio para ${company.ticker}:`, error);
    }

    const newAssets = [...config.assets, {
      ticker: company.ticker,
      companyName: company.name,
      allocation: 0,
      averageDividendYield
    }];

    // Redistribuir alocações igualmente
    const equalAllocation = 1 / newAssets.length;
    newAssets.forEach(asset => {
      asset.allocation = equalAllocation;
    });

    setConfig(prev => ({ ...prev, assets: newAssets }));
    setSearchTerm('');
    setSearchResults([]);
  };

  // Remover ativo
  const removeAsset = (ticker: string) => {
    const newAssets = config.assets.filter(a => a.ticker !== ticker);
    
    if (newAssets.length > 0) {
      // Redistribuir alocações igualmente
      const equalAllocation = 1 / newAssets.length;
      newAssets.forEach(asset => {
        asset.allocation = equalAllocation;
      });
    }

    setConfig(prev => ({ ...prev, assets: newAssets }));
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

  // Redistribuir alocações igualmente
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

    if (config.assets.length === 0) {
      newErrors.assets = 'Adicione pelo menos um ativo';
    }

    if (config.assets.length > 20) {
      newErrors.assets = 'Máximo 20 ativos por carteira';
    }

    const totalAllocation = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      newErrors.allocation = 'Alocações devem somar 100%';
    }

    if (config.initialCapital <= 0) {
      newErrors.initialCapital = 'Capital inicial deve ser positivo';
    }

    if (config.monthlyContribution <= 0) {
      newErrors.monthlyContribution = 'Aporte mensal deve ser positivo';
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

  const totalAllocation = config.assets.reduce((sum, asset) => sum + asset.allocation, 0);
  const isValidAllocation = Math.abs(totalAllocation - 1) < 0.01;

  return (
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
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  initialCapital: Number(e.target.value) 
                }))}
                placeholder="10000"
                className={errors.initialCapital ? 'border-red-500' : ''}
              />
              {errors.initialCapital && (
                <p className="text-sm text-red-500">{errors.initialCapital}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">Aporte Mensal (R$)</Label>
              <Input
                id="monthlyContribution"
                type="number"
                value={config.monthlyContribution}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  monthlyContribution: Number(e.target.value) 
                }))}
                placeholder="1000"
                className={errors.monthlyContribution ? 'border-red-500' : ''}
              />
              {errors.monthlyContribution && (
                <p className="text-sm text-red-500">{errors.monthlyContribution}</p>
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={config.startDate.toISOString().split('T')[0]}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  startDate: new Date(e.target.value) 
                }))}
                className={errors.dates ? 'border-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={config.endDate.toISOString().split('T')[0]}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  endDate: new Date(e.target.value) 
                }))}
                className={errors.dates ? 'border-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rebalanceFrequency">Rebalanceamento</Label>
              <Select
                value={config.rebalanceFrequency}
                onValueChange={(value) => {
                  if (value === 'monthly' || value === 'quarterly' || value === 'yearly') {
                    setConfig(prev => ({ ...prev, rebalanceFrequency: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
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
                            type="number"
                            value={asset.averageDividendYield ? 
                              (asset.averageDividendYield * 100).toFixed(2) : 
                              ''
                            }
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 50) {
                                updateDividendYield(asset.ticker, value);
                              }
                            }}
                            placeholder="0.00"
                            min="0"
                            max="50"
                            step="0.01"
                            className="w-20 text-sm"
                          />
                          <span className="text-sm text-gray-500">%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateDividendYield(asset.ticker, 0)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                            title="Zerar dividendos"
                          >
                            Zerar
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Dividend yield médio usado para simular pagamentos mensais. 
                          Deixe em 0% para não considerar dividendos.
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

      {/* Botão de Execução */}
      <Card>
        <CardContent className="p-6">
          <Button
            onClick={handleRunBacktest}
            disabled={isRunning || config.assets.length === 0 || !isValidAllocation}
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
            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
              Simulação de {config.assets.length} ativo(s) • 
              Período: {((config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)).toFixed(0)} meses • 
              Aporte: R$ {config.monthlyContribution.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
