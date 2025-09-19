"use client"

import { useSession } from "next-auth/react"
import { QuickRanker } from "@/components/quick-ranker"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  BarChart3, 
  Target, 
  TrendingUp,
  Shield,
  Zap
} from "lucide-react"
import Link from "next/link"

export default function RankingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-background border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Top Row - Back button and Title */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden xs:inline">Voltar</span>
                </Link>
              </Button>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold truncate">Análise de Rankings</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                    Encontre as melhores oportunidades de investimento
                  </p>
                </div>
              </div>
            </div>
            
            {/* User Status */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
              {isLoggedIn ? (
                <div className="flex items-center gap-2 min-w-0">
                  {isPremium ? (
                    <Badge className="bg-gradient-to-r from-violet-100 to-pink-100 text-violet-700 border-violet-200 text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      <span className="hidden xs:inline">Premium</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      <span className="hidden xs:inline">Gratuito</span>
                    </Badge>
                  )}
                  <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[100px] sm:max-w-none">
                    {session.user?.email?.split('@')[0]}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/register">Registrar</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Info Cards for Non-Users */}
        {!isLoggedIn && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl flex items-center justify-center shrink-0">
                      <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">Crie uma conta para aproveitar ao máximo</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Salve seus rankings, acesse modelos premium e acompanhe seu histórico
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-violet-600 shrink-0 w-full sm:w-auto">
                    <Link href="/register" className="flex items-center justify-center gap-2">
                      <span className="hidden xs:inline">Registrar Gratuitamente</span>
                      <span className="xs:hidden">Registrar</span>
                      <TrendingUp className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Premium Upgrade for Free Users */}
        {isLoggedIn && !isPremium && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 border-violet-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-violet-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">Desbloqueie todo o potencial</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Acesse Dividend Yield, Value Investing, Fórmula Mágica, Fórmula de Gordon e análises com IA
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="bg-gradient-to-r from-violet-600 to-pink-600 shrink-0 w-full sm:w-auto">
                    <Link href="/upgrade" className="flex items-center justify-center gap-2">
                      <span className="hidden xs:inline">Fazer Upgrade</span>
                      <span className="xs:hidden">Upgrade</span>
                      <Shield className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* QuickRanker Component */}
        <QuickRanker />

        {/* Tips Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Fórmula de Graham</h3>
              <p className="text-sm text-muted-foreground">
                Método clássico para encontrar ações subvalorizadas de empresas sólidas. 
                Ideal para investidores conservadores.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Anti-Dividend Trap</h3>
              <p className="text-sm text-muted-foreground">
                Encontra empresas com dividendos sustentáveis, evitando armadilhas 
                de yield inflado. Requer conta premium.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Fórmula de Gordon</h3>
              <p className="text-sm text-muted-foreground">
                Método baseado em dividendos para avaliar empresas com distribuições 
                consistentes. Ideal para renda passiva. Requer conta premium.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/20 dark:to-violet-900/20">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Histórico & Análise</h3>
              <p className="text-sm text-muted-foreground">
                {isLoggedIn 
                  ? "Seus rankings são salvos automaticamente para fácil acesso posterior."
                  : "Crie uma conta para salvar e acessar seu histórico de análises."
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
