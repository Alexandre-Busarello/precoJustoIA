import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Mail, 
  MessageCircle, 
  Clock, 
  MapPin,
  Send,
  CheckCircle,
  HelpCircle,
  Users,
  Zap
} from "lucide-react"

export const metadata: Metadata = {
  title: "Contato - Preço Justo AI | Suporte e Atendimento ao Cliente",
  description: "Entre em contato conosco para dúvidas, suporte técnico ou sugestões. Nossa equipe está pronta para ajudar você a aproveitar ao máximo nossa plataforma de análise fundamentalista.",
  keywords: "contato preço justo ai, suporte técnico, atendimento cliente, dúvidas análise fundamentalista, help desk",
}

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <MessageCircle className="w-4 h-4" />
              Suporte e Atendimento
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              Como Podemos{" "}
              <span className="text-blue-600">Ajudar Você?</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Nossa equipe está pronta para esclarecer suas dúvidas, resolver problemas 
              técnicos e ajudar você a aproveitar ao máximo nossa plataforma de 
              análise fundamentalista.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="outline" className="text-green-600 border-green-600 px-4 py-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                Resposta em 24h
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-600 px-4 py-2">
                <Users className="w-4 h-4 mr-2" />
                Equipe Especializada
              </Badge>
              <Badge variant="outline" className="text-purple-600 border-purple-600 px-4 py-2">
                <Zap className="w-4 h-4 mr-2" />
                Suporte Técnico
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Canais de Contato */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Canais de{" "}
              <span className="text-blue-600">Atendimento</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Escolha o canal que preferir para entrar em contato conosco
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Email */}
            <Card className="border-0 shadow-lg text-center hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">E-mail</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Para dúvidas gerais, sugestões ou problemas técnicos. 
                  Respondemos em até 24 horas.
                </p>
                <div className="space-y-2 mb-6">
                  <p className="font-medium">contato@precojusto.ai</p>
                  <p className="text-sm text-muted-foreground">Geral</p>
                </div>
                <div className="space-y-2 mb-6">
                  <p className="font-medium">suporte@precojusto.ai</p>
                  <p className="text-sm text-muted-foreground">Suporte Técnico</p>
                </div>
                <Button className="w-full" asChild>
                  <a href="mailto:contato@precojusto.ai" className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Enviar E-mail
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card className="border-0 shadow-lg text-center hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">WhatsApp</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Atendimento rápido para usuários premium. 
                  Horário comercial: 9h às 18h.
                </p>
                <div className="space-y-2 mb-6">
                  <p className="font-medium">(11) 99999-9999</p>
                  <p className="text-sm text-muted-foreground">Apenas usuários Premium</p>
                </div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Seg-Sex: 9h às 18h</span>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
                  <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Abrir WhatsApp
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* FAQ */}
            <Card className="border-0 shadow-lg text-center hover:shadow-xl transition-all duration-300">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <HelpCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-4">Central de Ajuda</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Encontre respostas rápidas para as perguntas 
                  mais frequentes sobre nossa plataforma.
                </p>
                <div className="space-y-2 mb-6">
                  <p className="font-medium">Base de Conhecimento</p>
                  <p className="text-sm text-muted-foreground">Tutoriais e Guias</p>
                </div>
                <div className="space-y-2 mb-6">
                  <p className="font-medium">FAQ Completo</p>
                  <p className="text-sm text-muted-foreground">Perguntas Frequentes</p>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <a href="#faq" className="flex items-center justify-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    Ver FAQ
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Formulário de Contato */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Envie sua{" "}
                <span className="text-violet-600">Mensagem</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Preencha o formulário abaixo e entraremos em contato em breve
              </p>
            </div>

            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nome" className="block text-sm font-medium mb-2">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        id="nome"
                        name="nome"
                        required
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="assunto" className="block text-sm font-medium mb-2">
                      Assunto *
                    </label>
                    <select
                      id="assunto"
                      name="assunto"
                      required
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o assunto</option>
                      <option value="duvida-geral">Dúvida Geral</option>
                      <option value="suporte-tecnico">Suporte Técnico</option>
                      <option value="sugestao">Sugestão</option>
                      <option value="problema-pagamento">Problema com Pagamento</option>
                      <option value="cancelamento">Cancelamento</option>
                      <option value="parceria">Parceria</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="mensagem" className="block text-sm font-medium mb-2">
                      Mensagem *
                    </label>
                    <textarea
                      id="mensagem"
                      name="mensagem"
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                      placeholder="Descreva sua dúvida, problema ou sugestão em detalhes..."
                    ></textarea>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="aceito-termos"
                      name="aceito-termos"
                      required
                      className="mt-1"
                    />
                    <label htmlFor="aceito-termos" className="text-sm text-muted-foreground">
                      Aceito os{" "}
                      <a href="/termos-uso" className="text-blue-600 hover:underline">
                        Termos de Uso
                      </a>{" "}
                      e{" "}
                      <a href="/politica-privacidade" className="text-blue-600 hover:underline">
                        Política de Privacidade
                      </a>
                      . *
                    </label>
                  </div>

                  <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-4">
                    <Send className="w-5 h-5 mr-3" />
                    Enviar Mensagem
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Rápido */}
      <section id="faq" className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Perguntas{" "}
              <span className="text-blue-600">Frequentes</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Respostas rápidas para as dúvidas mais comuns
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Como faço para cancelar minha assinatura?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Você pode cancelar sua assinatura a qualquer momento através do seu dashboard, 
                  na seção &quot;Minha Conta&quot;. O cancelamento é imediato e você manterá acesso 
                  até o final do período pago.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Os dados são atualizados em tempo real?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Atualizamos preços e indicadores 3 vezes ao dia (9h, 13h e 20h). 
                  Como trabalhamos com análise fundamentalista de longo prazo, 
                  não precisamos de atualizações em tempo real.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Posso usar no celular?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Sim! Nossa plataforma é totalmente responsiva e funciona perfeitamente 
                  em smartphones e tablets. Não há necessidade de baixar nenhum aplicativo.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Vocês oferecem consultoria financeira?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Não oferecemos consultoria financeira. Somos uma ferramenta de análise 
                  que fornece dados e insights para apoiar suas próprias decisões de investimento.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Como funciona o período de teste?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Oferecemos acesso gratuito permanente aos recursos básicos. 
                  Para recursos premium, você pode testar por 7 dias gratuitamente 
                  antes de decidir pela assinatura.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3">Qual a diferença entre os planos?</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  O plano gratuito inclui a Fórmula de Graham. O Premium (R$ 47/mês) adiciona 
                  8 modelos de valuation e análises com inteligência artificial do Google Gemini.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              Não encontrou a resposta que procurava?
            </p>
            <Button size="lg" variant="outline" asChild>
              <a href="mailto:contato@precojusto.ai" className="flex items-center gap-3">
                <Mail className="w-5 h-5" />
                Entre em Contato Conosco
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Informações da Empresa */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Informações da{" "}
                <span className="text-green-600">Empresa</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Localização</h3>
                  <p className="text-muted-foreground text-sm">
                    Blumenau, SC<br />
                    Brasil
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Horário de Atendimento</h3>
                  <p className="text-muted-foreground text-sm">
                    Segunda a Sexta<br />
                    9h às 18h (BRT)
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg text-center">
                <CardContent className="p-8">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Equipe</h3>
                  <p className="text-muted-foreground text-sm">
                    Especialistas em<br />
                    Análise Fundamentalista
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
