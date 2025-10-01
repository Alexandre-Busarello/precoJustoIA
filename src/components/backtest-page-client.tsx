'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BacktestConfigForm } from '@/components/backtest-config-form';
import { BacktestResults } from '@/components/backtest-results';
import { BacktestHistory } from '@/components/backtest-history';
import { BacktestDataQualityPanel } from '@/components/backtest-data-quality-panel';
import { BacktestWelcomeScreen } from '@/components/backtest-welcome-screen';
import { BacktestConfigHistory } from '@/components/backtest-config-history';
import { BacktestProgressIndicator } from '@/components/backtest-progress-indicator';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Settings, 
  History, 
  BarChart3,
  AlertTriangle,
  Loader2,
  DollarSign
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
  finalCashReserve?: number; // Saldo de caixa final
  totalDividendsReceived?: number; // Total de dividendos recebidos
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

export function BacktestPageClient() {
  const [activeTab, setActiveTab] = useState('configure');
  const [currentConfig, setCurrentConfig] = useState<BacktestConfig | null>(null);
  const [currentResult, setCurrentResult] = useState<BacktestResult | null>(null);
  const [currentTransactions, setCurrentTransactions] = useState<any[]>([]);
  const [dataValidation, setDataValidation] = useState<DataValidation | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Scroll para o topo quando o componente for montado
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Carregar ativos pré-configurados do localStorage
  useEffect(() => {
    const preconfiguredAssets = localStorage.getItem('backtest-preconfigured-assets');
    if (preconfiguredAssets) {
      try {
        const assets = JSON.parse(preconfiguredAssets);
        console.log('📊 Carregando ativos pré-configurados:', assets);
        
        // Processar ativos para o formato esperado
        const processedAssets: BacktestAsset[] = assets.map((asset: any) => ({
          ticker: asset.ticker,
          companyName: asset.companyName,
          allocation: 1 / assets.length // Distribuir igualmente inicialmente
        }));

        // Criar configuração inicial
        const initialConfig: BacktestConfig = {
          name: 'Carteira Personalizada',
          description: 'Carteira criada a partir de ativos selecionados',
          assets: processedAssets,
          startDate: new Date(new Date().getFullYear() - 3, 0, 1), // 3 anos atrás
          endDate: new Date(),
          initialCapital: 10000,
          monthlyContribution: 1000,
          rebalanceFrequency: 'monthly'
        };

        setCurrentConfig(initialConfig);
        setShowWelcome(false); // Pular tela de boas-vindas se há ativos pré-configurados
        
        // Limpar localStorage após usar
        localStorage.removeItem('backtest-preconfigured-assets');
        
      } catch (error) {
        console.error('Erro ao carregar ativos pré-configurados:', error);
        localStorage.removeItem('backtest-preconfigured-assets');
      }
    }
  }, []);

  const handleConfigChange = useCallback((config: BacktestConfig) => {
    setCurrentConfig(prev => {
      // Evitar atualizações desnecessárias se o config for igual
      if (prev && JSON.stringify(prev) === JSON.stringify(config)) {
        return prev;
      }
      
      // IMPORTANTE: Preservar o ID da configuração original se existir
      const updatedConfig = { ...config };
      if (prev && (prev as any).id) {
        (updatedConfig as any).id = (prev as any).id;
        console.log('🔄 handleConfigChange - Preservando ID:', (prev as any).id);
      }
      
      // Verificar se houve mudança real nos dados da configuração
      const prevWithoutId = prev ? { ...prev } : null;
      if (prevWithoutId) delete (prevWithoutId as any).id;
      
      const configWithoutId = { ...config };
      delete (configWithoutId as any).id;
      
      const hasRealChange = !prev || JSON.stringify(prevWithoutId) !== JSON.stringify(configWithoutId);
      
      if (hasRealChange) {
        console.log('🔄 handleConfigChange - Mudança real detectada, limpando resultado');
        // Só limpar resultado se houve mudança real na configuração
        setCurrentResult(null);
      } else {
        console.log('🔄 handleConfigChange - Sem mudança real, mantendo resultado');
      }
      
      return updatedConfig;
    });
    
    setDataValidation(null);
    setShowValidation(false);
  }, []);

  const handleValidateData = async (config: BacktestConfig) => {
    if (!config.assets.length) return;

    try {
      setIsRunning(true);
      
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
        throw new Error(error.error || 'Erro ao validar dados');
      }

      const data = await response.json();
      setDataValidation(data.validation);
      setShowValidation(true);
      
    } catch (error) {
      console.error('Erro na validação:', error);
      alert(error instanceof Error ? error.message : 'Erro ao validar dados');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunBacktest = async (config: BacktestConfig, skipValidation = false) => {
    if (!config.assets.length) return;

    try {
      setIsRunning(true);
      
      // Validar dados primeiro se não foi pulado
      if (!skipValidation) {
        await handleValidateData(config);
        return;
      }

      // Sempre enviar os parâmetros atuais da tela
      const params = {
        assets: config.assets,
        startDate: config.startDate.toISOString(),
        endDate: config.endDate.toISOString(),
        initialCapital: config.initialCapital,
        monthlyContribution: config.monthlyContribution,
        rebalanceFrequency: config.rebalanceFrequency
      };

      // Se há configId, enviar junto com os parâmetros para atualizar a config
      const requestBody = (config as any).id ? {
        configId: (config as any).id,
        params: params
      } : {
        params: params
      };

      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar backtesting');
      }

      const data = await response.json();
      console.log('🔍 BacktestPageClient - Resultado recebido:', data.result);
      console.log('🔍 BacktestPageClient - configId usado:', (config as any).id);
      console.log('🔍 BacktestPageClient - configId retornado:', data.configId);
      setCurrentResult(data.result);
      
      // IMPORTANTE: Atualizar o currentConfig com o configId retornado se não tinha antes
      if (!((config as any).id) && data.configId) {
        console.log('🔄 Atualizando config com novo ID:', data.configId);
        const updatedConfig = { ...config, id: data.configId };
        setCurrentConfig(updatedConfig as BacktestConfig);
      }
      
      // 🎯 MELHORIA UX: Auto-redirect para aba de resultados após sucesso
      setTimeout(() => {
        setActiveTab('results');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 500);
      
      // Extrair transações do monthlyHistory se disponível
      if (data.result.monthlyHistory) {
        const transactions = [];
        for (const monthData of data.result.monthlyHistory) {
          for (const transaction of monthData.transactions) {
            transactions.push({
              ...transaction,
              totalContribution: monthData.totalContribution,
              portfolioValue: monthData.portfolioValue,
              cashBalance: (transaction as any).cashBalance || monthData.cashBalance // Usar saldo progressivo da transação
            });
          }
        }
        setCurrentTransactions(transactions);
        console.log('🔍 Transações extraídas do resultado direto:', transactions.length);
      } else {
        setCurrentTransactions([]);
      }
      
      setActiveTab('results');
      
    } catch (error) {
      console.error('Erro no backtesting:', error);
      alert(error instanceof Error ? error.message : 'Erro ao executar backtesting');
    } finally {
      setIsRunning(false);
    }
  };

  const handleAcceptValidation = () => {
    if (currentConfig) {
      setShowValidation(false);
      handleRunBacktest(currentConfig, true);
    }
  };

  const handleCancelValidation = () => {
    setShowValidation(false);
    setDataValidation(null);
  };

  const handleShowDetails = useCallback((result: any, config: any, transactions?: any[]) => {
    console.log('🔍 handleShowDetails - Transações recebidas:', transactions?.length || 0);
    console.log('📋 Primeira transação:', transactions?.[0] || 'Nenhuma');
    
    setCurrentResult(result);
    setCurrentConfig(config);
    setCurrentTransactions(transactions || []);
    setShowWelcome(false);
    setActiveTab('results');
  }, []);

  // Handlers para a tela de boas-vindas
  const handleCreateNew = useCallback(() => {
    setShowWelcome(false);
    setCurrentConfig(null);
    setCurrentResult(null);
    setCurrentTransactions([]);
    setActiveTab('configure');
  }, []);

  const handleSelectExisting = useCallback(async (configPreview: any) => {
    try {
      console.log('🔍 handleSelectExisting - Config:', configPreview.name, 'hasResults:', configPreview.hasResults);
      
      // Converter preview para formato completo
      const fullConfig: BacktestConfig = {
        name: configPreview.name,
        description: configPreview.description,
        assets: configPreview.assets.map((asset: any) => ({
          ticker: asset.ticker,
          companyName: asset.ticker, // Fallback
          allocation: asset.targetAllocation,
          averageDividendYield: asset.averageDividendYield
        })),
        startDate: new Date(configPreview.startDate),
        endDate: new Date(configPreview.endDate),
        initialCapital: configPreview.initialCapital || 10000,
        monthlyContribution: configPreview.monthlyContribution,
        rebalanceFrequency: configPreview.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly'
      };

      // Adicionar ID da config para permitir updates em vez de criar nova
      (fullConfig as any).id = configPreview.id;

      setCurrentConfig(fullConfig);
      setShowWelcome(false);

      // Se a config tem resultados, mostrar o último resultado e ir para aba de resultados
      if (configPreview.hasResults && configPreview.results && configPreview.results.length > 0) {
        console.log('✅ Config tem resultados, carregando último resultado...');
        // Pegar o primeiro resultado (mais recente, pois está ordenado desc)
        const latestResult = configPreview.results[0];
        
        // Converter para formato esperado pelo componente
        const formattedResult = {
          totalReturn: latestResult.totalReturn,
          annualizedReturn: latestResult.annualizedReturn,
          volatility: latestResult.volatility,
          sharpeRatio: latestResult.sharpeRatio,
          maxDrawdown: latestResult.maxDrawdown,
          positiveMonths: latestResult.positiveMonths,
          negativeMonths: latestResult.negativeMonths,
          totalInvested: latestResult.totalInvested,
          finalValue: latestResult.finalValue,
          finalCashReserve: latestResult.finalCashReserve || 0,
          totalDividendsReceived: latestResult.totalDividendsReceived || 0,
          monthlyReturns: latestResult.monthlyReturns || [],
          assetPerformance: latestResult.assetPerformance || [],
          portfolioEvolution: latestResult.portfolioEvolution || [],
          // Campos opcionais com valores padrão
          dataValidation: null,
          dataQualityIssues: [],
          effectiveStartDate: new Date(configPreview.startDate),
          effectiveEndDate: new Date(configPreview.endDate),
          actualInvestment: latestResult.totalInvested,
          plannedInvestment: latestResult.totalInvested,
          missedContributions: 0,
          missedAmount: 0
        };

        setCurrentResult(formattedResult);
        setCurrentTransactions(configPreview.transactions || []);
        setActiveTab('results');
        console.log('✅ Resultado carregado, indo para aba Results');
      } else {
        console.log('⚠️ Config não tem resultados, indo para aba Configure');
        // Se não tem resultados, ir para configuração
        setCurrentResult(null);
        setCurrentTransactions([]);
        setActiveTab('configure');
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      alert('Erro ao carregar configuração selecionada');
    }
  }, []);

  const handleUseAsBase = useCallback((configPreview: any) => {
    // Converter preview para formato completo (similar ao handleSelectExisting)
    const fullConfig: BacktestConfig = {
      name: `${configPreview.name} (Cópia)`,
      description: configPreview.description,
      assets: configPreview.assets.map((asset: any) => ({
        ticker: asset.ticker,
        companyName: asset.ticker, // Fallback
        allocation: asset.targetAllocation,
        averageDividendYield: asset.averageDividendYield
      })),
      startDate: new Date(configPreview.startDate),
      endDate: new Date(configPreview.endDate),
      initialCapital: configPreview.initialCapital || 10000,
      monthlyContribution: configPreview.monthlyContribution,
      rebalanceFrequency: configPreview.rebalanceFrequency as 'monthly' | 'quarterly' | 'yearly'
    };

    // Não adicionar ID para que seja tratada como nova configuração
    setCurrentConfig(fullConfig);
    setCurrentResult(null);
    setCurrentTransactions([]);
    setShowWelcome(false);
    setActiveTab('configure');
  }, []);

  // Estabilizar initialConfig para evitar re-renders desnecessários
  const stableInitialConfig = useMemo(() => {
    if (!currentConfig) return null;
    
    // Criar uma cópia estável do config PRESERVANDO O ID
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
    
    // Preservar ID se existir
    if ((currentConfig as any).id) {
      stableConfig.id = (currentConfig as any).id;
    }
    
    return stableConfig;
  }, [currentConfig]);

  // Mostrar tela de boas-vindas quando showWelcome é true
  if (showWelcome) {
    return (
      <BacktestWelcomeScreen
        onCreateNew={handleCreateNew}
        onSelectExisting={handleSelectExisting}
        onUseAsBase={handleUseAsBase}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Configuração
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  {currentConfig ? `${currentConfig.assets.length} ativos` : 'Não configurado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Simulação
                </p>
                <p className="text-xs text-green-600 dark:text-green-300">
                  {currentResult ? 'Concluída' : 'Pendente'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Retorno
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-300">
                  {currentResult ? 
                    `${(currentResult.totalReturn * 100).toFixed(1)}%` : 
                    'N/A'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Validação de Dados */}
      {showValidation && dataValidation && (
        <BacktestDataQualityPanel
          validation={dataValidation}
          onAccept={handleAcceptValidation}
          onCancel={handleCancelValidation}
        />
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="configure" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Configurar</span>
              <span className="xs:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" disabled={!currentResult}>
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Resultados</span>
              <span className="xs:hidden">Result</span>
            </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <History className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">
              {currentConfig && (currentConfig as any).id ? 'Histórico da Config' : 'Histórico Geral'}
            </span>
            <span className="sm:hidden">Histórico</span>
          </TabsTrigger>
          </TabsList>
          
          {/* Botão para voltar à tela inicial */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWelcome(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <TrendingUp className="w-4 h-4" />
            Nova Simulação
          </Button>
        </div>

        {/* Configuração */}
        <TabsContent value="configure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário de Configuração */}
            <div className="lg:col-span-2">
              <BacktestConfigForm
                initialConfig={stableInitialConfig}
                onConfigChange={handleConfigChange}
                onRunBacktest={handleRunBacktest}
                isRunning={isRunning}
              />
            </div>

            {/* Painel Lateral de Informações */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Importante
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-800 dark:text-amber-200">
                      <strong>Aviso:</strong> Resultados passados não garantem resultados futuros. 
                      Use o backtesting como ferramenta de análise, não como previsão.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <h4 className="font-semibold">Como funciona:</h4>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Simula aportes mensais regulares no primeiro dia do mês</li>
                      <li>• <strong>Rebalanceamento mensal automático</strong> da carteira</li>
                      <li>• Calcula métricas de risco e retorno</li>
                      <li>• Considera dados históricos reais</li>
                      <li>• <strong>Dividendos:</strong> Simulação com yield médio pago em Mar/Ago/Out</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <h4 className="font-semibold">Simulação de Dividendos:</h4>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Yield médio configurado por ativo</li>
                      <li>• Pagamentos apenas em <strong>Março, Agosto e Outubro</strong></li>
                      <li>• 33,33% do yield anual em cada mês</li>
                      <li>• <strong>Reinvestimento automático:</strong> dividendos compram mais ações</li>
                      <li>• <strong>Para apenas valorização:</strong> configure DY = 0%</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <h4 className="font-semibold">Métricas incluídas:</h4>
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Retorno total e anualizado</li>
                      <li>• Volatilidade e Sharpe Ratio</li>
                      <li>• Drawdown máximo</li>
                      <li>• Consistência mensal</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Status da Simulação - Indicador Visual Melhorado */}
              <BacktestProgressIndicator isRunning={isRunning} />
            </div>
          </div>
        </TabsContent>

        {/* Resultados */}
        <TabsContent value="results">
          {currentResult ? (
            <BacktestResults 
              result={currentResult} 
              config={currentConfig}
              transactions={currentTransactions}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma simulação executada</h3>
                <p className="text-muted-foreground mb-4">
                  Configure sua carteira e execute uma simulação para ver os resultados
                </p>
                <Button onClick={() => setActiveTab('configure')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Ir para Configuração
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="history">
          {(() => {
            const hasConfigId = currentConfig && (currentConfig as any).id;
            console.log('🔍 History Tab - currentConfig:', currentConfig?.name);
            console.log('🔍 History Tab - hasConfigId:', hasConfigId);
            console.log('🔍 History Tab - configId:', (currentConfig as any)?.id);
            
            return hasConfigId ? (
              // Se há uma configuração específica selecionada, mostrar histórico dela
              <BacktestConfigHistory
                configId={(currentConfig as any).id}
                configName={currentConfig.name}
                onShowResult={handleShowDetails}
              />
            ) : (
              // Caso contrário, mostrar histórico geral
              <BacktestHistory 
                onShowDetails={handleShowDetails}
              />
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
