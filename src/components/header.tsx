"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MobileNav, MobileMenuButton } from "@/components/mobile-nav"
import { LayoutDashboard, BarChart3, Shield, Zap } from "lucide-react"

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isPremium = session?.user?.subscriptionTier === 'PREMIUM'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          {/* Logo and Mobile Menu */}
          <div className="flex items-center gap-3">
            <MobileMenuButton 
              isOpen={mobileMenuOpen} 
              setIsOpen={setMobileMenuOpen}
            />
            <Link href="/" className="text-xl lg:text-2xl font-bold text-primary hover:text-primary/80 transition-colors">
              Analisador de Ações
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
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
                
                <Button 
                  variant={pathname === "/ranking" ? "default" : "ghost"} 
                  size="sm" 
                  asChild
                >
                  <Link href="/ranking" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Rankings
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
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/ranking" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Análise Gratuita
                  </Link>
                </Button>
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
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNav 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen}
      />
    </>
  )
}
