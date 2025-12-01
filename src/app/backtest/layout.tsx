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
      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {children}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
