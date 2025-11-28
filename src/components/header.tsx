"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MobileNav, MobileMenuButton } from "@/components/mobile-nav"
import { ToolsDropdown } from "@/components/tools-dropdown"
import { UserProfileDropdown } from "@/components/user-profile-dropdown"
import { NotificationBell } from "@/components/notification-bell"
import { LayoutDashboard, Headphones, BarChart3 } from "lucide-react"
import { GlobalSearchBar } from "@/components/global-search-bar"

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { isPremium, isTrialActive, trialDaysRemaining, subscriptionTier } = usePremiumStatus() // ÚNICA FONTE DA VERDADE
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50 will-change-transform">
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
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo-preco-justo.png" 
                  alt="Preço Justo AI" 
                  width={553}
                  height={135}
                  style={{ width: 'auto' }}
                  className="h-[70px] w-auto"
                />
              </Link>
            </div>

          {/* Desktop Navigation */}
          <nav className="flex items-center space-x-6">
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

                {/* Carteiras - Nova seção separada */}
                {isPremium && (
                  <Button 
                    variant={pathname === "/carteira" ? "default" : "ghost"} 
                    size="sm" 
                    asChild
                  >
                    <Link href="/carteira" className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Carteiras
                    </Link>
                  </Button>
                )}
                
                {/* Dropdown de Ferramentas */}
                <ToolsDropdown isPremium={isPremium || false} />

                {/* Suporte - Conversão para Premium */}
                <Button 
                  variant={pathname === "/suporte" ? "default" : "ghost"} 
                  size="sm" 
                  asChild
                >
                  <Link href="/suporte" className="flex items-center gap-2">
                    <Headphones className="w-4 h-4" />
                    Suporte
                    {!isPremium && (
                      <Badge variant="default" className="ml-1 text-xs bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                        Premium
                      </Badge>
                    )}
                  </Link>
                </Button>
              </div>

              {/* Notification Bell e User Profile - Agrupados */}
              <div className="flex items-center space-x-2">
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
                {/* Dropdown de Ferramentas para usuários não logados */}
                <ToolsDropdown isPremium={false} />
                
                {/* Link para Preços - Scroll na LP, link direto em outras páginas */}
                {pathname === '/' ? (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
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
                    <Link href="/#pricing">Preços</Link>
                  </Button>
                )}
              </div>
              
              {/* Auth Buttons */}
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Registrar</Link>
                </Button>
              </div>
            </div>
          )}
          </nav>
          </div>
        </div>
      </header>

      {/* Global Search Bar - Below Header */}
      <GlobalSearchBar />

      {/* Mobile Navigation Drawer */}
      <MobileNav 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen}
      />
    </>
  )
}
