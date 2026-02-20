import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BacktestPageClient } from '@/components/backtest-page-client'
import { BacktestCTALink } from '@/components/backtest-cta-link'
import { LandingHero } from '@/components/landing/landing-hero'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'
import { FeatureCard } from '@/components/landing/feature-card'
import { Breadcrumbs } from '@/components/landing/breadcrumbs'
import { Footer } from '@/components/footer'
import { Card, CardContent } from '@/components/ui/card'
import {
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  Target,
  Rocket,
  Sparkles,
  Clock,
  DollarSign
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Backtest de Carteira de Ações B3 | Simule Investimentos - Preço Justo AI',
  description: 'Teste suas estratégias de investimento antes de aplicar. Backtest gratuito de carteiras de ações B3 com dados históricos reais. Simule aportes mensais, rebalanceamento e veja resultados detalhados.',
  keywords: 'backtest carteira ações, simular investimentos B3, testar estratégia investimento, backtest histórico ações, simulação carteira ações, backtest gratuito ações, testar carteira antes investir, simular aportes mensais ações',
  openGraph: {
    title: 'Backtest de Carteira B3 | Simule Investimentos | Preço Justo AI',
    description: 'Teste suas estratégias de investimento antes de aplicar. Backtest gratuito de carteiras de ações B3 com dados históricos reais.',
    type: 'website',
    url: '/backtest',
    siteName: 'Preço Justo AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Backtest de Carteira B3 | Preço Justo AI',
    description: 'Teste suas estratégias de investimento antes de aplicar. Backtest gratuito com dados históricos reais.',
  },
  alternates: {
    canonical: '/backtest',
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default async function BacktestPage() {
  // Verificar se usuário está logado (Server-Side)
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session

  // Se usuário está logado, mostrar apenas funcionalidade
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background overflow-x-hidden">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-3 sm:px-4 pt-6">
          <Breadcrumbs items={[
            { label: "Ferramentas", href: "/ranking" },
            { label: "Backtest" }
          ]} />
        </div>

        {/* Título simples */}
        <div className="container mx-auto px-3 sm:px-4 pt-4 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Backtest de Carteira de Ações</h1>
          <p className="text-muted-foreground">Teste suas estratégias de investimento antes de aplicar com dados históricos reais da B3</p>
        </div>

        {/* Ferramenta */}
        <section id="backtest-tool" className="py-8 bg-white dark:bg-background overflow-x-hidden">
          <div className="container mx-auto max-w-7xl px-3 sm:px-4">
            <BacktestPageClient />
          </div>
        </section>
      </div>
    )
  }

  // Landing Page para usuários deslogados
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumbs items={[
          { label: "Ferramentas", href: "/ranking" },
          { label: "Backtest" }
        ]} />
      </div>

      {/* Hero Section - Landing Page */}
      <LandingHero
        headline={
          <>
            Backtest de{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Carteira de Ações B3
            </span>
          </>
        }
        subheadline={
          <>
            Teste suas <strong>estratégias de investimento</strong> antes de aplicar. 
            Simule carteiras com <strong>dados históricos reais</strong> e veja como teriam performado.
          </>
        }
        badge={{
          text: "Simule Investimentos com Dados Reais",
          iconName: "Sparkles"
        }}
        socialProof={[
          { iconName: "TrendingUp", text: "Dados históricos reais" },
          { iconName: "BarChart3", text: "Métricas profissionais" },
          { iconName: "Shield", text: "100% Gratuito" }
        ]}
        primaryCTA={{
          text: "Criar Backtest Gratuito",
          href: "/register",
          iconName: "Rocket"
        }}
        secondaryCTA={{
          text: "Ver Demonstração",
          href: "#backtest-tool"
        }}
        showQuickAccess={true}
      />

      {/* Value Proposition */}
      <section className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Por que fazer{" "}
              <span className="text-blue-600">Backtest?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Evite erros custosos testando suas estratégias antes de investir dinheiro real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Shield className="w-6 h-6 text-white" />}
              title="Evite Erros Custosos"
              description="Teste suas estratégias antes de investir dinheiro real. Veja como sua carteira teria performado no passado e identifique possíveis problemas."
              iconBgClass="bg-blue-600"
            />
            <FeatureCard
              icon={<Target className="w-6 h-6 text-white" />}
              title="Valide Estratégias"
              description="Confirme se sua estratégia funciona antes de aplicá-la. Analise retornos, volatilidade, drawdown e outras métricas importantes."
              iconBgClass="bg-green-600"
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6 text-white" />}
              title="Otimize sua Carteira"
              description="Teste diferentes alocações, frequências de rebalanceamento e aportes mensais para encontrar a melhor configuração."
              iconBgClass="bg-purple-600"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Recursos do{" "}
              <span className="text-blue-600">Backtest</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  <h3 className="text-xl font-bold">Métricas Profissionais</h3>
                </div>
                <p className="text-muted-foreground">
                  Retorno total, retorno anualizado, Sharpe Ratio, volatilidade, drawdown máximo e muito mais. Todas as métricas que profissionais usam.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold">Aportes Mensais</h3>
                </div>
                <p className="text-muted-foreground">
                  Simule aportes mensais regulares e veja como isso impacta seus resultados. Perfeito para quem investe periodicamente.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-purple-600" />
                  <h3 className="text-xl font-bold">Rebalanceamento Automático</h3>
                </div>
                <p className="text-muted-foreground">
                  Configure rebalanceamento mensal, trimestral ou anual. Veja como manter as alocações corretas impacta seus resultados.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <h3 className="text-xl font-bold">Dados Históricos Reais</h3>
                </div>
                <p className="text-muted-foreground">
                  Usamos dados históricos reais da B3 para simular seus investimentos. Preços, dividendos e splits são todos considerados.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Backtest Tool Preview */}
      <section id="backtest-tool" className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Experimente o{" "}
              <span className="text-blue-600">Backtest</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Crie sua conta gratuita e comece a testar suas estratégias agora mesmo
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-8 border border-blue-200 dark:border-blue-800">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-6">
                Para usar o backtest, você precisa criar uma conta gratuita. É rápido e fácil!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Rocket className="w-5 h-5" />
                  Criar Conta Gratuita
                </a>
                <a
                  href="/ranking"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                >
                  Ver Rankings
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection
        title="Perguntas Frequentes sobre Backtest"
        description="Tire suas dúvidas sobre nossa ferramenta de backtest"
        faqs={[
          {
            question: "O que é um backtest?",
            answer: "Um backtest é uma simulação de como uma estratégia de investimento teria performado no passado usando dados históricos reais. Isso permite testar estratégias antes de investir dinheiro real.",
            iconName: "Target"
          },
          {
            question: "O backtest é gratuito?",
            answer: "Sim! Você pode criar e executar backtests gratuitamente após criar uma conta. Não há limites no número de backtests que você pode fazer.",
            iconName: "DollarSign"
          },
          {
            question: "Quais métricas são calculadas?",
            answer: "Calculamos retorno total, retorno anualizado, volatilidade, Sharpe Ratio, drawdown máximo, meses positivos/negativos e muito mais. Todas as métricas profissionais que você precisa.",
            iconName: "BarChart3"
          },
          {
            question: "Posso simular aportes mensais?",
            answer: "Sim! Você pode configurar aportes mensais regulares e ver como isso impacta seus resultados ao longo do tempo. Perfeito para quem investe periodicamente.",
            iconName: "TrendingUp"
          },
          {
            question: "Como funciona o rebalanceamento?",
            answer: "Você pode configurar rebalanceamento mensal, trimestral ou anual. O sistema ajusta automaticamente as alocações para manter os percentuais que você definiu.",
            iconName: "Zap"
          },
          {
            question: "Os dados históricos são precisos?",
            answer: "Sim! Usamos dados históricos reais da B3, incluindo preços de fechamento, dividendos e splits. Trabalhamos para garantir a maior precisão possível.",
            iconName: "Shield"
          }
        ]}
      />

      {/* Final CTA */}
      <CTASection
        title="Pronto para Testar suas Estratégias?"
        description="Crie sua conta gratuita e comece a fazer backtests agora mesmo."
        primaryCTA={{
          text: "Criar Conta Gratuita",
          href: "/register",
          iconName: "Rocket"
        }}
        secondaryCTA={{
          text: "Ver Rankings",
          href: "/ranking"
        }}
        variant="gradient"
        benefits={[
          "100% Gratuito",
          "Dados históricos reais",
          "Métricas profissionais",
          "Sem limites"
        ]}
      />

      <Footer />
    </div>
  )
}
