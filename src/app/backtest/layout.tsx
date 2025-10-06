import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/user-service';
import { redirect } from 'next/navigation';
import { Footer } from '@/components/footer';
import { BarChart3, Crown, Home } from 'lucide-react';
import Link from 'next/link';

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

export default async function BacktestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Header - Padronizado com outras páginas */}
      <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white px-4 py-8 md:py-12">
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-blue-100 mb-4">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/backtest" className="hover:text-white transition-colors">
              Backtest
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                  <BarChart3 className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold">
                  Backtesting de Carteira
                </h1>
              </div>
              <p className="text-base md:text-lg text-blue-100 max-w-2xl">
                Simule o desempenho histórico de suas estratégias de investimento com rebalanceamento automático
              </p>
            </div>
            
            {/* Badge Premium */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-white font-semibold text-sm shadow-lg flex-shrink-0">
              <Crown className="w-4 h-4" />
              <span>Premium</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
