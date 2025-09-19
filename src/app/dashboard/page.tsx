"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RankingHistory } from "@/components/ranking-history"
import CompanySearch from "@/components/company-search"
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  PieChart, 
  Activity,
  Shield,
  ArrowRight
} from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  rankingsToday: number;
  totalRankings: number;
  totalCompanies: number;
  availableModels: number;
  isPremium: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
    }
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const response = await fetch('/api/dashboard-stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const isPremium = session.user?.subscriptionTier === 'PREMIUM'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header com Busca */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              {/* Título e Saudação */}
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold mb-2">
                  Dashboard
                </h1>
                <p className="text-muted-foreground mb-4 lg:mb-0">
                  Bem-vindo de volta, {session.user?.name || session.user?.email?.split('@')[0]}
                </p>
              </div>
              
              {/* Buscador - Desktop: direita, Mobile: abaixo */}
              <div className="lg:flex-shrink-0 lg:max-w-md w-full">
                <div className="lg:text-right">
                  <p className="text-sm text-muted-foreground mb-2 lg:text-right">
                    Buscar empresas
                  </p>
                  <CompanySearch 
                    placeholder="Digite ticker ou nome..."
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Quick Actions - Enhanced */}
            <Card className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 border-0 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-violet-500 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  Ações Rápidas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Comece sua análise ou gerencie seus investimentos
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Novo Ranking - Destacado */}
                  <Link href="/ranking">
                    <Card className="group cursor-pointer border-2 border-dashed border-blue-300 hover:border-blue-500 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                      <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <BarChart3 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600">
                          Novo Ranking
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Analise empresas usando modelos de valuation consagrados
                        </p>
                        <div className="flex items-center justify-center gap-2 text-blue-600 group-hover:text-blue-700">
                          <span className="text-sm font-medium">Começar análise</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Nova Carteira - Em breve */}
                  <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 opacity-75">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <PieChart className="w-8 h-8 text-gray-500" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-gray-600 dark:text-gray-400">
                        Nova Carteira
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Monte e gerencie carteiras de investimento personalizadas
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        Em desenvolvimento
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/50">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {statsLoading ? '-' : stats?.rankingsToday || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Rankings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {statsLoading ? '-' : stats?.availableModels || 1}
                    </div>
                    <div className="text-xs text-muted-foreground">Modelos disponíveis</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-violet-600">
                      {statsLoading ? '-' : stats?.totalCompanies || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Empresas no banco</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Rankings */}
            <RankingHistory />
          </div>

          {/* Right Column */}
          <div className="space-y-4 sm:space-y-6">
            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Minha Conta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{session.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={isPremium ? "default" : "secondary"}>
                      {isPremium ? "Premium" : "Gratuito"}
                    </Badge>
                    {isPremium && session.user?.premiumExpiresAt && (
                      <span className="text-xs text-muted-foreground">
                        até {new Date(session.user.premiumExpiresAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                {!isPremium && (
                  <div className="space-y-3">
                    <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600" asChild>
                      <Link href="/upgrade" className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Fazer Upgrade
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">
                        Já atualizou seu plano? Faça logout e login novamente para aplicar as mudanças
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="text-xs"
                      >
                        Atualizar Página
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparador de Ações */}
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Comparador</h3>
                    <p className="text-xs text-muted-foreground">
                      Compare ações lado a lado
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link href="/comparador" className="flex items-center justify-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Comparar Agora
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Atividade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rankings gerados</span>
                    <span className="font-medium">
                      {statsLoading ? '-' : stats?.totalRankings || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Carteiras criadas</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Último acesso</span>
                    <span className="font-medium">Agora</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                  Dica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Comece criando seu primeiro ranking com a Fórmula de Graham para 
                  encontrar ações subvalorizadas de empresas sólidas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
