import { Metadata } from 'next'
import { SectorAnalysisClient } from '@/components/sector-analysis-client'
import { getCurrentUser } from '@/lib/user-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzeSectors } from '@/lib/sector-analysis-service'
import { LandingHero } from '@/components/landing/landing-hero'
import { CTASection } from '@/components/landing/cta-section'
import { FAQSection } from '@/components/landing/faq-section'
import { FeatureCard } from '@/components/landing/feature-card'
import { Breadcrumbs } from '@/components/landing/breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { 
  BarChart3, 
  TrendingUp, 
  LineChart, 
  Target,
  Shield,
  Zap,
  FileText,
  Landmark,
  Battery,
  Cpu,
  ShoppingCart,
  Lightbulb,
  Building2,
  Rocket,
  Sparkles
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Análise Setorial de Ações B3 | Compare Setores da Bovespa - Preço Justo AI',
  description: 'Análise setorial completa da B3. Compare as melhores empresas de cada setor: Financeiro, Energia, Tecnologia, Saúde e mais. Descubra quais setores têm as melhores oportunidades na Bovespa com análise fundamentalista por IA.',
  keywords: 'análise setorial B3, setores bovespa, melhores setores para investir, comparação setorial ações, ranking setores B3, análise fundamentalista por setor, serviços financeiros Brasil, energia ações, tecnologia bovespa, saúde Brasil, top ações por setor',
  openGraph: {
    title: 'Análise Setorial B3 | Melhores Empresas por Setor | Preço Justo AI',
    description: 'Compare as melhores empresas de cada setor da B3 com análise fundamentalista por IA. Descubra quais setores oferecem as melhores oportunidades de investimento.',
    type: 'website',
    url: '/analise-setorial',
    images: [
      {
        url: '/og-sector-analysis.png',
        width: 1200,
        height: 630,
        alt: 'Análise Setorial B3'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Análise Setorial B3 | Preço Justo AI',
    description: 'Compare as melhores empresas de cada setor da Bovespa com análise fundamentalista por IA.',
  },
  alternates: {
    canonical: '/analise-setorial',
  },
  robots: {
    index: true,
    follow: true,
  }
}

// Função para buscar dados server-side (chamada direta, sem HTTP)
async function fetchInitialSectorData() {
  try {
    // Setores iniciais (2 setores para carregamento rápido)
    const initialSectors = ['Energia', 'Tecnologia da Informação'];
    
    console.log('📊 [SSR] Carregando setores iniciais:', initialSectors);
    
    // Chamar serviço diretamente (sem HTTP fetch)
    const sectors = await analyzeSectors(initialSectors);
    
    console.log(`✅ [SSR] ${sectors.length} setores carregados com sucesso`);
    
    return { 
      sectors, 
      cached: false 
    };
  } catch (error) {
    console.error('❌ [SSR] Erro ao buscar dados setoriais:', error);
    return { 
      sectors: [], 
      cached: false 
    };
  }
}

export default async function AnaliseSetorialPage() {
  // Verificar se usuário está logado (Server-Side)
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session
  
  // Verificar se usuário é Premium (Server-Side)
  const user = await getCurrentUser();
  const isPremium = user?.isPremium || false;
  
  // Buscar dados iniciais server-side
  const initialData = await fetchInitialSectorData();
  
  // Se usuário está logado, mostrar apenas funcionalidade
  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <Breadcrumbs items={[
            { label: "Ferramentas", href: "/ranking" },
            { label: "Análise Setorial" }
          ]} />
        </div>

        {/* Título simples */}
        <div className="container mx-auto px-4 pt-4 pb-8">
          <h1 className="text-3xl font-bold mb-2">Análise Setorial da B3</h1>
          <p className="text-muted-foreground">Compare as melhores empresas de cada setor da Bovespa em um só lugar</p>
        </div>

        {/* Ferramenta */}
        <section id="analise-tool" className="py-8 bg-white dark:bg-background">
          <div className="container mx-auto max-w-7xl px-4">
            <SectorAnalysisClient 
              initialSectors={initialData.sectors}
              isPremium={isPremium}
            />
          </div>
        </section>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumbs items={[
          { label: "Ferramentas", href: "/ranking" },
          { label: "Análise Setorial" }
        ]} />
      </div>

      {/* Hero Section - Landing Page */}
      <LandingHero
        headline={
          <>
            Análise{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Setorial da B3
            </span>
          </>
        }
        subheadline={
          <>
            Compare as <strong>melhores empresas de cada setor</strong> da Bovespa em um só lugar. 
            Veja quais setores apresentam as <strong>melhores oportunidades</strong> e compare empresas lado a lado.
          </>
        }
        badge={{
          text: "Análise Completa de +25 Setores",
          iconName: "Sparkles"
        }}
        socialProof={[
          { iconName: "Building2", text: "+25 setores analisados" },
          { iconName: "BarChart3", text: "+20 indicadores por empresa" },
          { iconName: "TrendingUp", text: "Dados atualizados" }
        ]}
        primaryCTA={{
          text: "Ver Análise Setorial",
          href: "#analise-tool",
          iconName: "Rocket"
        }}
        secondaryCTA={{
          text: "Como Funciona",
          href: "#como-funciona"
        }}
        showQuickAccess={true}
      />

      {/* Value Proposition */}
      <section id="como-funciona" className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Por que usar{" "}
              <span className="text-blue-600">Análise Setorial?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Diversifique sua carteira inteligentemente comparando as melhores empresas de cada setor da B3.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6 text-white" />}
              title="+25 Setores Analisados"
              description="Analisamos mais de 25 setores diferentes da B3, incluindo Serviços Financeiros, Energia, Tecnologia, Saúde, Consumo e muito mais."
              iconBgClass="bg-blue-600"
            />
            <FeatureCard
              icon={<LineChart className="w-6 h-6 text-white" />}
              title="+20 Indicadores por Empresa"
              description="Avaliamos mais de 20 indicadores financeiros importantes como lucratividade, endividamento, crescimento e dividendos."
              iconBgClass="bg-green-600"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-white" />}
              title="Dados Atualizados"
              description="Informações atualizadas regularmente com base em dados reais da B3, mostrando as empresas com melhor desempenho."
              iconBgClass="bg-purple-600"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Benefícios da{" "}
              <span className="text-blue-600">Diversificação Setorial</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                  <h3 className="text-xl font-bold">Diversificação Inteligente</h3>
                </div>
                <p className="text-muted-foreground">
                  Investir em empresas de diferentes setores ajuda a reduzir riscos. Quando um setor está em baixa, outro pode estar em alta, equilibrando sua carteira.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold">Ciclos do Mercado</h3>
                </div>
                <p className="text-muted-foreground">
                  Cada setor reage diferente às mudanças da economia. Entender isso ajuda você a escolher onde investir em cada momento do mercado.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Target className="w-8 h-8 text-purple-600" />
                  <h3 className="text-xl font-bold">Compare Empresas Similares</h3>
                </div>
                <p className="text-muted-foreground">
                  Veja lado a lado empresas do mesmo setor para identificar quais têm melhor desempenho financeiro, menor endividamento e maior crescimento.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-8 h-8 text-orange-600" />
                  <h3 className="text-xl font-bold">Decisões com Base em Números</h3>
                </div>
                <p className="text-muted-foreground">
                  Analisamos os números reais de cada empresa. Você toma decisões baseadas em dados concretos, não em achismos ou opiniões.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Analysis Tool */}
      <section id="analise-tool" className="py-16 sm:py-20 bg-white dark:bg-background">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Experimente a{" "}
              <span className="text-blue-600">Análise Setorial</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Compare as melhores empresas de cada setor da B3
            </p>
          </div>

          <SectorAnalysisClient 
            initialSectors={initialData.sectors}
            isPremium={isPremium}
          />
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection
        title="Perguntas Frequentes sobre Análise Setorial"
        description="Tire suas dúvidas sobre nossa ferramenta de análise setorial"
        faqs={[
          {
            question: "Quantos setores são analisados?",
            answer: "Analisamos mais de 25 setores diferentes da B3, incluindo Serviços Financeiros, Energia, Tecnologia da Informação, Saúde, Consumo, Materiais Básicos, Utilidade Pública e muito mais.",
            iconName: "Building2"
          },
          {
            question: "Como funciona a comparação entre setores?",
            answer: "Nossa plataforma compara as melhores empresas de cada setor usando mais de 20 indicadores financeiros, incluindo lucratividade, endividamento, crescimento e dividendos. Isso ajuda você a identificar quais setores têm as melhores oportunidades.",
            iconName: "BarChart3"
          },
          {
            question: "A análise setorial é gratuita?",
            answer: "Sim! Você pode ver análises setoriais básicas gratuitamente. Usuários Premium têm acesso a análises mais detalhadas e comparações avançadas entre setores.",
            iconName: "Target"
          },
          {
            question: "Como usar a análise setorial para diversificar?",
            answer: "Uma carteira equilibrada geralmente possui empresas de 5 a 8 setores diferentes. Use nossa análise para identificar as melhores empresas de cada setor e construir uma carteira diversificada baseada em dados reais.",
            iconName: "Shield"
          },
          {
            question: "Os dados são atualizados?",
            answer: "Sim! Nossos dados são atualizados regularmente com base nas informações mais recentes da B3 e dos balanços financeiros das empresas. Trabalhamos para garantir que você sempre tenha acesso aos números mais atuais.",
            iconName: "Zap"
          },
          {
            question: "Posso comparar empresas de setores diferentes?",
            answer: "Sim, mas recomendamos comparar empresas do mesmo setor para análises mais relevantes. Empresas de setores diferentes têm características operacionais distintas, então a comparação é mais útil dentro do mesmo setor.",
            iconName: "TrendingUp"
          }
        ]}
      />

      {/* Final CTA */}
      <CTASection
        title="Pronto para Diversificar sua Carteira?"
        description="Use nossa análise setorial gratuita e descubra as melhores empresas de cada setor da B3."
        primaryCTA={{
          text: "Ver Análise Setorial",
          href: "#analise-tool",
          iconName: "Rocket"
        }}
        secondaryCTA={{
          text: "Ver Rankings de Ações",
          href: "/ranking"
        }}
        variant="gradient"
        benefits={[
          "100% Gratuito",
          "+25 setores analisados",
          "Dados atualizados",
          "Sem cadastro necessário"
        ]}
      />

    </div>
  )
}

