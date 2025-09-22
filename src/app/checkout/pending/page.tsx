import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Clock, 
  Smartphone, 
  ArrowRight,
  CheckCircle,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pagamento Pendente - Preço Justo AI | Aguardando Confirmação PIX",
  description: "Seu pagamento PIX está sendo processado. Aguarde a confirmação para ativação da conta Premium.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-white to-orange-50 dark:from-yellow-950/20 dark:via-background dark:to-orange-950/20">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Ícone de Pendente */}
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Clock className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-yellow-600">Pagamento Pendente</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            ⏳ Seu pagamento PIX está sendo processado. Assim que confirmarmos o recebimento, 
            sua conta Premium será ativada automaticamente.
          </p>

          {/* Status do Pagamento */}
          <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 mb-12">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    Pagamento PIX Processando
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Aguardando confirmação do MercadoPago
                  </p>
                </div>
              </div>

              <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">📱 O que acontece agora:</h4>
                <div className="space-y-2 text-sm text-left">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Pagamento PIX realizado com sucesso</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span>Aguardando confirmação do banco (até 5 minutos)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Ativação automática da conta Premium</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8">
              ⏰ <span className="text-orange-600">Tempo de Processamento</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Smartphone className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-bold mb-2">PIX Instantâneo</h3>
                  <p className="text-sm text-muted-foreground">
                    Geralmente processado em até 2 minutos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h3 className="font-bold mb-2">Confirmação Bancária</h3>
                  <p className="text-sm text-muted-foreground">
                    Pode levar até 5 minutos em horários de pico
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold mb-2">Ativação Automática</h3>
                  <p className="text-sm text-muted-foreground">
                    Sua conta Premium será ativada instantaneamente
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8 mb-12">
            <h3 className="text-2xl font-bold mb-4">
              🎯 Enquanto aguarda...
            </h3>
            <p className="text-muted-foreground mb-6">
              Você pode continuar navegando pela plataforma. Assim que o pagamento for confirmado, 
              você receberá acesso completo aos recursos Premium.
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
                  Conhecer Metodologia
                </Link>
              </Button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-lg px-8 py-4" asChild>
              <Link href="/dashboard" className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5" />
                Verificar Status da Conta
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            
            <Button variant="outline" size="lg" className="text-lg px-8 py-4" asChild>
              <Link href="/">
                Voltar ao Início
              </Link>
            </Button>
          </div>

          {/* Informações de Contato */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Pagamento não foi confirmado após 10 minutos?
            </p>
            <Button variant="ghost" asChild>
              <Link href="/contato" className="flex items-center gap-2">
                Entre em contato conosco
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
