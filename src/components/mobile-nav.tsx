"use client"

import { useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  BarChart3, 
  Shield, 
  Zap, 
  LogOut,
  User,
  Settings,
  CreditCard,
  GitCompare,
  Headphones,
  TrendingUp,
  Wrench,
  Building2
} from "lucide-react"

interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export function MobileNav({ isOpen, setIsOpen }: MobileNavProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { isPremium } = usePremiumStatus() // ÚNICA FONTE DA VERDADE

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

  const menuItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      show: !!session
    }
  ]

  const toolsItems = [
    {
      title: "Rankings",
      href: "/ranking", 
      icon: <BarChart3 className="w-5 h-5" />,
      show: true,
      description: "Análise fundamentalista"
    },
    {
      title: "Análise Setorial",
      href: "/analise-setorial", 
      icon: <Building2 className="w-5 h-5" />,
      show: true,
      description: "Compare setores da B3",
      isNew: true
    },
    {
      title: "Comparador",
      href: "/comparador", 
      icon: <GitCompare className="w-5 h-5" />,
      show: true,
      description: "Compare ações"
    },
    {
      title: "Backtesting",
      href: "/backtest", 
      icon: <TrendingUp className="w-5 h-5" />,
      show: true,
      description: "Simule carteiras",
      isPremiumFeature: !isPremium
    }
  ]

  const supportItems = [
    {
      title: "Suporte",
      href: "/suporte", 
      icon: <Headphones className="w-5 h-5" />,
      show: !!session,
      isPremiumFeature: !isPremium
    }
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
            <div className="p-4 border-b border-border bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/20 dark:to-violet-950/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {session.user?.name || session.user?.email?.split('@')[0]}
                  </p>
                  <Badge variant={isPremium ? "default" : "secondary"} className="text-xs mt-1">
                    {isPremium ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Premium
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 mr-1" />
                        Gratuito
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="p-4 pb-20">
              <nav className="space-y-4">
              {/* Menu Principal */}
              {session && menuItems.filter(item => item.show).length > 0 && (
                <div className="space-y-2">
                  {menuItems
                    .filter(item => item.show)
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
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

              {/* Seção Ferramentas */}
              <div>
                <div className="flex items-center gap-2 px-3 py-2 mb-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Ferramentas
                  </h3>
                </div>
                <div className="space-y-1">
                  {toolsItems
                    .filter(item => item.show)
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          pathname === item.href
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${
                          item.href === '/backtest' 
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
                            : item.href === '/analise-setorial'
                            ? 'bg-gradient-to-br from-indigo-500 to-blue-500'
                            : 'bg-gradient-to-br from-blue-500 to-purple-500'
                        }`}>
                          <div className="text-white text-sm">
                            {item.icon}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.title}</span>
                            {item.isPremiumFeature && (
                              <Badge variant="default" className="text-xs bg-gradient-to-r from-emerald-500 to-teal-500">
                                Premium
                              </Badge>
                            )}
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

              {/* Seção Suporte */}
              {session && (
                <div>
                  <div className="space-y-1">
                    {supportItems
                      .filter(item => item.show)
                      .map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            pathname === item.href
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {item.icon}
                          <span className="font-medium flex-1">{item.title}</span>
                          {item.isPremiumFeature && (
                            <Badge variant="default" className="text-xs bg-gradient-to-r from-blue-500 to-purple-600">
                              Premium
                            </Badge>
                          )}
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </nav>

            {/* Upgrade CTA for Free Users */}
            {session && !isPremium && (
              <div className="mt-6 p-4 bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="w-5 h-5 text-violet-600" />
                  <h3 className="font-semibold text-sm">Upgrade Premium</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Desbloqueie todos os modelos de valuation, análises com IA e Central de Suporte Premium
                </p>
                <Button asChild size="sm" className="w-full bg-gradient-to-r from-violet-600 to-pink-600">
                  <Link 
                    href="/checkout" 
                    className="flex items-center justify-center gap-2"
                    onClick={() => setIsOpen(false)}
                  >
                    <CreditCard className="w-4 h-4" />
                    Fazer Upgrade
                  </Link>
                </Button>
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
                        onClick={() => setIsOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        Criar Conta
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/login" onClick={() => setIsOpen(false)}>
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
            <div className="border-t border-border p-4">
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <Link 
                    href="/settings" 
                    className="flex items-center gap-3"
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Configurações
                  </Link>
                </Button>
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
