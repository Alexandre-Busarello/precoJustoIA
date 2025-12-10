"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePremiumStatus } from "@/hooks/use-premium-status";
import { useDashboardStats, useTopCompanies, useDashboardPortfolios } from "@/hooks/use-dashboard-data";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import { CacheIndicator } from "@/components/cache-indicator";

interface TopCompany {
  ticker: string;
  companyName: string;
  score: number;
  sector: string | null;
  currentPrice: number;
  logoUrl: string | null;
  recommendation: string;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RankingHistorySection } from "@/components/ranking-history-section";
import { Footer } from "@/components/footer";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { CompanyLogo } from "@/components/company-logo";
import { DashboardPortfolios } from "@/components/dashboard-portfolios";
import { DashboardRadarSection } from "@/components/dashboard-radar-section";
import { DashboardNotificationBanner } from "@/components/dashboard-notification-banner";
import { NotificationModalsWrapper } from "@/components/notification-modals-wrapper";
import { MarketTickerBar } from "@/components/indices/market-ticker-bar";
import { GoogleAdsConversionPixel } from "@/components/google-ads-conversion-pixel";
import { OAuthNewUserHandler } from "@/components/oauth-new-user-handler";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Shield,
  ArrowRight,
  MessageCircle,
  Sparkles,
  Check,
  RefreshCw,
  ChevronRight,
  Bell,
  User,
  GitCompare,
} from "lucide-react";
import Link from "next/link";



