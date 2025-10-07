import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { 
  Building2, 
  Users, 
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
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Fundador & CEO - Especialista em Tecnologia e Análise Fundamentalista | Preço Justo AI",
  description: "Conheça o fundador do Preço Justo AI: Gerente Técnico na Descomplica, especialista em AWS, DevOps e análise fundamentalista. Mais de 15 anos de experiência em tecnologia e mercado financeiro.",
  keywords: "fundador, CEO, tecnologia, AWS, DevOps, análise fundamentalista, Descomplica, engenharia de software, investimentos",
  openGraph: {
    title: "Fundador & CEO - Especialista em Tecnologia e Investimentos",
    description: "Líder técnico com experiência em grandes plataformas educacionais e especialista em análise fundamentalista de ações.",
    type: "profile",
    url: "https://precojusto.ai/fundador",
  },
}

export default function FundadorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      {/* Hero Section */}
      <section className="py-20 sm:py-32">
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
                          <h3 className="font-semibold mb-2">Análise Fundamentalista</h3>
                          <p className="text-sm text-muted-foreground">
                            Combina expertise técnica com conhecimento em mercado financeiro 
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

      {/* Competências e Especialidades */}
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
              {/* Cloud & DevOps */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <Cloud className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Cloud & DevOps</h3>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <Badge variant="outline">AWS</Badge>
                    <Badge variant="outline">Kubernetes</Badge>
                    <Badge variant="outline">Terraform</Badge>
                    <Badge variant="outline">Docker</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Especialista em arquiteturas cloud-native e práticas DevOps modernas
                  </p>
                </CardContent>
              </Card>

              {/* Desenvolvimento */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <Code className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Desenvolvimento</h3>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <Badge variant="outline">Node.js</Badge>
                    <Badge variant="outline">React</Badge>
                    <Badge variant="outline">TypeScript</Badge>
                    <Badge variant="outline">PostgreSQL</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Full-stack com foco em arquiteturas escaláveis e microserviços
                  </p>
                </CardContent>
              </Card>

              {/* Liderança */}
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Liderança</h3>
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <Badge variant="outline">Gestão de Times</Badge>
                    <Badge variant="outline">Mentoria</Badge>
                    <Badge variant="outline">Agile</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Liderança técnica com foco em crescimento de pessoas e resultados
                  </p>
                </CardContent>
              </Card>
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
                    percebi uma oportunidade única de aplicar minha expertise técnica ao mercado financeiro.
                  </p>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    <strong>A democratização da análise fundamentalista</strong> sempre foi meu objetivo. 
                    Combinando conhecimento em engenharia de software, cloud computing e inteligência artificial, 
                    desenvolvi uma plataforma que torna acessível o que antes era privilégio de poucos.
                  </p>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6 border-l-4 border-blue-600">
                    <p className="text-lg font-medium text-blue-900 dark:text-blue-100">
                      &quot;Minha missão é empoderar investidores brasileiros com ferramentas de análise 
                      de nível institucional, usando tecnologia de ponta para democratizar o acesso 
                      a informações de qualidade sobre o mercado de ações.&quot;
                    </p>
                  </div>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    O Preço Justo AI representa a convergência entre minha paixão por tecnologia e 
                    o desejo de contribuir para um mercado financeiro mais transparente e acessível no Brasil.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* LinkedIn CTA */}
            <div className="mt-12">
              <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
                <CardContent className="p-8 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Linkedin className="w-8 h-8 text-blue-600" />
                    <h4 className="text-xl font-bold">Experiência Completa no LinkedIn</h4>
                  </div>
                  <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                    Conheça minha trajetória completa de <strong>15+ anos em tecnologia</strong>, 
                    incluindo projetos anteriores, certificações e recomendações profissionais.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white" asChild>
                      <Link href="https://www.linkedin.com/in/alexandre-busarello-26a6b422/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                        <Linkedin className="w-5 h-5" />
                        Ver Perfil Completo no LinkedIn
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </Button>
                    <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" asChild>
                      <Link href="/contato" className="flex items-center gap-3">
                        <Mail className="w-5 h-5" />
                        Entre em Contato
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
