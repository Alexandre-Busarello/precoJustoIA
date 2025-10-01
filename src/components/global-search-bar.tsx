"use client"

import { usePathname } from "next/navigation"
import CompanySearch from "@/components/company-search"
import { useAlfa } from "@/contexts/alfa-context"

export function GlobalSearchBar() {
  const pathname = usePathname()
  const { stats, isLoading } = useAlfa()
  
  // Páginas que mostram o banner ALFA variant="landing"
  const pagesWithAlfaBanner = ['/', '/planos', '/early-adopter', '/register']
  const isPageWithBanner = pagesWithAlfaBanner.includes(pathname)
  
  // Detectar se o banner ALFA está visível
  // Só considerar visível se:
  // 1. Não está carregando
  // 2. Fase é ALFA
  // 3. Página atual tem o banner
  const isAlfaBannerVisible = !isLoading && stats?.phase === 'ALFA' && isPageWithBanner
  
  // Ajustar o top baseado na presença do banner ALFA
  // Banner ALFA tem ~48px de altura (py-3 + conteúdo)
  const topClass = isAlfaBannerVisible 
    ? "top-[129px] md:top-[151px]" // Header (81/103px) + Banner ALFA (~48px)
    : "top-[81px] md:top-[103px]"  // Apenas Header
  
  return (
    <div className={`sticky ${topClass} z-30 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-b border-border/50 backdrop-blur-md transition-all duration-300 will-change-transform`}>
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

