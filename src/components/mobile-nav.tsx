"use client"

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  BarChart3, 
  Shield, 
  LogOut,
  User,
  CreditCard,
  GitCompare,
  Headphones,
  TrendingUp,
  Building2,
  Filter,
  Sparkles,
  Bell,
  Calculator,
  Clock,
  DollarSign,
  Radar,
  ChevronRight,
  Settings,
  Rocket,
  History,
  ArrowLeftRight,
  LineChart,
  MessageSquare
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useAdminCheck } from "@/hooks/use-user-data"

interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export function MobileNav({ isOpen, setIsOpen }: MobileNavProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { isPremium, isTrialActive, trialDaysRemaining, subscriptionTier } = usePremiumStatus() // ÚNICA FONTE DA VERDADE
  const { data: adminData } = useAdminCheck()
  const { trackEngagement } = useEngagementPixel()
  const isAdmin = adminData?.isAdmin || false

  // Handler para disparar pixel quando usuário deslogado clica em link de navegação
  const handleNavigationClick = () => {
    if (!session) {
      trackEngagement()
    }
    setIsOpen(false)
  }

  // Extrair iniciais do nome ou email
  const getInitials = () => {
    if (session?.user?.name) {
      return session.user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (session?.user?.email) {
      return session.user.email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname, setIsOpen])

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Menu Principal - Links Diretos
  const menuItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      show: !!session
    }
  ]

  // Carteiras - Seção Expansível
  const carteirasSections: Array<{
    items: Array<{
      title: string
      href: string
      icon: React.ReactElement
      show: boolean
      description: string
      badge?: string
      isNew?: boolean
    }>
  }> = [
    {
      items: [
        {
          title: "Carteiras Teóricas",
          href: "/indices",
          icon: <LineChart className="w-5 h-5" />,
          show: true,
          description: "Índices teóricos com performance histórica e rebalanceamento automático"
        },
        {
          title: "Carteiras",
          href: "/carteira",
          icon: <BarChart3 className="w-5 h-5" />,
          show: Boolean(session && isPremium),
          description: "Gerencie suas carteiras de investimentos com acompanhamento em tempo real",
          badge: isPremium ? "Premium" : undefined
        }
      ]
    }
  ]

  // Oportunidades - Seção Expansível com Subcategorias
  const oportunidadesSections: Array<{
    label: string
    items: Array<{
      title: string
      href: string
      icon: React.ReactElement
      show: boolean
      description: string
      isNew?: boolean
      badge?: string
    }>
  }> = [
    {
      label: "Descoberta",
      items: [
        {
          title: "Radar de Oportunidades",
          href: "/radar", 
          icon: <Radar className="w-5 h-5" />,
          show: true,
          description: "Visão consolidada e visual de ativos descontados",
          isNew: true
        },
        {
          title: "Screening de Ações",
          href: "/screening-acoes", 
          icon: <Filter className="w-5 h-5" />,
          show: true,
          description: "Filtros customizáveis para encontrar a ação perfeita"
        },
      ],
    },
    {
      label: "Análise Rápida",
      items: [
        {
          title: "Radar de Dividendos",
          href: "/radar-dividendos", 
          icon: <DollarSign className="w-5 h-5" />,
          show: true,
          description: "Projeções de dividendos com IA"
        },
        {
          title: "Rankings",
          href: "/ranking", 
          icon: <BarChart3 className="w-5 h-5" />,
          show: true,
          description: "As melhores ações segundo Graham, Bazin e outros"
        },
      ],
    },
  ]

  // Análise & Estratégia - Seção Expansível com Subcategorias
  const analiseEstrategiaSections: Array<{
    label: string
    items: Array<{
      title: string
      href: string
      icon: React.ReactElement
      show: boolean
      description: string
      badge?: string
      isNew?: boolean
    }>
  }> = [
    {
      label: "Comparação",
      items: [
        {
          title: "Comparador",
          href: "/comparador", 
          icon: <GitCompare className="w-5 h-5" />,
          show: true,
          description: "Compare indicadores de ações lado a lado"
        },
        {
          title: "Análise Setorial",
          href: "/analise-setorial", 
          icon: <Building2 className="w-5 h-5" />,
          show: true,
          description: "Compare múltiplos e métricas entre setores"
        },
      ],
    },
    {
      label: "Histórico",
      items: [
        {
          title: "P/L Histórico",
          href: "/pl-bolsa",
          icon: <TrendingUp className="w-5 h-5" />,
          show: true,
          description: "Análise histórica do P/L da Bovespa"
        },
        {
          title: "Backtesting",
          href: "/backtest",
          icon: <History className="w-5 h-5" />,
          show: true,
          description: "Simule estratégias de investimento no passado"
        },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        {
          title: "Acompanhar Ações",
          href: "/acompanhar-acoes-bolsa-de-valores",
          icon: <Bell className="w-5 h-5" />,
          show: true,
          description: "Monitore ações e receba alertas personalizados"
        },
        {
          title: "Arbitragem de Dívida",
          href: "/arbitragem-divida",
          icon: <ArrowLeftRight className="w-5 h-5" />,
          show: true,
          description: "Simule amortizar dívida vs investir em ativos",
          isNew: true
        },
        {
          title: "Calculadoras",
          href: "/calculadoras/dividend-yield",
          icon: <Calculator className="w-5 h-5" />,
          show: true,
          description: "Calcule preço teto e rendimento de dividendos",
          badge: "Grátis"
        },
      ],
    },
  ]

  // Handler para fechar o menu - garante compatibilidade com touch events
  const handleClose = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setIsOpen(false)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden touch-none"
          onClick={handleClose}
          onTouchEnd={handleClose}
          role="button"
          tabIndex={0}
          aria-label="Fechar menu"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border relative z-[60]">
            <Link
              href="/"
              className="flex items-center"
              onClick={() => setIsOpen(false)}
            >
              <Image 
                src="/logo-preco-justo.png" 
                alt="Preço Justo AI" 
                width={553}
                height={135}
                style={{ width: 'auto' }}
                className="h-9 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={handleClose}
              onTouchEnd={handleClose}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation pointer-events-auto relative z-[70]"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* User Info */}
          {session && (
            <div className="p-4 border-b border-border bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarFallback className={`text-sm font-semibold ${
                    isPremium 
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {session.user?.name || session.user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {session.user?.email}
                  </p>
                  {isTrialActive && subscriptionTier === 'FREE' ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge 
                          variant="secondary"
                          className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                        >
                          🎁 Trial Premium
                        </Badge>
                        <Badge 
                          variant="default"
                          className="text-xs bg-gradient-to-r from-violet-600 to-purple-600 border-0"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          Ativo
                        </Badge>
                      </div>
                      {trialDaysRemaining !== null && (
                        <div className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">
                            {trialDaysRemaining === 1 
                              ? 'Último dia!' 
                              : `${trialDaysRemaining} dias restantes`}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge 
                      variant={isPremium ? "default" : "secondary"} 
                      className={`text-xs ${
                        isPremium 
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 border-0' 
                          : ''
                      }`}
                    >
                      {isPremium ? (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          Premium
                        </>
                      ) : (
                        'Plano Gratuito'
                      )}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Upgrade CTA - Apenas para usuários não Premium */}
              {!isPremium && (
                <div className="mt-2">
                  <Link 
                    href="/checkout" 
                    onClick={() => setIsOpen(false)}
                  >
                    <Button 
                      size="sm" 
                      className="w-full text-xs bg-gradient-to-r from-violet-600 to-purple-600"
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      Upgrade Premium
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="p-4 pb-20">
              <nav className="space-y-4">
                {/* Menu Principal - Links Diretos */}
                {session && menuItems.filter(item => item.show).length > 0 && (
                  <div className="space-y-2">
                    {menuItems
                      .filter(item => item.show)
                      .map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={handleNavigationClick}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            pathname === item.href
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {item.icon}
                          <span className="font-medium flex-1">{item.title}</span>
                        </Link>
                      ))}
                  </div>
                )}

                {/* Seção Carteiras - Accordion */}
                {session && carteirasSections.some(section => section.items.some(item => item.show)) && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-4 py-3 font-medium hover:bg-accent hover:text-accent-foreground data-[state=open]:text-primary group">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Carteiras
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 py-2 space-y-3">
                      {carteirasSections.map((section, sectionIndex) => (
                        <div key={sectionIndex}>
                          <div className="space-y-1">
                            {section.items
                              .filter(item => item.show)
                              .map((item) => (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={handleNavigationClick}
                                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                    pathname === item.href || pathname?.startsWith(item.href)
                                      ? 'bg-primary text-primary-foreground'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <div className={`p-1.5 rounded-md ${
                                    item.href === '/indices'
                                      ? 'bg-gradient-to-br from-violet-500 to-purple-500'
                                      : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                                  }`}>
                                    <div className="text-white text-sm">
                                      {item.icon}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{item.title}</span>
                                      {item.badge && (
                                        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                                          {item.badge}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  </div>
                                </Link>
                              ))}
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Seção Oportunidades - Accordion */}
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-4 py-3 font-medium hover:bg-accent hover:text-accent-foreground data-[state=open]:text-primary group">
                    <span className="flex items-center gap-2">
                      <Rocket className="h-4 w-4" /> Oportunidades
                    </span>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-2 space-y-3">
                    {oportunidadesSections.map((section, sectionIndex) => (
                      <div key={sectionIndex}>
                        {section.label && (
                          <div className="px-2 py-1 mb-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">{section.label}</p>
                          </div>
                        )}
                        <div className="space-y-1">
                          {section.items
                            .filter(item => item.show)
                            .map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleNavigationClick}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                  pathname === item.href || pathname?.startsWith(item.href)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                <div className={`p-1.5 rounded-md ${
                                  item.href === '/screening-acoes'
                                    ? 'bg-gradient-to-br from-amber-500 to-yellow-500'
                                    : 'bg-gradient-to-br from-blue-500 to-purple-500'
                                }`}>
                                  <div className="text-white text-sm">
                                    {item.icon}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{item.title}</span>
                                    {item.isNew && (
                                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                        🚀 Novo
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                              </Link>
                            ))}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Seção Análise & Estratégia - Accordion */}
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-4 py-3 font-medium hover:bg-accent hover:text-accent-foreground data-[state=open]:text-primary group">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Análise & Estratégia
                    </span>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-2 space-y-3">
                    {analiseEstrategiaSections.map((section, sectionIndex) => (
                      <div key={sectionIndex}>
                        {section.label && (
                          <div className="px-2 py-1 mb-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">{section.label}</p>
                          </div>
                        )}
                        <div className="space-y-1">
                          {section.items
                            .filter(item => item.show)
                            .map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleNavigationClick}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                  pathname === item.href || pathname?.startsWith(item.href)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                <div className={`p-1.5 rounded-md ${
                                  item.href === '/analise-setorial'
                                    ? 'bg-gradient-to-br from-indigo-500 to-blue-500'
                                    : item.href === '/backtest'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                                    : item.href === '/calculadoras/dividend-yield'
                                    ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                                    : item.href === '/arbitragem-divida'
                                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                    : 'bg-gradient-to-br from-blue-500 to-purple-500'
                                }`}>
                                  <div className="text-white text-sm">
                                    {item.icon}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{item.title}</span>
                                    {item.isNew && (
                                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                        🚀 Novo
                                      </Badge>
                                    )}
                                    {item.badge && (
                                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                                        {item.badge}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                              </Link>
                            ))}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
            </nav>

            {/* Link Preços para usuários não logados */}
            {!session && (
              <div className="mt-6">
                <Link
                  href={pathname === '/' ? '#pricing' : '/#pricing'}
                  onClick={(e) => {
                    if (pathname === '/') {
                      e.preventDefault()
                      setIsOpen(false)
                      const pricingSection = document.getElementById('pricing')
                      if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    } else {
                      setIsOpen(false)
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="font-medium flex-1">Preços</span>
                </Link>
              </div>
            )}

            {/* Auth CTA for Non-Users */}
            {!session && (
              <div className="mt-6 space-y-3">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20 rounded-lg border">
                  <h3 className="font-semibold text-sm mb-2">Crie sua conta grátis</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Salve rankings, acesse modelos premium e acompanhe histórico
                  </p>
                  <div className="space-y-2">
                    <Button asChild size="sm" className="w-full">
                      <Link 
                        href="/register" 
                        className="flex items-center justify-center gap-2"
                        onClick={handleNavigationClick}
                      >
                        <User className="w-4 h-4" />
                        Criar Conta
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/login" onClick={handleNavigationClick}>
                        Fazer Login
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Footer Actions */}
          {session && (
            <div className="border-t border-border p-4 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link 
                  href="/dashboard/subscriptions" 
                  className="flex items-center gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <Bell className="w-4 h-4" />
                  Inscrições
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link 
                  href="/dashboard/monitoramentos-customizados" 
                  className="flex items-center gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  Monitoramentos Customizados
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link 
                  href="/conversas-ben" 
                  className="flex items-center gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Minhas Conversas com Ben
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link 
                  href="/perfil" 
                  className="flex items-center gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4" />
                  Perfil
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link 
                  href="/suporte" 
                  className="flex items-center gap-3"
                  onClick={() => setIsOpen(false)}
                >
                  <Headphones className="w-4 h-4" />
                  Suporte
                  {!isPremium && (
                    <Badge variant="default" className="ml-auto text-xs bg-gradient-to-r from-blue-500 to-purple-600">
                      Premium
                    </Badge>
                  )}
                </Link>
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  asChild
                >
                  <Link 
                    href="/admin" 
                    className="flex items-center gap-3"
                    onClick={() => setIsOpen(false)}
                  >
                    <Shield className="w-4 h-4" />
                    Painel Admin
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => {
                  setIsOpen(false)
                  signOut()
                }}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sair
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function MobileMenuButton({ isOpen, setIsOpen }: MobileNavProps) {
  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return (
    <button
      type="button"
      className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation pointer-events-auto"
      onClick={handleToggle}
      onTouchEnd={handleToggle}
      aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
    >
      {isOpen ? (
        <X className="w-5 h-5" />
      ) : (
        <Menu className="w-5 h-5" />
      )}
    </button>
  )
}
