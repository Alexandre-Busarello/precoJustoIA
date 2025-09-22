import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  XCircle, 
  ArrowLeft, 
  ArrowRight,
  HelpCircle,
  MessageCircle,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pagamento Cancelado - Preço Justo AI",
  description: "Seu pagamento foi cancelado. Você pode tentar novamente ou entrar em contato conosco se precisar de ajuda.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-white to-gray-50 dark:from-red-950/20 dark:via-background dark:to-background/80">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Ícone de Cancelamento */}
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-red-600">Pagamento Cancelado</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Não se preocupe! Seu pagamento foi cancelado e nenhuma cobrança foi realizada. 
            Você pode tentar novamente quando quiser.
          </p>

          {/* Informações */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 mb-12">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-4">
                O que aconteceu?
              </h3>
              <div className="text-red-800 dark:text-red-200 space-y-2">
                <p>• Você cancelou o processo de pagamento</p>
                <p>• Nenhuma cobrança foi realizada</p>
                <p>• Sua conta permanece no plano gratuito</p>
                <p>• Você pode tentar novamente a qualquer momento</p>
              </div>
            </CardContent>
          </Card>

          {/* Motivos Comuns */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8">
              Precisa de <span className="text-blue-600">Ajuda?</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <HelpCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold mb-2">Dúvidas sobre Pagamento</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Problemas com PIX ou cartão de crédito
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/contato">
                      Falar com Suporte
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-bold mb-2">Dúvidas sobre Planos</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Quer saber mais sobre os recursos Premium
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/planos">
                      Ver Planos
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <RefreshCw className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-bold mb-2">Tentar Novamente</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pronto para assinar o Premium
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/checkout">
                      Tentar Novamente
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Ainda pode usar o gratuito */}
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8 mb-12">
            <h3 className="text-2xl font-bold mb-4">
              🎯 Continue usando o plano gratuito
            </h3>
            <p className="text-muted-foreground mb-6">
              Enquanto isso, você pode continuar usando nossos recursos gratuitos, 
              incluindo a Fórmula de Graham e análise de mais de 350 empresas da B3.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/ranking" className="flex items-center gap-3">
                  Ver Rankings Gratuitos
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              
              <Button variant="outline" size="lg" asChild>
                <Link href="/metodologia">
                  Como Funciona
                </Link>
              </Button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-lg px-8 py-4" asChild>
              <Link href="/planos" className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5" />
                Tentar Novamente
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            
            <Button variant="outline" size="lg" className="text-lg px-8 py-4" asChild>
              <Link href="/" className="flex items-center gap-3">
                <ArrowLeft className="w-5 h-5" />
                Voltar ao Início
              </Link>
            </Button>
          </div>

          {/* Informações de Contato */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Ainda com dúvidas? Estamos aqui para ajudar
            </p>
            <Button variant="ghost" asChild>
              <Link href="/contato" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Falar com Suporte
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
