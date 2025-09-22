import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle, 
  ArrowRight,
  Shield,
  Brain,
  BarChart3,
  Trophy
} from "lucide-react"
import Link from "next/link"
import { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PaymentSuccessHandler } from "@/components/payment-success-handler"

export const metadata: Metadata = {
  title: "Pagamento Confirmado - Preço Justo AI | Premium Ativado",
  description: "Seu pagamento foi confirmado e sua conta Premium foi ativada com sucesso. Aproveite todos os recursos exclusivos.",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SuccessPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  // Buscar dados atualizados do usuário
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  })

  if (!user) {
    redirect('/login')
  }

  const isPremium = user.subscriptionTier === 'PREMIUM'

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-blue-50 dark:from-green-950/20 dark:via-background dark:to-blue-950/20">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Ícone de Sucesso */}
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <div className="absolute inset-0 w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full opacity-30 blur-xl mx-auto animate-pulse"></div>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-green-600">Pagamento Confirmado!</span>
            <br />
            <span className="text-foreground">Bem-vindo ao Premium</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            🎉 <strong>Parabéns!</strong> Sua conta Premium foi ativada com sucesso. 
            Agora você tem acesso completo a todos os recursos exclusivos da nossa plataforma.
          </p>

          {/* Status Handler */}
          <PaymentSuccessHandler isPremium={isPremium} />

          {/* Recursos Desbloqueados */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-8">
              Recursos <span className="text-violet-600">Desbloqueados</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Análise com IA</h3>
                  <p className="text-sm text-muted-foreground">
                    Google Gemini AI para análise preditiva
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">8 Modelos</h3>
                  <p className="text-sm text-muted-foreground">
                    Todos os modelos de valuation
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Rankings Ilimitados</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie quantos rankings quiser
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Suporte VIP</h3>
                  <p className="text-sm text-muted-foreground">
                    Atendimento prioritário
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-2xl p-8 mb-12">
            <h3 className="text-2xl font-bold mb-6">
              🚀 Próximos Passos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-bold mb-1">Explore os Rankings</h4>
                  <p className="text-sm text-muted-foreground">
                    Acesse rankings avançados com todos os modelos
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-bold mb-1">Teste a IA</h4>
                  <p className="text-sm text-muted-foreground">
                    Experimente a análise preditiva com IA
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-bold mb-1">Compare Ações</h4>
                  <p className="text-sm text-muted-foreground">
                    Use o comparador ilimitado de ações
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-lg px-8 py-4" asChild>
              <Link href="/dashboard" className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                Acessar Dashboard Premium
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            
            <Button variant="outline" size="lg" className="text-lg px-8 py-4" asChild>
              <Link href="/ranking" className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5" />
                Ver Rankings Avançados
              </Link>
            </Button>
          </div>

          {/* Informações Adicionais */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Precisa de ajuda? Entre em contato conosco
            </p>
            <Button variant="ghost" asChild>
              <Link href="/contato" className="flex items-center gap-2">
                Suporte Premium
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
