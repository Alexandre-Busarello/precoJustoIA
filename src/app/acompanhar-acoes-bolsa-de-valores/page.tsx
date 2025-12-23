import { Metadata } from 'next';
import Link from 'next/link';
import { 
  TrendingUp, 
  Bell, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Zap,
  Shield,
  Clock,
  Mail,
  ArrowRight,
  Settings,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/user-service';
import MonitorAssetsForm from '@/components/monitor-assets-form';

export const metadata: Metadata = {
  title: 'Acompanhar Ações da Bolsa de Valores em Tempo Real | Preço Justo AI',
  description: 'Acompanhe ações da bolsa de valores em tempo real com relatórios automáticos de IA. Monitoramento inteligente de variações de preço, mudanças fundamentais e análises mensais. Melhor site para acompanhar ações.',
  keywords: [
    'acompanhar ações',
    'monitorar ações',
    'acompanhar bolsa de valores',
    'acompanhar ações em tempo real',
    'melhor site para acompanhar ações',
    'site para acompanhar ações',
    'acompanhar bolsa de valores em tempo real',
    'monitoramento de ações',
    'alertas de ações',
    'relatórios de ações',
  ].join(', '),
  openGraph: {
    title: 'Acompanhar Ações da Bolsa de Valores em Tempo Real | Preço Justo AI',
    description: 'Acompanhe ações da bolsa de valores em tempo real com relatórios automáticos de IA. Monitoramento inteligente de variações de preço e mudanças fundamentais.',
    type: 'website',
    url: 'https://precojusto.ai/acompanhar-acoes-bolsa-de-valores',
    siteName: 'Preço Justo AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acompanhar Ações da Bolsa de Valores em Tempo Real',
    description: 'Acompanhe ações da bolsa de valores em tempo real com relatórios automáticos de IA.',
  },
  alternates: {
    canonical: 'https://precojusto.ai/acompanhar-acoes-bolsa-de-valores',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function MonitorStocksPage() {
  const currentUser = await getCurrentUser();
  const isLoggedIn = !!currentUser;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4" variant="secondary">
            <Zap className="h-3 w-3 mr-1" />
            Monitoramento Inteligente
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Acompanhe Ações da Bolsa de Valores em Tempo Real
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Receba relatórios automáticos de inteligência artificial sobre variações de preço, 
            mudanças fundamentais e análises mensais das empresas que você monitora.
          </p>
          {!isLoggedIn && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <p className="text-sm text-muted-foreground">
                🔒 Seus dados estão seguros. Não compartilhamos seu email.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Seções de Monitoramento - Logo após Hero */}
      <section className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Monitore Suas Ações - Sempre em foco */}
            <Card className="border-2 shadow-xl order-1">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl sm:text-3xl mb-2">
                  Monitore Suas Ações
                </CardTitle>
                <CardDescription className="text-base">
                  Adicione os tickers das empresas que deseja acompanhar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MonitorAssetsForm isLoggedIn={isLoggedIn} />
              </CardContent>
            </Card>

            {/* Monitoramento Customizado */}
            {isLoggedIn ? (
              <Card className="bg-muted/30 border-muted order-2">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-base sm:text-lg font-semibold text-muted-foreground">
                          Monitoramentos Customizados
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Configure alertas personalizados com critérios específicos.
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
                      <Link href="/dashboard/monitoramentos-customizados/criar">
                        Criar Monitoramento
                        <ArrowRight className="h-3 w-3 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800 order-2">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-xl font-bold">
                          Crie Monitoramentos Customizados
                        </h3>
                      </div>
                      <p className="text-muted-foreground mb-6">
                        Configure alertas personalizados baseados em P/L, P/VP, Score Geral ou Preço. 
                        <strong> Crie uma conta gratuita</strong> para acessar esta funcionalidade avançada.
                      </p>
                    </div>
                    <Button asChild variant="outline" className="w-full border-amber-300 dark:border-amber-700">
                      <Link href="/signup">
                        Criar Conta Grátis
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Tipos de Relatórios */}
      <section className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
            Três Tipos de Relatórios Automáticos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Relatório Mensal */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-lg">Relatório Mensal</CardTitle>
                </div>
                <CardDescription>
                  Análise completa mensal com IA sobre os fundamentos da empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Análise profunda dos indicadores financeiros</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Avaliação de estratégias de investimento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Recomendações baseadas em dados</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Mudança de Score/Fundamento */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-lg">Mudança de Score</CardTitle>
                </div>
                <CardDescription>
                  Alerta automático quando há mudança significativa nos fundamentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Detecção automática de mudanças</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Análise comparativa detalhada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Explicação do impacto no score</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Variação de Preço */}
            <Card className="border-2 hover:shadow-lg transition-shadow border-orange-200 dark:border-orange-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <CardTitle className="text-lg">Variação de Preço</CardTitle>
                </div>
                <CardDescription>
                  Alerta quando há queda significativa de preço com análise de causa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Detecção de quedas de 5% em 1 dia</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Pesquisa automática na internet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Identificação de perda de fundamentos</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
            Por Que Escolher o Preço Justo AI?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Tempo Real</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Acompanhe ações da bolsa de valores em tempo real com atualizações automáticas 
                  e alertas instantâneos sobre mudanças importantes.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Brain className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Inteligência Artificial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Relatórios gerados por IA que analisam não apenas números, mas também pesquisam 
                  na internet para entender o contexto das mudanças.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Dados Confiáveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Análises baseadas em dados financeiros reais e demonstrações contábeis 
                  das empresas listadas na B3.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Alertas Automáticos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receba notificações por email e na plataforma quando houver mudanças significativas 
                  nas empresas que você monitora.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Análises Completas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Acompanhe não apenas o preço, mas também os fundamentos das empresas com análises 
                  mensais e relatórios de mudanças.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Mail className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Sem Spam</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Você recebe apenas relatórios relevantes. Pode cancelar a qualquer momento 
                  com um clique no link de descadastro.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">
            Perguntas Frequentes
          </h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Como funciona o monitoramento de ações?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Você informa os tickers das empresas que deseja acompanhar. Nossa plataforma 
                  monitora automaticamente essas ações e envia relatórios quando detecta mudanças 
                  significativas nos preços ou fundamentos.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quais tipos de relatórios eu recebo?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Você recebe três tipos de relatórios: <strong>Mensal</strong> (análise completa mensal), 
                  <strong> Mudança de Score</strong> (quando há alteração nos fundamentos) e 
                  <strong> Variação de Preço</strong> (quando há queda significativa com análise de causa).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preciso pagar para usar o monitoramento?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  O monitoramento básico é gratuito. Você pode acompanhar ações e receber alertas 
                  sem custo. Para acessar análises detalhadas e monitoramentos customizados, 
                  você pode fazer upgrade para Premium.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Como cancelo os alertas?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Todos os emails incluem um link de descadastro no rodapé. Você pode cancelar 
                  o monitoramento de qualquer empresa com um clique. Se tiver uma conta, pode 
                  gerenciar suas inscrições na página de configurações.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Os dados são atualizados em tempo real?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! Nossa plataforma acompanha ações da bolsa de valores em tempo real. 
                  Os preços são atualizados diariamente e os relatórios são gerados automaticamente 
                  quando detectamos mudanças significativas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      {!isLoggedIn && (
        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto text-center">
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8 sm:p-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                  Comece a Acompanhar Suas Ações Hoje
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Cadastre-se gratuitamente e receba relatórios automáticos de inteligência artificial 
                  sobre as empresas que você monitora.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/signup">
                      Criar Conta Grátis
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <Link href="/planos">
                      Ver Planos Premium
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}

