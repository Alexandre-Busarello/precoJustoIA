import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { CTASection } from "@/components/landing/cta-section"
import { FeatureCard } from "@/components/landing/feature-card"
import { FAQSection } from "@/components/landing/faq-section"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { 
  Building2, 
  TrendingUp,
  Code,
  Cloud,
  Shield,
  Zap,
  Target,
  Calendar,
  MapPin,
  Linkedin,
  Github,
  Mail,
  CheckCircle,
  Star,
  Rocket,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Fundador & CEO - Especialista em Tecnologia e Análise Fundamentalista | Preço Justo AI",
  description: "Conheça Alexandre Busarello, fundador do Preço Justo AI: Gerente Técnico na Descomplica, especialista em AWS, DevOps e análise fundamentalista. Mais de 15 anos de experiência em tecnologia e mais de 10 anos investindo e fazendo análises quantitativas e qualitativas em mercado financeiro. Líder técnico responsável por plataforma com +70k alunos.",
  keywords: "fundador preço justo ai, alexandre busarello, CEO análise fundamentalista, gerente técnico descomplica, especialista AWS DevOps, fundador plataforma investimentos, quem criou preço justo ai, liderança técnica Brasil",
  openGraph: {
    title: "Fundador & CEO - Especialista em Tecnologia e Investimentos | Preço Justo AI",
    description: "Líder técnico com experiência em grandes plataformas educacionais e especialista em análise fundamentalista de ações. Gerente Técnico na Descomplica.",
    type: "profile",
    url: "https://precojusto.ai/fundador",
    images: [
      {
        url: "/eu.png",
        width: 256,
        height: 256,
        alt: "Alexandre Busarello - Fundador & CEO do Preço Justo AI",
      }
    ],
  },
  twitter: {
    card: "summary",
    title: "Fundador & CEO - Preço Justo AI",
    description: "Gerente Técnico na Descomplica, especialista em AWS, DevOps e análise fundamentalista.",
  },
  alternates: {
    canonical: "/fundador",
  },
  robots: {
    index: true,
    follow: true,
  }
}

