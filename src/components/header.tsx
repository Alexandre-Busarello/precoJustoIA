"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MobileNav, MobileMenuButton } from "@/components/mobile-nav"
import { ToolsDropdown } from "@/components/tools-dropdown"
import { LayoutDashboard, Shield, Zap, Headphones } from "lucide-react"
import { GlobalSearchBar } from "@/components/global-search-bar"

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { isPremium } = usePremiumStatus() // ÚNICA FONTE DA VERDADE
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 relative">
          {/* Mobile Layout */}
          <div className="lg:hidden flex items-center">
            {/* Mobile Menu Button - Absolute Left */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
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
                
                {/* Dropdown de Ferramentas */}
                <ToolsDropdown isPremium={isPremium} />

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

              {/* User Info */}
              <div className="flex items-center space-x-3">
                <div className="hidden xl:flex items-center gap-2">
                  <Badge variant={isPremium ? "default" : "secondary"} className="text-xs">
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
                  <span className="text-sm text-muted-foreground">
                    {session.user?.name || session.user?.email?.split('@')[0]}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                >
                  Sair
                </Button>
              </div>
            </div>
          ) : (
            // Not logged in navigation
            <div className="flex items-center space-x-4">
              {/* Public Links */}
              <div className="flex items-center space-x-1">
                {/* Dropdown de Ferramentas para usuários não logados */}
                <ToolsDropdown isPremium={false} />
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
