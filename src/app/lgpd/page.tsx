import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Shield, 
  Lock, 
  Eye, 
  UserCheck, 
  FileText, 
  Mail, 
  Database, 
  Settings,
  CheckCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  Building2,
  Clock,
  Trash2,
  Download
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "LGPD - Lei Geral de Proteção de Dados | Preço Justo AI",
  description: "Conheça como o Preço Justo AI protege seus dados pessoais em conformidade com a LGPD. Transparência total sobre coleta, uso, armazenamento e seus direitos como titular de dados.",
  keywords: "LGPD, lei geral proteção dados, privacidade, dados pessoais, preço justo ai, proteção informações, direitos titular dados",
  robots: {
    index: true,
    follow: true,
  }
}

export default function LGPDPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              LGPD - Lei Geral de Proteção de Dados
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Proteção e{" "}
              <span className="text-blue-600">Privacidade</span>{" "}
              dos Seus Dados
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              O Preço Justo AI está comprometido com a proteção da sua privacidade e 
              o cumprimento integral da Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Badge variant="secondary" className="px-3 py-1">
                <Lock className="w-4 h-4 mr-1" />
                Dados Seguros
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <UserCheck className="w-4 h-4 mr-1" />
                Transparência Total
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Shield className="w-4 h-4 mr-1" />
                Conformidade LGPD
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Informações Gerais */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  Controlador de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Preço Justo AI</h4>
                  <p className="text-muted-foreground">
                    <strong>Responsável:</strong> Busamar Tecnologia<br/>
                    <strong>E-mail para questões de privacidade:</strong> privacidade@precojusto.ai<br/>
                    <strong>Data de vigência:</strong> Esta política está em vigor desde 01 de janeiro de 2025
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Dados Coletados */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Quais Dados{" "}
                <span className="text-blue-600">Coletamos</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Transparência total sobre as informações que processamos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-green-600" />
                    Dados de Identificação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Nome completo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Endereço de e-mail
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Senha (criptografada)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Data de cadastro
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    Dados de Uso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Histórico de navegação na plataforma
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Ações pesquisadas e analisadas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Configurações de preferências
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Dados de sessão e cookies
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-purple-600" />
                    Dados Técnicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Endereço IP (anonimizado)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Tipo de navegador e dispositivo
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Logs de acesso e segurança
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Dados de performance da plataforma
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Dados de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Histórico de assinaturas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Status de pagamento
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Dados de cartão processados pelo Stripe
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Faturas e recibos
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Finalidades do Tratamento */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Como{" "}
                <span className="text-green-600">Utilizamos</span>{" "}
                Seus Dados
              </h2>
              <p className="text-xl text-muted-foreground">
                Finalidades legítimas e transparentes para o tratamento de dados
              </p>
            </div>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Prestação de Serviços</h3>
                      <p className="text-muted-foreground mb-4">
                        Utilizamos seus dados para fornecer análises fundamentalistas, rankings de ações, 
                        comparações e demais funcionalidades da plataforma.
                      </p>
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        Base Legal: Execução de Contrato
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Settings className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Melhoria da Plataforma</h3>
                      <p className="text-muted-foreground mb-4">
                        Analisamos padrões de uso para melhorar a experiência do usuário, 
                        desenvolver novas funcionalidades e otimizar a performance.
                      </p>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Base Legal: Interesse Legítimo
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Comunicação</h3>
                      <p className="text-muted-foreground mb-4">
                        Enviamos comunicações importantes sobre sua conta, atualizações de serviço 
                        e, com seu consentimento, newsletters educativas sobre investimentos.
                      </p>
                      <Badge variant="outline" className="text-purple-600 border-purple-600">
                        Base Legal: Consentimento / Interesse Legítimo
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">Segurança e Conformidade</h3>
                      <p className="text-muted-foreground mb-4">
                        Processamos dados para garantir a segurança da plataforma, prevenir fraudes 
                        e cumprir obrigações legais e regulatórias.
                      </p>
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Base Legal: Obrigação Legal / Interesse Legítimo
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Seus Direitos */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Seus{" "}
                <span className="text-purple-600">Direitos</span>{" "}
                como Titular
              </h2>
              <p className="text-xl text-muted-foreground">
                A LGPD garante diversos direitos sobre seus dados pessoais
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-bold">Acesso</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Confirmar a existência de tratamento e acessar seus dados pessoais.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Settings className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-bold">Correção</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Corrigir dados incompletos, inexatos ou desatualizados.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Trash2 className="w-6 h-6 text-red-600" />
                    <h3 className="text-lg font-bold">Eliminação</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Solicitar a eliminação de dados desnecessários ou tratados em desconformidade.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Download className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-bold">Portabilidade</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Solicitar a portabilidade dos dados a outro fornecedor de serviço.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-6 h-6 text-orange-600" />
                    <h3 className="text-lg font-bold">Oposição</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Opor-se ao tratamento realizado com base no interesse legítimo.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-lg font-bold">Informação</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Obter informações sobre compartilhamento de dados com terceiros.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg mt-8 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-4">Como Exercer Seus Direitos</h3>
                  <p className="text-muted-foreground mb-6">
                    Para exercer qualquer um dos seus direitos, entre em contato conosco através do e-mail:
                  </p>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="mailto:privacidade@precojusto.ai" className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      privacidade@precojusto.ai
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Responderemos sua solicitação em até 15 dias úteis
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Segurança e Retenção */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-green-600" />
                    Medidas de Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Criptografia</h4>
                      <p className="text-sm text-muted-foreground">
                        Todos os dados são criptografados em trânsito (HTTPS/TLS) e em repouso
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Controle de Acesso</h4>
                      <p className="text-sm text-muted-foreground">
                        Acesso restrito aos dados apenas para funcionários autorizados
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Monitoramento</h4>
                      <p className="text-sm text-muted-foreground">
                        Logs de auditoria e monitoramento contínuo de segurança
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Infraestrutura</h4>
                      <p className="text-sm text-muted-foreground">
                        Hospedagem em provedores certificados (Vercel, PlanetScale)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    Retenção de Dados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Dados de Conta</h4>
                      <p className="text-sm text-muted-foreground">
                        Mantidos enquanto a conta estiver ativa + 5 anos após inativação
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Dados de Uso</h4>
                      <p className="text-sm text-muted-foreground">
                        Logs de acesso mantidos por 6 meses, dados analíticos por 2 anos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Dados Financeiros</h4>
                      <p className="text-sm text-muted-foreground">
                        Mantidos por 5 anos conforme legislação fiscal brasileira
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">Exclusão de Conta</h4>
                      <p className="text-sm text-muted-foreground">
                        Dados pessoais excluídos em até 30 dias após solicitação
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Compartilhamento e Terceiros */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Compartilhamento{" "}
                <span className="text-red-600">de Dados</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Transparência sobre quando e com quem compartilhamos informações
              </p>
            </div>

            <Card className="border-0 shadow-lg mb-8">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3 text-red-600">Importante: Não Vendemos Dados</h3>
                    <p className="text-muted-foreground">
                      <strong>Nunca vendemos, alugamos ou comercializamos seus dados pessoais.</strong> 
                      O compartilhamento ocorre apenas nas situações específicas descritas abaixo, 
                      sempre com finalidades legítimas e transparentes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4">Prestadores de Serviço</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-500 mt-1" />
                      <div>
                        <h4 className="font-semibold">Stripe (Pagamentos)</h4>
                        <p className="text-sm text-muted-foreground">
                          Processamento seguro de pagamentos e assinaturas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-green-500 mt-1" />
                      <div>
                        <h4 className="font-semibold">Provedores de E-mail</h4>
                        <p className="text-sm text-muted-foreground">
                          Envio de comunicações transacionais e newsletters
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Database className="w-5 h-5 text-purple-500 mt-1" />
                      <div>
                        <h4 className="font-semibold">Hospedagem</h4>
                        <p className="text-sm text-muted-foreground">
                          Vercel (aplicação) e PlanetScale (banco de dados)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Settings className="w-5 h-5 text-orange-500 mt-1" />
                      <div>
                        <h4 className="font-semibold">Analytics</h4>
                        <p className="text-sm text-muted-foreground">
                          Dados anonimizados para análise de uso da plataforma
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4">Obrigações Legais</h3>
                  <p className="text-muted-foreground mb-4">
                    Podemos compartilhar dados quando exigido por lei, ordem judicial ou autoridade competente:
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Cumprimento de decisões judiciais
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Atendimento a autoridades regulatórias
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Investigações de fraude ou atividades ilegais
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Cookies e Tecnologias */}
      <section className="py-16 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Cookies e{" "}
                <span className="text-indigo-600">Tecnologias</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Como utilizamos cookies e tecnologias similares
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-green-600" />
                    Essenciais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Necessários para o funcionamento básico da plataforma
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Autenticação de usuário</li>
                    <li>• Sessões de login</li>
                    <li>• Configurações de segurança</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-blue-600" />
                    Analíticos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Ajudam a entender como você usa a plataforma
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Páginas mais visitadas</li>
                    <li>• Tempo de permanência</li>
                    <li>• Funcionalidades utilizadas</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-purple-600" />
                    Funcionais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Melhoram sua experiência na plataforma
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Preferências de tema</li>
                    <li>• Configurações salvas</li>
                    <li>• Histórico de pesquisas</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg mt-8 bg-indigo-50 dark:bg-indigo-900/20">
              <CardContent className="p-6">
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-3">Gerenciar Cookies</h3>
                  <p className="text-muted-foreground mb-4">
                    Você pode gerenciar suas preferências de cookies através das configurações do seu navegador. 
                    Note que desabilitar cookies essenciais pode afetar o funcionamento da plataforma.
                  </p>
                  <Button variant="outline" size="sm">
                    Configurações de Cookies
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Alterações na Política */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Alterações nesta Política</h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Esta política pode ser atualizada periodicamente para refletir mudanças em nossas práticas 
                    ou na legislação. Notificaremos sobre alterações significativas através do e-mail cadastrado 
                    e/ou aviso na plataforma.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Última atualização: Janeiro 2025
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Versão 1.0
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Dúvidas sobre Privacidade?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Nossa equipe está pronta para esclarecer qualquer questão sobre 
            o tratamento dos seus dados pessoais.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4" asChild>
              <Link href="mailto:privacidade@precojusto.ai" className="flex items-center gap-3">
                <Mail className="w-5 h-5" />
                Falar com Privacidade
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="border-2 border-white text-white hover:bg-white hover:text-blue-600 text-lg px-8 py-4" asChild>
              <Link href="/contato">Central de Ajuda</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