export default function FundadorPage() {
  // Schema markup para Person
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Alexandre Busarello",
    "jobTitle": "Fundador & CEO",
    "worksFor": {
      "@type": "Organization",
      "name": "Preço Justo AI"
    },
    "url": "https://precojusto.ai/fundador",
    "sameAs": [
      "https://www.linkedin.com/in/alexandre-busarello-26a6b422/"
    ],
    "image": "https://precojusto.ai/eu.png",
    "description": "Gerente Técnico na Descomplica, especialista em AWS, DevOps e análise fundamentalista. Mais de 15 anos de experiência em tecnologia e mais de 10 anos investindo e fazendo análises quantitativas e qualitativas em mercado financeiro.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Blumenau",
      "addressRegion": "SC",
      "addressCountry": "BR"
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-background dark:via-background dark:to-background">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <Breadcrumbs items={[
            { label: "Sobre", href: "/" },
            { label: "Fundador" }
          ]} />
        </div>

        {/* Hero Section Customizado */}
        <section className="py-12 sm:py-20 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/20 dark:via-background dark:to-violet-950/20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Foto e Info Básica */}
                <div className="text-center lg:text-left">
                  <div className="relative inline-block mb-8">
                    <div className="w-64 h-64 bg-gradient-to-br from-blue-600 to-violet-600 rounded-full p-2 mx-auto lg:mx-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white">
                        <Image
                          src="/eu.png"
                          alt="Alexandre Busarello - Fundador & CEO do Preço Justo AI"
                          width={256}
                          height={256}
                          className="w-full h-full object-cover"
                          priority
                        />
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Verificado
                    </div>
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                    <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                      Fundador & CEO
                    </span>
                  </h1>
                  <p className="text-xl text-muted-foreground mb-6">
                    Gerente Técnico na Descomplica | Especialista em AWS & DevOps
                  </p>
                  
                  <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-8">
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      <MapPin className="w-3 h-3 mr-1" />
                      Blumenau, SC
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <Building2 className="w-3 h-3 mr-1" />
                      Descomplica
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      15+ anos exp.
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      10+ anos mercado financeiro
                    </Badge>
                  </div>

                  <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="https://www.linkedin.com/in/alexandre-busarello-26a6b422/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <Linkedin className="w-4 h-4" />
                        Ver Perfil Completo
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="https://github.com" target="_blank" className="flex items-center gap-2">
                        <Github className="w-4 h-4" />
                        GitHub
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/contato" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Contato
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Resumo Executivo */}
                <div>
                  <Card className="border-0 shadow-xl">
                    <CardContent className="p-8">
                      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <Star className="w-6 h-6 text-yellow-500" />
                        Resumo Executivo
                      </h2>
                      
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Rocket className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">Liderança Técnica</h3>
                            <p className="text-sm text-muted-foreground">
                              Gerente técnico na Descomplica, liderando times de UEE e SRE, 
                              responsável por plataforma com <strong>+70k alunos</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">Otimização de Custos</h3>
                            <p className="text-sm text-muted-foreground">
                              Implementou estratégias que <strong>reduziram 20% dos custos AWS</strong>, 
                              com meta de alcançar 30% de economia.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BarChart3 className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-2">Mercado Financeiro & Análise</h3>
                            <p className="text-sm text-muted-foreground">
                              <strong>Mais de 10 anos investindo</strong> e fazendo análises quantitativas e qualitativas 
                              em mercado financeiro. Combina expertise técnica com experiência prática como investidor 
                              para criar <strong>soluções inovadoras de investimento</strong>.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Experiência Profissional */}
        <section className="py-20 bg-white dark:bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Experiência <span className="text-blue-600">Profissional</span>
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Trajetória sólida em tecnologia, liderando transformações digitais 
                  em empresas de grande escala.
                </p>
              </div>

              <div className="space-y-8">
                {/* Descomplica - Gerente Técnico */}
                <Card className="border-l-4 border-l-blue-600 shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Gerente Técnico Pleno</h3>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">Descomplica</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Mar 2024 - Presente</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            Atual
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Liderando os times de UEE (Vestibulares) e SRE (Site Reliability Engineering), 
                      com foco em modernização de infraestrutura, otimização de custos na AWS e 
                      fortalecimento da cultura DevOps.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Principais Conquistas
                        </h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li>• Plataforma com <strong>+70k alunos ativos</strong></li>
                          <li>• <strong>20% redução de custos AWS</strong></li>
                          <li>• Arquitetura moderna em <strong>EKS</strong></li>
                          <li>• Infraestrutura como código com <strong>Terraform</strong></li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-600" />
                          Tecnologias
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">AWS</Badge>
                          <Badge variant="outline">Kubernetes</Badge>
                          <Badge variant="outline">Terraform</Badge>
                          <Badge variant="outline">Prometheus</Badge>
                          <Badge variant="outline">Grafana</Badge>
                          <Badge variant="outline">DevOps</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Descomplica - Líder Técnico */}
                <Card className="border-l-4 border-l-green-600 shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Líder Técnico</h3>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">Descomplica</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Out 2023 - Mar 2024</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Conduziu a transição de uma plataforma legada para uma nova arquitetura moderna, 
                      desacoplada e escalável, implementando soluções cloud-native com melhores práticas de DevOps.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          Principais Entregas
                        </h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li>• Migração para <strong>arquitetura moderna</strong></li>
                          <li>• Implementação de <strong>microserviços</strong></li>
                          <li>• Monitoramento com <strong>observabilidade</strong></li>
                          <li>• Mentoria e <strong>crescimento do time</strong></li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Code className="w-4 h-4 text-purple-600" />
                          Stack Técnico
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">EKS</Badge>
                          <Badge variant="outline">Microserviços</Badge>
                          <Badge variant="outline">Grafana</Badge>
                          <Badge variant="outline">ElasticSearch</Badge>
                          <Badge variant="outline">Helm</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Descomplica - Engenheiro Sênior */}
                <Card className="border-l-4 border-l-purple-600 shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Engenheiro de Aplicações Sênior</h3>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">Descomplica</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Set 2019 - Out 2023</span>
                          </div>
                          <Badge className="bg-purple-100 text-purple-800">
                            4 anos 2 meses
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Responsável pelo desenvolvimento técnico do produto de Enem/Vestibulares, 
                      envolvido em decisões estratégicas e sendo referência técnica para o time.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-600" />
                          Responsabilidades
                        </h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          <li>• Modelagem com <strong>DDD</strong></li>
                          <li>• Desenvolvimento <strong>Node.js/PostgreSQL</strong></li>
                          <li>• Frontend <strong>React + Microfrontends</strong></li>
                          <li>• <strong>Code reviews</strong> e qualidade</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-blue-600" />
                          DevOps & Cloud
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">Node.js</Badge>
                          <Badge variant="outline">React</Badge>
                          <Badge variant="outline">PostgreSQL</Badge>
                          <Badge variant="outline">Kubernetes</Badge>
                          <Badge variant="outline">Terraform</Badge>
                          <Badge variant="outline">AWS</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* IBM */}
                <Card className="border-l-4 border-l-gray-600 shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Desenvolvedor de Aplicações</h3>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="font-medium">IBM</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Dez 2017 - Ago 2019</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Desenvolvimento de APIs REST em .NET, aplicações AngularJS e soluções mobile com IONIC.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">.NET</Badge>
                      <Badge variant="outline">AngularJS</Badge>
                      <Badge variant="outline">IONIC</Badge>
                      <Badge variant="outline">REST APIs</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Competências Técnicas usando FeatureCard */}
        <section className="py-20 bg-gray-50 dark:bg-background/50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Competências <span className="text-blue-600">Técnicas</span>
                </h2>
                <p className="text-xl text-muted-foreground">
                  Expertise em tecnologias modernas e metodologias ágeis
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard
                  title="Cloud & DevOps"
                  description="Especialista em arquiteturas cloud-native e práticas DevOps modernas"
                  iconName="Cloud"
                  iconBgClass="bg-gradient-to-br from-orange-500 to-orange-600"
                  badge={{ text: "AWS • Kubernetes • Terraform" }}
                />
                <FeatureCard
                  title="Desenvolvimento"
                  description="Full-stack com foco em arquiteturas escaláveis e microserviços"
                  iconName="Code"
                  iconBgClass="bg-gradient-to-br from-blue-500 to-blue-600"
                  badge={{ text: "Node.js • React • TypeScript" }}
                />
                <FeatureCard
                  title="Mercado Financeiro"
                  description="Mais de 10 anos investindo e fazendo análises quantitativas e qualitativas"
                  iconName="TrendingUp"
                  iconBgClass="bg-gradient-to-br from-emerald-500 to-emerald-600"
                  badge={{ text: "Análise Fundamentalista • Valuation • Investimentos" }}
                />
                <FeatureCard
                  title="Liderança"
                  description="Liderança técnica com foco em crescimento de pessoas e resultados"
                  iconName="Users"
                  iconBgClass="bg-gradient-to-br from-green-500 to-green-600"
                  badge={{ text: "Gestão • Mentoria • Agile" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Por que o Preço Justo AI */}
        <section className="py-20 bg-white dark:bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Por que criei o <span className="text-blue-600">Preço Justo AI</span>?
              </h2>
              
              <Card className="border-0 shadow-xl">
                <CardContent className="p-8 lg:p-12">
                  <div className="text-left space-y-6">
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      Após anos liderando transformações tecnológicas em grandes plataformas educacionais, 
                      percebi uma oportunidade única de aplicar minha expertise técnica ao mercado financeiro, 
                      onde <strong>investo e faço análises quantitativas e qualitativas há mais de 10 anos</strong>.
                    </p>
                    
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      <strong>A democratização da análise fundamentalista</strong> sempre foi meu objetivo. 
                      Combinando conhecimento em engenharia de software, cloud computing, inteligência artificial 
                      e minha experiência prática como investidor, desenvolvi uma plataforma que torna acessível 
                      o que antes era privilégio de poucos.
                    </p>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6 border-l-4 border-blue-600">
                      <p className="text-lg font-medium text-blue-900 dark:text-blue-100">
                        &quot;Minha missão é empoderar investidores brasileiros com ferramentas de análise 
                        de nível institucional, usando tecnologia de ponta para democratizar o acesso 
                        a informações de qualidade sobre o mercado de ações. Minha experiência de mais de 10 anos 
                        investindo e analisando empresas me permite criar ferramentas que realmente funcionam na prática.&quot;
                      </p>
                    </div>
                    
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      O Preço Justo AI representa a convergência entre minha paixão por tecnologia, 
                      minha expertise em mercado financeiro e o desejo de contribuir para um mercado 
                      financeiro mais transparente e acessível no Brasil.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <FAQSection
          title="Perguntas Frequentes sobre o Fundador"
          description="Tire suas dúvidas sobre a trajetória e experiência do fundador"
          faqs={[
            {
              question: "Qual a experiência técnica do fundador?",
              answer: "Alexandre Busarello possui mais de 15 anos de experiência em tecnologia, sendo Gerente Técnico na Descomplica, onde lidera times de UEE e SRE responsáveis por uma plataforma com +70k alunos. Especialista em AWS, Kubernetes, Terraform e práticas DevOps modernas.",
              iconName: "Code"
            },
            {
              question: "Por que o fundador criou o Preço Justo AI?",
              answer: "A democratização da análise fundamentalista sempre foi o objetivo. Combinando expertise técnica com mais de 10 anos de experiência prática investindo e fazendo análises quantitativas e qualitativas em mercado financeiro, desenvolveu uma plataforma que torna acessível o que antes era privilégio de poucos, usando tecnologia de ponta para empoderar investidores brasileiros.",
              iconName: "Rocket"
            },
            {
              question: "Onde posso conhecer mais sobre o fundador?",
              answer: "Você pode ver o perfil completo no LinkedIn, onde está documentada toda a trajetória profissional de 15+ anos, incluindo projetos anteriores, certificações e recomendações profissionais.",
              iconName: "Linkedin"
            },
            {
              question: "Quais são as principais conquistas do fundador?",
              answer: "Entre as principais conquistas estão: liderança de plataforma com +70k alunos, redução de 20% nos custos AWS (com meta de 30%), migração para arquitetura moderna em EKS, e implementação de infraestrutura como código com Terraform.",
              iconName: "Award"
            }
          ]}
        />

        {/* CTA Section */}
        <CTASection
          title="Conheça a Plataforma Criada por um Especialista"
          description="Use ferramentas de análise de nível institucional desenvolvidas por quem entende de tecnologia e mercado financeiro."
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
            "+500 Empresas B3"
          ]}
        />

        <Footer />
      </div>
    </>
  )
}
