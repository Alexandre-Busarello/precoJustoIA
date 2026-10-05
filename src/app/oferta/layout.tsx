import type { Metadata } from "next"
import { BrandLogo } from "@/components/ui/brand-logo"

export const metadata: Metadata = {
  alternates: {
    canonical: "/oferta",
  },
}

export default function OfertaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Cabeçalho mínimo da landing de anúncios: só o logo, centralizado. */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="container mx-auto flex h-14 items-center justify-center px-4 sm:h-16">
          <BrandLogo className="h-7 sm:h-8" priority />
        </div>
      </header>
      {children}
    </>
  )
}
