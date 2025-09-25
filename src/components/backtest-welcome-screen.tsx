'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  History, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  BarChart3,
  ArrowRight,
  Clock,
  CheckCircle,
  Loader2,
  Copy
} from 'lucide-react';

// Interfaces
interface BacktestConfigPreview {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  assets: Array<{
    ticker: string;
    targetAllocation: number;
    averageDividendYield?: number;
  }>;
  hasResults: boolean;
  results?: Array<{
    id: string;
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
    monthlyReturns: any[];
    assetPerformance: any[];
    portfolioEvolution: any[];
    calculatedAt: string;
  }>;
  transactions?: any[];
  startDate: string;
  endDate: string;
  initialCapital?: number;
  monthlyContribution: number;
  rebalanceFrequency: string;
}

interface BacktestWelcomeScreenProps {
  onCreateNew: () => void;
  onSelectExisting: (config: BacktestConfigPreview) => void;
  onUseAsBase?: (config: BacktestConfigPreview) => void;
}

export function BacktestWelcomeScreen({ onCreateNew, onSelectExisting, onUseAsBase }: BacktestWelcomeScreenProps) {
  const [existingConfigs, setExistingConfigs] = useState<BacktestConfigPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Carregar configurações existentes
  const loadExistingConfigs = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const response = await fetch(`/api/backtest/configs?page=${pageNum}&limit=10`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar configurações');
      }

      const data = await response.json();
      
      // Processar configs para incluir flag hasResults
      const processedConfigs = (data.configs || []).map((config: any) => ({
        ...config,
        hasResults: config.results && config.results.length > 0
      }));
      
      console.log(`📊 Configs carregadas (página ${pageNum}):`, processedConfigs.length);
      
      if (append) {
        setExistingConfigs(prev => [...prev, ...processedConfigs]);
      } else {
        setExistingConfigs(processedConfigs);
        setShowExisting(true);
      }
      
      // Verificar se há mais páginas
      setHasMore(processedConfigs.length === 10);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      if (pageNum === 1) {
        alert('Erro ao carregar configurações existentes');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Função para carregar mais configurações
  const loadMoreConfigs = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadExistingConfigs(page + 1, true);
    }
  }, [loadingMore, hasMore, page]);

  // Scroll infinito
  useEffect(() => {
    if (!showExisting) return;

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Carregar mais quando estiver próximo do final (200px antes do fim)
      if (scrollTop + windowHeight >= documentHeight - 200) {
        loadMoreConfigs();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showExisting, loadMoreConfigs]);

  // Formatação
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getRebalanceFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      case 'yearly': return 'Anual';
      default: return frequency;
    }
  };

  if (showExisting) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Selecionar Configuração Existente
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Escolha uma configuração salva para reutilizar ou executar novamente
            </p>
          </div>
        </div>

        {/* Botão Voltar */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => setShowExisting(false)}
            className="mb-4"
          >
            ← Voltar às opções
          </Button>
        </div>

        {/* Lista de Configurações */}
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-4" />
              <p className="text-gray-500">Carregando configurações...</p>
            </CardContent>
          </Card>
        ) : existingConfigs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma Configuração Salva</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Você ainda não possui configurações de backtest salvas.
              </p>
              <Button onClick={onCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Nova Configuração
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {existingConfigs.map((config) => (
              <Card 
                key={config.id} 
                className="hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {config.name}
                        {config.hasResults && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Com Resultados
                          </Badge>
                        )}
                      </CardTitle>
                      {config.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {config.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(config.createdAt)}
                        </span>
                        <span>{config.assets.length} ativos</span>
                        <span>{getRebalanceFrequencyLabel(config.rebalanceFrequency)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Configuração Resumida */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Período</p>
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {formatDate(config.startDate)} - {formatDate(config.endDate)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Capital Inicial</p>
                      <p className="font-medium text-xs sm:text-sm">{formatCurrency(config.initialCapital || 0)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Aporte Mensal</p>
                      <p className="font-medium text-xs sm:text-sm">{formatCurrency(config.monthlyContribution)}</p>
                    </div>
                  </div>

                  {/* Ativos da Carteira */}
                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Ativos</h4>
                    <div className="flex flex-wrap gap-2">
                      {config.assets.map((asset) => (
                        <Badge key={asset.ticker} variant="outline" className="text-xs">
                          {asset.ticker} ({(asset.targetAllocation * 100).toFixed(1)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t">
                    <Button
                      onClick={() => onSelectExisting(config)}
                      className="flex-1"
                      size="sm"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">
                        {config.hasResults ? 'Abrir Configuração' : 'Continuar Configuração'}
                      </span>
                      <span className="sm:hidden">
                        {config.hasResults ? 'Abrir' : 'Continuar'}
                      </span>
                    </Button>
                    
                    {onUseAsBase && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUseAsBase(config)}
                        title="Usar esta configuração como base para nova simulação"
                        className="sm:flex-none"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Usar como Base</span>
                        <span className="sm:hidden">Copiar</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Indicador de carregamento para mais itens */}
            {loadingMore && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Carregando mais configurações...</p>
                </CardContent>
              </Card>
            )}
            
            {/* Indicador de fim da lista */}
            {!hasMore && existingConfigs.length > 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Todas as configurações foram carregadas</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bem-vindo ao Backtesting
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Como você gostaria de começar sua simulação?
          </p>
        </div>
      </div>

      {/* Opções Principais */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Nova Configuração */}
        <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer border-2 hover:border-blue-300">
          <CardContent className="p-8 text-center space-y-4" onClick={onCreateNew}>
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Plus className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Nova Configuração
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Crie uma nova simulação do zero com seus próprios parâmetros
              </p>
            </div>

            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Selecione ativos</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Defina período</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Configure estratégia</span>
              </div>
            </div>

            <Button className="w-full" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Criar Nova
            </Button>
          </CardContent>
        </Card>

        {/* Configuração Existente */}
        <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer border-2 hover:border-purple-300">
          <CardContent className="p-8 text-center space-y-4" onClick={() => loadExistingConfigs()}>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <History className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Configuração Existente
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Reutilize uma configuração salva ou execute novamente
              </p>
            </div>

            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Economize tempo</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Configurações testadas</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Compare resultados</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" size="lg">
              <History className="w-5 h-5 mr-2" />
              Ver Existentes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Informações Adicionais */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                💡 Dica: Reutilização de Configurações
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Você pode adicionar ativos a configurações existentes através de outras páginas da aplicação. 
                Isso permite construir carteiras gradualmente e testar diferentes combinações.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
