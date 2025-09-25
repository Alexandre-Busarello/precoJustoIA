'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BacktestConfigForm } from '@/components/backtest-config-form';
import { BacktestResults } from '@/components/backtest-results';
import { BacktestHistory } from '@/components/backtest-history';
import { BacktestDataQualityPanel } from '@/components/backtest-data-quality-panel';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Settings, 
  History, 
  BarChart3,
  AlertTriangle,
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
      return config;
    });
    setCurrentResult(null);
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

      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            assets: config.assets,
            startDate: config.startDate.toISOString(),
            endDate: config.endDate.toISOString(),
            initialCapital: config.initialCapital,
            monthlyContribution: config.monthlyContribution,
            rebalanceFrequency: config.rebalanceFrequency
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar backtesting');
      }

      const data = await response.json();
      console.log('🔍 BacktestPageClient - Resultado recebido:', data.result);
      console.log('🔍 BacktestPageClient - finalCashReserve:', data.result.finalCashReserve);
      console.log('🔍 BacktestPageClient - totalDividendsReceived:', data.result.totalDividendsReceived);
      setCurrentResult(data.result);
      
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
    setActiveTab('results');
  }, []);

  // Estabilizar initialConfig para evitar re-renders desnecessários
  const stableInitialConfig = useMemo(() => {
    if (!currentConfig) return null;
    
    // Criar uma cópia estável do config
    return {
      name: currentConfig.name,
      description: currentConfig.description,
      assets: [...currentConfig.assets],
      startDate: new Date(currentConfig.startDate),
      endDate: new Date(currentConfig.endDate),
      initialCapital: currentConfig.initialCapital,
      monthlyContribution: currentConfig.monthlyContribution,
      rebalanceFrequency: currentConfig.rebalanceFrequency
    };
  }, [currentConfig]);

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configure" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurar
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" disabled={!currentResult}>
            <BarChart3 className="w-4 h-4" />
            Resultados
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

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
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-amber-800 dark:text-amber-200">
                      <strong>⚠️ Aviso:</strong> Resultados passados não garantem resultados futuros. 
                      Use o backtesting como ferramenta de análise, não como previsão.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">📋 Como funciona:</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Simula aportes mensais regulares</li>
                      <li>• Rebalanceia automaticamente a carteira</li>
                      <li>• Calcula métricas de risco e retorno</li>
                      <li>• Considera dados históricos reais</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">📊 Métricas incluídas:</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>• Retorno total e anualizado</li>
                      <li>• Volatilidade e Sharpe Ratio</li>
                      <li>• Drawdown máximo</li>
                      <li>• Consistência mensal</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Status da Simulação */}
              {isRunning && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-800 dark:text-blue-200">
                          Processando...
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          Analisando dados históricos e executando simulação
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
          <BacktestHistory onShowDetails={handleShowDetails} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
