"use client"

import CompanySearch from "@/components/company-search"

export function GlobalSearchBar() {
  return (
    <div className="sticky top-[81px] md:top-[103px] z-30 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-b border-border/50 backdrop-blur-md transition-all duration-300 will-change-transform">
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

