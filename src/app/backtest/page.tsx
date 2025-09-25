import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { redirect } from 'next/navigation';
import { BacktestPageClient } from '@/components/backtest-page-client';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Backtesting de Carteira | Preço Justo',
  description: 'Simule o desempenho histórico de carteiras de investimento com rebalanceamento automático e aportes mensais. Análise completa com métricas de risco e retorno.',
  keywords: 'backtesting, carteira de investimentos, simulação histórica, análise de risco, retorno de investimento, rebalanceamento',
  openGraph: {
    title: 'Backtesting de Carteira de Investimentos',
    description: 'Teste estratégias de investimento com dados históricos reais. Métricas avançadas incluindo Sharpe Ratio, drawdown máximo e volatilidade.',
    type: 'website',
  },
};

export default async function BacktestPage() {
  const session = await getServerSession(authOptions);

  // Verificar se usuário está logado
  if (!session?.user?.id) {
    redirect('/login?redirect=/backtest');
  }

  // Verificar se é usuário Premium
  const user = await getCurrentUser();
  
  if (!user?.isPremium) {
    redirect('/dashboard?upgrade=backtest');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                📊 Backtesting de Carteira
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
                Simule o desempenho histórico de suas estratégias de investimento
              </p>
            </div>
            
            {/* Badge Premium */}
            <div className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold text-xs sm:text-sm flex-shrink-0">
              <span className="text-sm sm:text-lg">👑</span>
              <span className="hidden xs:inline">Funcionalidade Premium</span>
              <span className="xs:hidden">Premium</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <BacktestPageClient />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
