'use client';

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
  Clock,
  CheckCircle,
  Lightbulb
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
  onViewList?: () => void;
}

export function BacktestWelcomeScreen({ onCreateNew, onSelectExisting, onUseAsBase, onViewList }: BacktestWelcomeScreenProps) {
  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
          <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white px-4">
            Bem-vindo ao Backtesting
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 px-4">
            Como você gostaria de começar sua simulação?
          </p>
        </div>
      </div>

      {/* Opções Principais */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
        {/* Nova Configuração */}
        <Card className="hover:shadow-lg transition-all duration-200 sm:hover:scale-105 cursor-pointer border-2 hover:border-blue-300">
          <CardContent className="p-6 sm:p-8 text-center space-y-3 sm:space-y-4" onClick={onCreateNew}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
                Nova Configuração
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                Crie uma nova simulação do zero com seus próprios parâmetros
              </p>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Selecione ativos</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Defina período</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Configure estratégia</span>
              </div>
            </div>

            <Button className="w-full" size="lg">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Criar Nova
            </Button>
          </CardContent>
        </Card>

        {/* Minhas Configurações */}
        {onViewList && (
          <Card className="hover:shadow-lg transition-all duration-200 sm:hover:scale-105 cursor-pointer border-2 hover:border-purple-300">
            <CardContent className="p-6 sm:p-8 text-center space-y-3 sm:space-y-4" onClick={onViewList}>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <History className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Minhas Configurações
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                  Visualize e gerencie todas as suas configurações salvas
                </p>
              </div>

              <div className="space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Histórico completo</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Reutilize configurações</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Resultados salvos</span>
                </div>
              </div>

              <Button className="w-full" size="lg" variant="outline">
                <History className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Ver Minhas Configs
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Informações Adicionais */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 sm:p-6">
            <div className="text-center space-y-2 sm:space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <h4 className="font-semibold text-sm sm:text-base text-blue-900 dark:text-blue-100">
                  Dica: Reutilização de Configurações
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
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