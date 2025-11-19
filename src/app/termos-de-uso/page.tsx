import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { 
  FileText, 
  Scale, 
  AlertTriangle, 
  Shield, 
  CreditCard, 
  Users, 
  Ban, 
  CheckCircle,
  Clock,
  Mail,
  ArrowRight,
  Building2,
  Gavel,
  UserX,
  RefreshCw,
  DollarSign,
  Lock,
  Eye,
  Zap
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Termos de Uso | Preço Justo AI - Análise Fundamentalista B3",
  description: "Leia os termos de uso do Preço Justo AI. Condições de uso da plataforma de análise fundamentalista de ações da B3, direitos, responsabilidades e políticas de assinatura.",
  keywords: "termos de uso, condições uso, preço justo ai, análise fundamentalista, B3, bovespa, política uso, responsabilidades",
  robots: {
    index: true,
    follow: true,
  }
}

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Scale className="w-4 h-4" />
              Termos de Uso
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Termos e{" "}
              <span className="text-blue-600">Condições</span>{" "}
              de Uso
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Estes termos estabelecem as condições para uso da plataforma Preço Justo AI 
              e os direitos e responsabilidades de usuários e da empresa.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Badge variant="secondary" className="px-3 py-1">
                <FileText className="w-4 h-4 mr-1" />
                Atualizado: Out/2025
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Scale className="w-4 h-4 mr-1" />
                Lei Brasileira
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Shield className="w-4 h-4 mr-1" />
                Transparência Total
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Informações da Empresa */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  Identificação da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Preço Justo AI</h4>
                  <p className="text-muted-foreground">
                    <strong>Razão Social:</strong> Busamar Tecnologia<br/>
                    <strong>Plataforma:</strong> precojusto.ai<br/>
                    <strong>E-mail de contato:</strong> busamar@gmail.com (temporariamente)<br/>
                    <strong>Suporte:</strong> busamar@gmail.com (temporariamente)<br/>
                    <strong>Data de vigência:</strong> 01 de janeiro de 2025<br/>
                    <strong>Última atualização:</strong> 01 de outubro de 2025
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Aceitação dos Termos */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-4">Aceitação dos Termos</h2>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Ao acessar e utilizar a plataforma Preço Justo AI, você concorda integralmente 
                      com estes Termos de Uso. Se você não concorda com qualquer parte destes termos, 
                      não deve utilizar nossos serviços.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong>Importante:</strong> Estes termos constituem um acordo legal vinculativo 
                      entre você e o Preço Justo AI. Recomendamos a leitura completa antes do uso.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Descrição dos Serviços */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Nossos{" "}
                <span className="text-blue-600">Serviços</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                O que oferecemos através da plataforma Preço Justo AI
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    Recursos Gratuitos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Rankings básicos de ações
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Análise fundamentalista limitada
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Comparação básica de ações
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Acesso a dados financeiros básicos
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    Recursos Premium
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      8+ modelos de valuation avançados
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Análise com inteligência artificial
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Backtesting de estratégias
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Comparações ilimitadas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Dashboard personalizado
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg mt-8 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Importante: Não Somos Consultoria Financeira
                    </h3>
                    <p className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
                      O Preço Justo AI é uma <strong>ferramenta de apoio à decisão de investimento</strong>. 
                      Não oferecemos consultoria financeira, recomendações de compra/venda ou garantias 
                      de rentabilidade. Todas as análises são baseadas em dados históricos e modelos 
                      matemáticos que não garantem resultados futuros.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cadastro e Conta de Usuário */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Cadastro e{" "}
                <span className="text-green-600">Conta de Usuário</span>
              </h2>
            </div>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Requisitos para Cadastro</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Ser maior de 18 anos ou ter autorização dos responsáveis
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Fornecer informações verdadeiras e atualizadas
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Manter a confidencialidade das credenciais de acesso
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Aceitar estes Termos de Uso e a Política de Privacidade
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Lock className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Responsabilidades do Usuário</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Manter suas informações de conta atualizadas
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Não compartilhar credenciais de acesso com terceiros
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Notificar imediatamente sobre uso não autorizado da conta
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Usar a plataforma apenas para finalidades legítimas
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <UserX className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Suspensão e Encerramento</h3>
                      <p className="text-muted-foreground mb-4">
                        Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, incluindo:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          Uso indevido da plataforma ou tentativas de fraude
                        </li>
                        <li className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          Compartilhamento não autorizado de credenciais
                        </li>
                        <li className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          Atividades que prejudiquem outros usuários ou a plataforma
                        </li>
                        <li className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          Inadimplência prolongada em assinaturas pagas
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Assinaturas e Pagamentos */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Assinaturas e{" "}
                <span className="text-purple-600">Pagamentos</span>
              </h2>
            </div>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Planos de Assinatura</h3>
                      <p className="text-muted-foreground mb-4">
                        Oferecemos diferentes planos de assinatura com recursos específicos:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <strong>Plano Gratuito:</strong> Acesso limitado aos recursos básicos
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <strong>Plano Premium:</strong> Acesso completo a todos os recursos
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Preços e condições detalhadas disponíveis na página de planos
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Condições de Pagamento</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Pagamentos processados via Stripe (seguro e criptografado)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Cobrança recorrente conforme periodicidade escolhida
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Preços em reais (BRL) incluindo impostos aplicáveis
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Faturas enviadas por e-mail após cada cobrança
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>


              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Cancelamento e Reembolso</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Cancelamento pode ser feito a qualquer momento pelo usuário
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Acesso mantido até o final do período já pago
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Reembolsos conforme política específica e legislação aplicável
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Direito de arrependimento de 7 dias para novos usuários
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Uso Adequado da Plataforma */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Uso{" "}
                <span className="text-red-600">Adequado</span>{" "}
                da Plataforma
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    Uso Permitido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Análise pessoal de investimentos
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Pesquisa e educação financeira
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Comparação de ações da B3
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Uso dos recursos conforme plano contratado
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Compartilhamento de insights pessoais
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-red-600">
                    <Ban className="w-5 h-5" />
                    Uso Proibido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Revenda ou redistribuição de dados
                    </li>
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Uso automatizado (bots, scrapers)
                    </li>
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Tentativas de acesso não autorizado
                    </li>
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Compartilhamento de credenciais de conta
                    </li>
                    <li className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Atividades que sobrecarreguem a plataforma
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg mt-8 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-red-800 dark:text-red-200 mb-2">
                      Consequências do Uso Inadequado
                    </h3>
                    <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                      O uso inadequado da plataforma pode resultar em <strong>suspensão ou encerramento 
                      da conta</strong>, sem direito a reembolso, além de possíveis medidas legais 
                      cabíveis. Monitoramos o uso da plataforma para garantir conformidade com estes termos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Limitações e Disclaimers */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Limitações e{" "}
                <span className="text-orange-600">Disclaimers</span>
              </h2>
            </div>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg bg-orange-50 dark:bg-orange-900/20">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-4 text-orange-800 dark:text-orange-200">
                        ⚠️ Aviso de Risco de Investimento
                      </h3>
                      <div className="space-y-3 text-orange-700 dark:text-orange-300">
                        <p className="leading-relaxed">
                          <strong>Todos os investimentos envolvem riscos.</strong> A rentabilidade passada 
                          não garante resultados futuros. As análises fornecidas são baseadas em dados 
                          históricos e modelos matemáticos que podem não refletir condições futuras do mercado.
                        </p>
                        <p className="leading-relaxed">
                          <strong>Não somos consultores financeiros.</strong> Nossas análises são ferramentas 
                          de apoio à decisão, não recomendações de investimento. Sempre consulte um profissional 
                          qualificado antes de tomar decisões de investimento.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Eye className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Limitações de Responsabilidade</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                          Não garantimos precisão absoluta dos dados de terceiros
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                          Não nos responsabilizamos por decisões de investimento dos usuários
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                          Limitamos nossa responsabilidade ao valor pago pelos serviços
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                          Não garantimos disponibilidade 100% da plataforma
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Fontes de Dados</h3>
                      <p className="text-muted-foreground mb-4">
                        Utilizamos dados de fontes confiáveis, mas não controlamos sua precisão:
                      </p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-purple-500" />
                          BRAPI (dados financeiros e cotações)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-purple-500" />
                          Fundamentus (indicadores fundamentalistas)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-purple-500" />
                          Status Invest (dados complementares)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-purple-500" />
                          Dados podem apresentar atrasos ou inconsistências
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Propriedade Intelectual */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-4">Propriedade Intelectual</h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p className="leading-relaxed">
                        Todo o conteúdo da plataforma Preço Justo AI, incluindo mas não limitado a 
                        textos, gráficos, logos, ícones, imagens, algoritmos, código-fonte e metodologias 
                        de análise, são propriedade exclusiva do Preço Justo AI ou de seus licenciadores.
                      </p>
                      <p className="leading-relaxed">
                        <strong>É proibida a reprodução, distribuição, modificação ou uso comercial</strong> 
                        de qualquer conteúdo da plataforma sem autorização expressa por escrito. 
                        O uso da plataforma não confere ao usuário qualquer direito de propriedade 
                        intelectual sobre o conteúdo.
                      </p>
                      <p className="leading-relaxed">
                        Respeitamos os direitos de propriedade intelectual de terceiros e esperamos 
                        que nossos usuários façam o mesmo. Caso identifique violação de direitos 
                        autorais, entre em contato conosco imediatamente.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Lei Aplicável e Foro */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Gavel className="w-6 h-6 text-blue-600" />
                    Lei Aplicável
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil, 
                    incluindo mas não limitado ao Código de Defesa do Consumidor (Lei 8.078/90), 
                    Lei Geral de Proteção de Dados (Lei 13.709/18) e Marco Civil da Internet (Lei 12.965/14).
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Todas as relações jurídicas decorrentes do uso da plataforma serão interpretadas 
                    conforme a legislação brasileira, independentemente de conflitos com leis de outros países.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-purple-600" />
                    Foro Competente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Para dirimir quaisquer controvérsias decorrentes destes Termos de Uso, 
                    fica eleito o foro da comarca onde o usuário possui domicílio, conforme 
                    estabelecido pelo Código de Defesa do Consumidor.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Buscamos sempre resolver questões através de diálogo direto. Em caso de 
                    necessidade, também aceitamos mediação e arbitragem como métodos alternativos 
                    de resolução de conflitos.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Alterações nos Termos */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Alterações nos Termos</h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. 
                    Alterações significativas serão comunicadas através de e-mail e/ou aviso na plataforma 
                    com antecedência mínima de 30 dias.
                  </p>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    O uso continuado da plataforma após as alterações constitui aceitação dos novos termos. 
                    Caso não concorde com as modificações, você pode cancelar sua conta a qualquer momento.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Última atualização: Outubro 2025
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Versão 1.2
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contato e Suporte */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Dúvidas sobre os Termos?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Nossa equipe de suporte está pronta para esclarecer qualquer questão 
            sobre estes Termos de Uso.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="mailto:busamar@gmail.com" className="flex items-center gap-3">
                <Mail className="w-5 h-5" />
                Falar com Suporte
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-4" asChild>
              <Link href="/contato">Central de Ajuda</Link>
            </Button>
          </div>

          <div className="mt-8 text-sm opacity-75">
            <p>E-mail: busamar@gmail.com | Suporte: busamar@gmail.com</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