export default function Dashboard() {
  const { data: session, status } = useSession();
  const { isPremium, subscriptionTier, isTrialActive, trialDaysRemaining } = usePremiumStatus();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Usar React Query hooks
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: topCompaniesData, isLoading: companiesLoading, refetch: refetchTopCompanies, dataUpdatedAt: companiesUpdatedAt } = useTopCompanies(3, 80);
  const { data: dashboardPortfoliosData, isLoading: portfoliosLoading } = useDashboardPortfolios();

  // Monitorar mudanças de portfolio e perfil para invalidar cache
  useCacheInvalidation();

  // Ref para prevenir processamento duplicado de campanhas
  const hasProcessedCampaignsRef = useRef(false);
  const isProcessingCampaignsRef = useRef(false);

  const topCompanies = (topCompaniesData as { companies: TopCompany[] } | undefined)?.companies || [];
  const portfolioCount = (dashboardPortfoliosData as { portfolios: unknown[] } | undefined)?.portfolios?.length || 0;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
    }
  }, [session, status, router]);

  // Processar campanhas ativas para novos usuários (apenas uma vez)
  useEffect(() => {
    if (status === "loading" || !session?.user?.id) return;
    
    // Prevenir processamento duplicado: verificar se já foi processado ou está em processamento
    if (hasProcessedCampaignsRef.current || isProcessingCampaignsRef.current) {
      return;
    }

    // Marcar como em processamento para evitar race conditions
    isProcessingCampaignsRef.current = true;

    // Processar campanhas ativas silenciosamente
    // Isso garante que usuários novos recebam notificações de campanhas ativas
    fetch('/api/notifications/process-active-campaigns')
      .then(res => res.json())
      .then(data => {
        // Marcar como processado independente do resultado
        hasProcessedCampaignsRef.current = true;
        isProcessingCampaignsRef.current = false;

        if (data.success && data.processed > 0) {
          console.log(`📢 Processadas ${data.processed} campanhas ativas`)
          
          // Invalidar queries de notificações para atualizar UI automaticamente
          // Isso atualiza o sininho (badge) e o banner na dashboard sem precisar refresh
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      })
      .catch(err => {
        // Marcar como processado mesmo em caso de erro para evitar tentativas infinitas
        hasProcessedCampaignsRef.current = true;
        isProcessingCampaignsRef.current = false;
        
        // Silenciosamente ignorar erros para não impactar UX
        console.error('Erro ao processar campanhas ativas:', err)
      })
  }, [session?.user?.id, status, queryClient]);

  // Função para forçar refresh das empresas (mantida para compatibilidade)
  const fetchTopCompanies = async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      await refetchTopCompanies();
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Determinar se usuário é novo ou experiente
  const isNewUser = ((stats as { totalRankings?: number } | undefined)?.totalRankings || 0) === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <OAuthNewUserHandler />
      <GoogleAdsConversionPixel />
      <NotificationModalsWrapper />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Simplificado */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Olá, {session.user?.name || session.user?.email?.split("@")[0]}!
                👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Pronto para analisar ações hoje?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden sm:flex"
              >
                <Link href="/perfil" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Perfil
                </Link>
              </Button>
              {isTrialActive && subscriptionTier === 'FREE' ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs sm:text-sm px-2 py-1 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                  >
                    🎁 Trial
                  </Badge>
                  <Badge
                    variant="default"
                    className="text-xs sm:text-sm px-3 py-1 bg-gradient-to-r from-violet-600 to-pink-600"
                  >
                    ✨ Premium
                  </Badge>
                  {trialDaysRemaining !== null && (
                    <span className="text-xs text-violet-600 dark:text-violet-400 font-medium hidden sm:inline">
                      {trialDaysRemaining === 1 ? 'Último dia!' : `${trialDaysRemaining}d restantes`}
                    </span>
                  )}
                </div>
              ) : (
                <Badge
                  variant={isPremium ? "default" : "secondary"}
                  className={`text-xs sm:text-sm px-3 py-1 ${
                    isPremium ? "bg-gradient-to-r from-violet-600 to-pink-600" : ""
                  }`}
                >
                  {isPremium ? "✨ Premium" : "Gratuito"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Email Verification Banner - Discreto */}
        <EmailVerificationBanner />

        {/* Trial Premium Banner - Discreto */}
        {isTrialActive && subscriptionTier === 'FREE' && (
          <Card className="mb-6 border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Trial Premium Ativo
                      </h3>
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                        🎁 Trial
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Você está aproveitando todos os recursos Premium gratuitamente.
                      {trialDaysRemaining !== null && (
                        <span className="font-medium text-violet-600 dark:text-violet-400 ml-1">
                          {trialDaysRemaining === 1 
                            ? 'Último dia!' 
                            : `${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'dia' : 'dias'} restantes`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shrink-0"
                >
                  <Link href="/checkout" className="flex items-center gap-2">
                    Converter para Premium
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NOTIFICAÇÃO DESTACADA OU BANNER PADRÃO */}
        <DashboardNotificationBanner />

        {/* RADAR DE OPORTUNIDADES */}
        <DashboardRadarSection />

        {/* Layout Principal */}
        <div className="space-y-6">
          {/* COLUNA PRINCIPAL (Mobile: 100% | Desktop: 66%) */}
          <div className="lg:col-span-2 space-y-6">

            {/* 4. CARTEIRAS - Para usuários Premium */}
            {isPremium && (
              <div className="space-y-4">
                {/* Header sempre visível */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Minhas Carteiras
                  </h2>
                  {!portfoliosLoading && portfolioCount > 0 && (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/carteira" className="flex items-center gap-2">
                        Ver Todas
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
                
                {/* Conteúdo: loading, carteiras ou CTA */}
                {portfoliosLoading ? (
                  // Mostrar loading enquanto busca dados
                  <DashboardPortfolios />
                ) : portfolioCount > 0 ? (
                  // Usuário tem carteiras - mostrar dashboard normal
                  <DashboardPortfolios />
                ) : (
                  // Usuário Premium sem carteiras - chamada para criar primeira carteira
                  <Card className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20 hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-8">
                      <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                          <BarChart3 className="w-10 h-10 text-white" />
                        </div>
                        
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            🚀 Crie Sua Primeira Carteira
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                            Monte carteiras inteligentes com IA, acompanhe performance e receba sugestões automáticas de rebalanceamento
                          </p>
                        </div>

                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-4 max-w-md mx-auto">
                          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Assistente IA para configuração</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Acompanhamento de performance</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Sugestões de rebalanceamento</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Análise de transações</span>
                            </li>
                          </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button asChild size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                            <Link href="/carteira" className="flex items-center gap-2">
                              <Sparkles className="w-5 h-5" />
                              Criar Primeira Carteira
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 4.1. CARTEIRAS CTA - Para usuários Free */}
            {!isPremium && (
              <Card className="border-2 border-dashed border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-950/20 dark:via-background dark:to-purple-950/20">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                        Carteiras Inteligentes Premium
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Monte carteiras com IA, acompanhe performance em tempo real e receba sugestões automáticas de rebalanceamento
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Assistente IA
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Performance Real
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Rebalanceamento
                        </Badge>
                      </div>
                      <Button asChild className="bg-gradient-to-r from-violet-600 to-purple-600">
                        <Link href="/checkout" className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Fazer Upgrade Premium
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. AÇÃO PRINCIPAL - Adaptativa baseada em experiência */}
            {isNewUser ? (
              // USUÁRIO NOVO - Card grande focado em criar primeiro ranking
              <Link href="/ranking">
                <Card className="group cursor-pointer border-2 border-dashed border-blue-400 hover:border-blue-600 hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/30 dark:via-background dark:to-violet-950/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-violet-200/20 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>

                  <CardContent className="p-6 sm:p-8 relative z-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl">
                        <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-xl sm:text-2xl mb-2 group-hover:text-blue-600 transition-colors">
                          🚀 Criar Seu Primeiro Ranking
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Comece sua jornada analisando empresas da B3 com a
                          Fórmula de Graham
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 mb-4">
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-blue-600" />
                          <span>Análise fundamentalista completa</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-blue-600" />
                          <span>Rankings automáticos por score</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-blue-600" />
                          <span>Identifique ações subvalorizadas</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-blue-600 group-hover:text-blue-700 font-semibold">
                      <span className="text-sm">Começar agora</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              // USUÁRIO ATIVO - Grid com histórico + novo ranking
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Histórico de Rankings - Destaque para últimas análises */}
                <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-2 border-violet-200 dark:border-violet-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-5 h-5 text-violet-600" />
                      Suas Análises Recentes
                      <Badge className="ml-auto bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        {(stats as { totalRankings?: number } | undefined)?.totalRankings || 0}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">
                      Continue de onde parou ou revise rankings anteriores
                    </p>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      <Link
                        href="#rankings"
                        className="flex items-center justify-center gap-2"
                      >
                        Ver Histórico Completo
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Criar Novo Ranking - Lado a lado com histórico */}
                <Link href="/ranking">
                  <Card className="group cursor-pointer border-2 border-dashed border-blue-300 hover:border-blue-500 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 h-full">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <BarChart3 className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-center mb-2 group-hover:text-blue-600">
                        📊 Nova Análise
                      </h3>
                      <p className="text-xs text-muted-foreground text-center mb-3">
                        Explore {isPremium ? "8 modelos" : "novos modelos"} de
                        valuation
                      </p>
                      <div className="flex items-center justify-center gap-2 text-blue-600 group-hover:text-blue-700 font-semibold text-sm">
                        <span>Explorar Ranking</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}

            {/* 3. FERRAMENTAS RÁPIDAS */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Link href="/backtest">
                <Card className="group cursor-pointer bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                          Backtesting
                        </h3>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-2 py-0.5 font-semibold">
                          NOVO
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Simule carteiras históricas com métricas avançadas
                    </p>
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium">
                      <span>Testar agora</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/comparador">
                <Card className="group cursor-pointer bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                        <GitCompare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                          Comparador
                        </h3>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-0.5 font-semibold">
                          GRÁTIS
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Compare até 6 ações lado a lado
                    </p>
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium">
                      <span>Comparar agora</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* 3.5. ANÁLISES RECOMENDADAS - Design Profissional */}
            {!companiesLoading && topCompanies.length > 0 && (
              <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Boas Empresas para Analisar
                        {companiesUpdatedAt && (
                          <CacheIndicator 
                            queryKey={['top-companies', 3, 80]}
                            dataUpdatedAt={companiesUpdatedAt}
                            staleTime={5 * 60 * 1000}
                          />
                        )}
                      </CardTitle>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Empresas com score geral acima de 80 pontos
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchTopCompanies(true)}
                      disabled={companiesLoading}
                      title="Atualizar análises (limpar cache)"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          companiesLoading ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topCompanies.map((company) => (
                      <Link
                        key={company.ticker}
                        href={`/acao/${company.ticker}`}
                        prefetch={false}
                        className="block hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="p-4 group">
                          {/* Header: Logo + Ticker + Score */}
                          <div className="flex items-start gap-3 mb-3">
                            <CompanyLogo
                              logoUrl={company.logoUrl}
                              companyName={company.companyName}
                              ticker={company.ticker}
                              size={48}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                                    {(company as { ticker: string }).ticker}
                                  </h4>
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-0.5 font-semibold">
                                    Score {company.score}
                                  </Badge>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1 mb-2">
                                {company.companyName}
                              </p>
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="grid grid-cols-2 gap-3 pl-[60px]">
                            {/* Setor */}
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                Setor
                              </p>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {company.sector || "Diversos"}
                              </p>
                            </div>

                            {/* Recomendação */}
                            <div className="text-right">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                Classificação
                              </p>
                              <p
                                className={`text-sm font-bold ${
                                  company.recommendation === "Empresa Excelente"
                                    ? "text-green-600 dark:text-green-400"
                                    : company.recommendation === "Empresa Boa"
                                    ? "text-green-500 dark:text-green-400"
                                    : company.recommendation ===
                                      "Empresa Regular"
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-500 dark:text-red-400"
                                }`}
                              >
                                {company.recommendation}
                              </p>
                            </div>
                          </div>

                          {/* CTA */}
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 pl-[60px]">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                              Ver análise completa →
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {companiesLoading && (
              <Card className="border border-slate-200 dark:border-slate-800">
                <CardContent className="p-6 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Carregando análises...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5. HISTÓRICO DE RANKINGS */}
            <div id="rankings">
              <RankingHistorySection />
            </div>
          </div>

          {/* COLUNA LATERAL (Mobile: 100% | Desktop: 33%) */}
          <div className="space-y-4">
            {/* 5. GRUPO WHATSAPP - Versão compacta (já clicou) */}
            {false && (
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm text-green-900 dark:text-green-100 mb-1 flex items-center gap-2">
                          Grupo WhatsApp
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 text-xs px-2 py-0">
                            Conectado
                          </Badge>
                        </h4>
                        <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                          Continue ativo para garantir 3 anos de acesso
                          gratuito!
                        </p>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="w-full text-xs border-green-300 hover:bg-green-100 dark:border-green-700 dark:hover:bg-green-900/20"
                        >
                          <Link
                            href="https://chat.whatsapp.com/DM9xmkTiuaWAKseVluTqOh?mode=ems_copy_t"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                          >
                            <MessageCircle className="w-3 h-3" />
                            Abrir Grupo
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* 6. INFO DA CONTA - Resumida */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Minha Conta
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-xs font-medium truncate ml-2 max-w-[180px]">
                    {session.user?.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Plano</span>
                  <Badge
                    variant={isPremium ? "default" : "secondary"}
                    className={`text-xs ${
                      isPremium
                        ? "bg-gradient-to-r from-violet-600 to-pink-600"
                        : ""
                    }`}
                  >
                    {isPremium ? "Premium" : "Gratuito"}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    asChild
                  >
                    <Link
                      href="/dashboard/subscriptions"
                      className="flex items-center justify-center gap-2"
                    >
                      <Bell className="w-3 h-3" />
                      Minhas Inscrições
                    </Link>
                  </Button>
                </div>
                {!isPremium && (
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-violet-600 to-pink-600 text-xs"
                    asChild
                  >
                    <Link href="/checkout">Fazer Upgrade</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* 7. ATIVIDADE - Compacta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Atividade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Rankings</span>
                    <span className="font-semibold">
                      {statsLoading ? "-" : (stats as { totalRankings?: number } | undefined)?.totalRankings || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Carteiras</span>
                    <span className="font-semibold">{portfolioCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
