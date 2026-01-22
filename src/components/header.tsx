"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MobileNav, MobileMenuButton } from "@/components/mobile-nav"
import { OportunidadesDropdown } from "@/components/oportunidades-dropdown"
import { AnaliseEstrategiaDropdown } from "@/components/analise-estrategia-dropdown"
import { CarteirasDropdown } from "@/components/carteiras-dropdown"
import { UserProfileDropdown } from "@/components/user-profile-dropdown"
import { NotificationBell } from "@/components/notification-bell"
import { LayoutDashboard, Headphones } from "lucide-react"
import { GlobalSearchBar } from "@/components/global-search-bar"
import { MarketTickerBar } from "@/components/indices/market-ticker-bar"

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { isPremium, isTrialActive, trialDaysRemaining, subscriptionTier } = usePremiumStatus() // ÚNICA FONTE DA VERDADE
  const { trackEngagement } = useEngagementPixel()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Handler para disparar pixel quando usuário deslogado clica em link de navegação
  const handleNavigationClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  // Não mostrar Header na rota /oferta - layout específico cuida disso
  if (pathname === '/oferta') {
    return null
  }

  return (
    <>
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 relative">
          {/* Mobile Layout */}
          <div className="lg:hidden flex items-center relative">
            {/* Mobile Menu Button - Absolute Left (mais próximo da borda) */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <MobileMenuButton 
                isOpen={mobileMenuOpen} 
                setIsOpen={setMobileMenuOpen}
              />
            </div>
            
            {/* Logo - Centered */}
            <div className="w-full flex justify-center">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo-preco-justo.png" 
                  alt="Preço Justo AI" 
                  width={553}
                  height={135}
                  style={{ width: 'auto' }}
                  className="h-12 sm:h-16 w-auto max-w-[200px] sm:max-w-[250px]"
                />
              </Link>
            </div>

            {/* Notification Bell - Absolute Right (mais próximo da borda, apenas se logado) */}
            {session && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <NotificationBell />
              </div>
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between gap-4 xl:gap-8">
            <div className="flex items-center flex-shrink-0">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo-preco-justo.png" 
                  alt="Preço Justo AI" 
                  width={553}
                  height={135}
                  style={{ width: 'auto' }}
                  className="h-[60px] xl:h-[70px] w-auto"
                />
              </Link>
            </div>

          {/* Desktop Navigation */}
          <nav className="flex items-center space-x-6 flex-1 justify-end min-w-0">
          {status === "loading" ? (
            <div className="animate-pulse flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
              <span className="text-sm">Carregando...</span>
            </div>
          ) : session ? (
            // Logged in user navigation
            <div className="flex items-center space-x-4">
              {/* Navigation Links */}
              <div className="flex items-center space-x-1">
                <Button 
                  variant={pathname === "/dashboard" ? "default" : "ghost"} 
                  size="sm" 
                  asChild
                >
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                </Button>

                {/* Oportunidades Dropdown */}
                <OportunidadesDropdown />

                {/* Análise & Estratégia Dropdown */}
                <AnaliseEstrategiaDropdown />

                {/* Carteiras Dropdown */}
                <CarteirasDropdown />
              </div>

              {/* Notification Bell, Suporte e User Profile - Agrupados */}
              <div className="flex items-center space-x-2">
                {/* Suporte como ícone */}
                <Button 
                  variant={pathname === "/suporte" ? "default" : "ghost"} 
                  size="sm" 
                  asChild
                  className="h-9 w-9 p-0 relative"
                  title="Suporte"
                >
                  <Link href="/suporte" className="flex items-center justify-center relative">
                    <Headphones className="w-4 h-4" />
                    {!isPremium && (
                      <Badge variant="default" className="absolute -top-1 -right-1 h-2.5 w-2.5 p-0 bg-gradient-to-r from-blue-500 to-purple-600 border-0 rounded-full" />
                    )}
                  </Link>
                </Button>
                <NotificationBell />
                <UserProfileDropdown
                userName={session.user?.name}
                userEmail={session.user?.email}
                isPremium={isPremium || false}
                isTrialActive={isTrialActive || false}
                trialDaysRemaining={trialDaysRemaining || null}
                subscriptionTier={(subscriptionTier as 'FREE' | 'PREMIUM' | 'VIP') || 'FREE'}
                />
              </div>
            </div>
          ) : (
            // Not logged in navigation
            <div className="flex items-center space-x-4">
              {/* Public Links */}
              <div className="flex items-center space-x-1">
                {/* Oportunidades Dropdown para usuários não logados */}
                <OportunidadesDropdown />
                
                {/* Análise & Estratégia Dropdown para usuários não logados */}
                <AnaliseEstrategiaDropdown />
                
                {/* Link para Preços - Scroll na LP, link direto em outras páginas */}
                {pathname === '/' ? (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNavigationClick()
                      const pricingSection = document.getElementById('pricing')
                      if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                  >
                    Preços
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/#pricing" onClick={handleNavigationClick}>Preços</Link>
                  </Button>
                )}
              </div>
              
              {/* Auth Buttons */}
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/login" onClick={handleNavigationClick}>Entrar</Link>
                </Button>
                <Button asChild>
                  <Link href="/register" onClick={handleNavigationClick}>Registrar</Link>
                </Button>
              </div>
            </div>
          )}
          </nav>
          </div>
        </div>
      </header>

      {/* Tarja de Índices do Mercado - Entre Header e Search Bar */}
      <MarketTickerBar position="top" />

      {/* Global Search Bar - Below Market Ticker (ocultar em /analisar-acoes) */}
      {pathname !== '/analisar-acoes' && <GlobalSearchBar />}

      {/* Mobile Navigation Drawer */}
      <MobileNav 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen}
      />
    </>
  )
}
