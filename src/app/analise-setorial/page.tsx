import { Metadata } from 'next'
import { SectorAnalysisClient } from '@/components/sector-analysis-client'
import { getCurrentUser } from '@/lib/user-service'
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
  Lightbulb
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

// Função para buscar dados server-side
async function fetchInitialSectorData(isPremium: boolean) {
  try {
    // Setores gratuitos (3) vs Premium (3 iniciais)
    const freeSectors = ['Energia', 'Tecnologia da Informação'];
    const premiumInitialSectors = ['Energia', 'Tecnologia da Informação'];
    
    const sectorsToFetch = isPremium ? premiumInitialSectors : freeSectors;
    const sectorsQuery = sectorsToFetch.join(',');
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/sector-analysis?sectors=${encodeURIComponent(sectorsQuery)}`, {
      cache: 'no-store' // Sempre buscar dados frescos para SSR
    });
    
    if (!response.ok) {
      console.error('Erro ao buscar dados setoriais');
      return { sectors: [], cached: false };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados setoriais:', error);
    return { sectors: [], cached: false };
  }
}

export default async function AnaliseSetorialPage() {
  // Verificar se usuário é Premium (Server-Side)
  const user = await getCurrentUser();
  const isPremium = user?.isPremium || false;
  
  // Buscar dados iniciais server-side
  const initialData = await fetchInitialSectorData(isPremium);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
      {/* Hero Section - SEO Optimized */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 text-white py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Análise Setorial da B3
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-4 max-w-4xl mx-auto">
              Compare as melhores empresas de cada setor da Bovespa em um só lugar
            </p>
            <p className="text-lg text-blue-200 max-w-3xl mx-auto">
              Veja quais setores apresentam as melhores oportunidades e compare empresas lado a lado
            </p>
          </div>
        </div>
      </section>

      {/* Seção de Conteúdo SEO */}
      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Como funciona a Análise Setorial?
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-slate-700 dark:text-slate-300">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="p-3 bg-blue-100 dark:bg-blue-950/30 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Setores Diversificados
                </h3>
                <p className="text-sm">
                  Analisamos mais de 25 setores diferentes da B3, incluindo Serviços Financeiros, Energia, Tecnologia, Saúde, Consumo e muito mais.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="p-3 bg-green-100 dark:bg-green-950/30 rounded-lg">
                  <LineChart className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Análise Completa
                </h3>
                <p className="text-sm">
                  Avaliamos mais de 20 indicadores financeiros importantes como lucratividade, endividamento, crescimento e dividendos para cada empresa.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="p-3 bg-purple-100 dark:bg-purple-950/30 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Dados Atualizados
                </h3>
                <p className="text-sm">
                  Informações atualizadas regularmente com base em dados reais da B3, mostrando as empresas com melhor desempenho de cada setor.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Componente Client-Side com dados SSR */}
        <SectorAnalysisClient 
          initialSectors={initialData.sectors}
          isPremium={isPremium}
        />
      </section>

      {/* SEO Content Section */}
      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
            Por que analisar empresas por setor?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-600 rounded-lg flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Diversificação Inteligente
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    Investir em empresas de diferentes setores ajuda a reduzir riscos. Quando um setor está em baixa, outro pode estar em alta, equilibrando sua carteira.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-600 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Ciclos do Mercado
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    Cada setor reage diferente às mudanças da economia. Entender isso ajuda você a escolher onde investir em cada momento do mercado.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-600 rounded-lg flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Compare Empresas Similares
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    Veja lado a lado empresas do mesmo setor para identificar quais têm melhor desempenho financeiro, menor endividamento e maior crescimento.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-950/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-600 rounded-lg flex-shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Decisões com Base em Números
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    Analisamos os números reais de cada empresa. Você toma decisões baseadas em dados concretos, não em achismos ou opiniões.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
            Principais Setores da B3
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/30 rounded-lg flex-shrink-0">
                <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Financeiro
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Inclui bancos, seguradoras e empresas de crédito. Setor importante da economia brasileira com empresas tradicionais e sólidas.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded-lg flex-shrink-0">
                <Battery className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Energia
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Empresas de energia elétrica e petróleo. Setor essencial com fluxo de caixa previsível e conhecido por distribuir dividendos.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="p-2 bg-purple-100 dark:bg-purple-950/30 rounded-lg flex-shrink-0">
                <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Tecnologia da Informação
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Empresas de tecnologia e serviços digitais. Setor em crescimento com empresas inovadoras e alto potencial de valorização.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="p-2 bg-orange-100 dark:bg-orange-950/30 rounded-lg flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Consumo
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Varejo, alimentos e bebidas. Empresas que atendem diretamente o consumidor final e refletem a economia do país.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-8 mb-12 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  Dica Importante
                </h2>
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  Uma carteira equilibrada geralmente possui empresas de <strong>5 a 8 setores diferentes</strong>. Isso ajuda a reduzir riscos e aumenta as chances de bons resultados em diferentes momentos da economia.
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  Use nossa análise setorial para descobrir as melhores empresas de cada setor e construir uma carteira diversificada baseada em dados reais.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

