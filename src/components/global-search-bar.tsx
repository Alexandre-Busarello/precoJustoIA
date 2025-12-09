"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import CompanySearch from "@/components/company-search"

export function GlobalSearchBar() {
  const { data: session } = useSession()
  const [bannerHidden, setBannerHidden] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detectar se é mobile (breakpoint lg = 1024px, igual ao usado no header)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }

    // Verificar inicialmente
    checkMobile()

    // Observar mudanças de tamanho da janela
    window.addEventListener('resize', checkMobile)

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Verificar se o banner está fechado
  useEffect(() => {
    if (session && typeof window !== 'undefined') {
      const hidden = localStorage.getItem('market-ticker-banner-hidden-v2') === 'true'
      setBannerHidden(hidden)
      
      // Observar mudanças no localStorage
      const handleStorageChange = () => {
        const newHidden = localStorage.getItem('market-ticker-banner-hidden-v2') === 'true'
        setBannerHidden(newHidden)
      }
      
      window.addEventListener('storage', handleStorageChange)
      
      // Também observar mudanças na mesma aba usando um evento customizado
      const handleCustomStorageChange = () => {
        const newHidden = localStorage.getItem('market-ticker-banner-hidden-v2') === 'true'
        setBannerHidden(newHidden)
      }
      
      window.addEventListener('marketTickerVisibilityChange', handleCustomStorageChange)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('marketTickerVisibilityChange', handleCustomStorageChange)
      }
    }
  }, [session])

  // Posição dinâmica: 
  // - Mobile: 81px (header) quando banner oculto, 121px (header + banner) quando visível
  // - Desktop: 103px (header) quando banner oculto, 120px (header + banner) quando visível
  const topPosition = (session && bannerHidden) 
    ? (isMobile ? '81px' : '103px') 
    : (isMobile ? '121px' : '120px')

  return (
    <div 
      className="sticky z-[45] bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-b border-border/50 backdrop-blur-md transition-all duration-300 shadow-sm"
      style={{ top: topPosition }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {/* Search Input - CompanySearch já tem lupa e Ctrl+K integrados */}
          <CompanySearch 
            placeholder="Buscar empresa por ticker (ex: PETR4, VALE3) ou nome..." 
            className="w-full max-w-full"
          />
        </div>
      </div>
    </div>
  )
}

