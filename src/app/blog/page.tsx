import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Footer } from "@/components/footer"
import { LandingHero } from "@/components/landing/landing-hero"
import { CTASection } from "@/components/landing/cta-section"
import { FAQSection } from "@/components/landing/faq-section"
import { FeatureCard } from "@/components/landing/feature-card"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { getAllPosts, getCategoryCounts, getFeaturedPost } from "@/lib/blog-service"
import { BlogClient } from "./blog-client"

export const metadata: Metadata = {
  title: "Blog de Análise Fundamentalista | Artigos sobre Investimentos e Ações B3 - Preço Justo AI",
  description: "Aprenda análise fundamentalista com artigos completos sobre estratégias de investimento, análise de empresas e como usar nossa plataforma para encontrar as melhores oportunidades na B3. Conteúdo especializado para todos os níveis.",
  keywords: "blog análise fundamentalista, artigos investimentos, como investir ações, análise empresas B3, estratégias investimento, educação financeira, aprender investir, guia investimentos Brasil, análise ações passo a passo",
  openGraph: {
    title: "Blog de Análise Fundamentalista | Preço Justo AI",
    description: "Artigos completos sobre estratégias de investimento, análise de empresas e como usar nossa plataforma para encontrar as melhores oportunidades na B3.",
    type: "website",
    url: "https://precojusto.ai/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog de Análise Fundamentalista | Preço Justo AI",
    description: "Aprenda análise fundamentalista com artigos completos sobre investimentos e ações da B3.",
  },
  alternates: {
    canonical: "/blog",
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default async function BlogPage() {
  const session = await getServerSession(authOptions)
  
  // Carregar dados do servidor
  const allPosts = await getAllPosts()
  const categories = await getCategoryCounts()
  const featuredPost = await getFeaturedPost()
  
  const faqs = [
    {
      question: "Com que frequência são publicados novos artigos?",
      answer: "Publicamos novos artigos regularmente, sempre focados em trazer conteúdo de qualidade sobre análise fundamentalista, estratégias de investimento e uso da plataforma. Assine nossa newsletter para ser notificado sobre novos conteúdos.",
      iconName: "Clock"
    },
    {
      question: "Os artigos são adequados para iniciantes?",
      answer: "Sim! Nosso blog é pensado para investidores de todos os níveis. Temos artigos introdutórios sobre conceitos básicos, bem como conteúdos avançados sobre metodologias complexas de valuation e análise técnica.",
      iconName: "Users"
    },
    {
      question: "Posso sugerir temas para artigos?",
      answer: "Sim! Estamos sempre abertos a sugestões de temas. Entre em contato conosco através da página de contato e compartilhe suas ideias. Valorizamos muito o feedback da nossa comunidade.",
      iconName: "Brain"
    },
    {
      question: "Os artigos são gratuitos?",
      answer: "Sim! Todo o conteúdo do blog é 100% gratuito e acessível para todos. Nosso objetivo é democratizar o conhecimento sobre análise fundamentalista e investimentos.",
      iconName: "DollarSign"
    },
    {
      question: "Como posso encontrar artigos sobre um tema específico?",
      answer: "Você pode usar a busca no topo da página ou filtrar por categorias. Temos categorias como 'Análise Fundamentalista', 'Estratégias de Investimento', 'Como Usar a Plataforma' e mais.",
      iconName: "Search"
    },
    {
      question: "Os artigos são baseados em metodologias científicas?",
      answer: "Sim! Todos os nossos artigos são baseados em metodologias consagradas de análise fundamentalista, como Graham, Dividend Yield, Fórmula Mágica de Greenblatt, FCD, Gordon e outras. Sempre citamos fontes e referências acadêmicas quando aplicável.",
      iconName: "Award"
    }
  ]

  // Schema markup para Blog
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Blog Preço Justo AI",
    "description": "Blog educativo sobre análise fundamentalista e investimentos em ações da B3",
    "url": "https://precojusto.ai/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Preço Justo AI",
      "url": "https://precojusto.ai"
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      
      {/* Schema FAQPage para SEO - Apenas para usuários deslogados */}
      {!session && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            })
          }}
        />
      )}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <Breadcrumbs items={[
            { label: "Conteúdo", href: "/" },
            { label: "Blog" }
          ]} />
        </div>

        {/* Hero Section */}
        <LandingHero
          headline={
            <>
              Aprenda{" "}
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Análise Fundamentalista
              </span>
            </>
          }
          subheadline={
            <>
              Artigos completos sobre <strong>estratégias de investimento</strong>, análise de empresas 
              e como usar nossa plataforma para encontrar as <strong>melhores oportunidades na B3</strong>.
            </>
          }
          badge={{
            text: "Blog Educativo",
            iconName: "BookOpen"
          }}
          socialProof={[
            { iconName: "Award", text: "Conteúdo Especializado" },
            { iconName: "Users", text: "Para Todos os Níveis" },
            { iconName: "TrendingUp", text: "Sempre Atualizado" }
          ]}
          primaryCTA={{
            text: "Ver Artigos",
            href: "#artigos",
            iconName: "BookOpen"
          }}
          secondaryCTA={{
            text: "Começar a Analisar",
            href: "/ranking"
          }}
          showQuickAccess={false}
        />

        {/* Por que Ler o Blog */}
        <section className="py-20 bg-white dark:bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Por que Ler Nosso{" "}
                  <span className="text-blue-600">Blog</span>?
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Conteúdo educativo de qualidade para investidores de todos os níveis
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard
                  title="Conteúdo Especializado"
                  description="Artigos escritos por especialistas em análise fundamentalista e mercado financeiro, com base em metodologias consagradas."
                  iconName="Award"
                  iconBgClass="bg-gradient-to-br from-green-500 to-green-600"
                />
                <FeatureCard
                  title="Para Todos os Níveis"
                  description="Desde iniciantes até investidores experientes. Conteúdo didático e progressivo para evoluir seus conhecimentos."
                  iconName="Users"
                  iconBgClass="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <FeatureCard
                  title="Sempre Atualizado"
                  description="Novos artigos regularmente sobre tendências do mercado, análises de empresas e estratégias de investimento."
                  iconName="TrendingUp"
                  iconBgClass="bg-gradient-to-br from-purple-500 to-purple-600"
                />
                <FeatureCard
                  title="Aprenda na Prática"
                  description="Exemplos práticos de como usar nossa plataforma para encontrar oportunidades reais na B3."
                  iconName="Target"
                  iconBgClass="bg-gradient-to-br from-orange-500 to-orange-600"
                />
                <FeatureCard
                  title="Análise com IA"
                  description="Descubra como usar inteligência artificial para análise de ações e tomada de decisões de investimento."
                  iconName="Brain"
                  iconBgClass="bg-gradient-to-br from-violet-500 to-violet-600"
                />
                <FeatureCard
                  title="Metodologias Comprovadas"
                  description="Aprenda sobre Graham, Dividend Yield, Fórmula Mágica e outras metodologias de valuation consagradas."
                  iconName="BarChart3"
                  iconBgClass="bg-gradient-to-br from-indigo-500 to-indigo-600"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Artigos - Client Component */}
        <section id="artigos" className="py-20 bg-gray-50 dark:bg-background/50">
          <div className="container mx-auto px-4">
            <BlogClient 
              allPosts={allPosts}
              categories={categories}
              featuredPost={featuredPost}
            />
          </div>
        </section>

        {/* FAQ Section - Apenas para usuários deslogados */}
        {!session && (
          <FAQSection
            title="Perguntas Frequentes sobre o Blog"
            description="Tire suas dúvidas sobre nosso conteúdo educativo"
            faqs={faqs}
          />
        )}

        {/* CTA Section */}
        <CTASection
          title="Pronto para Aplicar o que Aprendeu?"
          description="Use nossa plataforma para colocar em prática os conhecimentos adquiridos nos artigos e encontrar as melhores oportunidades na B3."
          primaryCTA={{
            text: "Começar a Analisar Ações",
            href: "/ranking",
            iconName: "Rocket"
          }}
          secondaryCTA={{
            text: "Ver Metodologias",
            href: "/metodologia"
          }}
          variant="gradient"
          benefits={[
            "8 Modelos de Valuation",
            "Análise com IA",
            "100% Gratuito para Começar",
            "+350 Empresas B3"
          ]}
        />

        <Footer />
      </div>
    </>
  )
}
