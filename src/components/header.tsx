"use client"

import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Search } from "lucide-react"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { isMinimalChromeRoute, isStandaloneRoute, navigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/ui/brand-logo"
import { Skeleton } from "@/components/ui/skeleton"
import { MobileNav, MobileMenuButton } from "@/components/mobile-nav"
import { NavDropdown } from "@/components/nav-dropdown"
import { UserProfileDropdown } from "@/components/user-profile-dropdown"
import { NotificationBell } from "@/components/notification-bell"
import { GlobalSearchBar, SearchTrigger } from "@/components/global-search-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useShell } from "@/components/shell-context"

/** Header global: 56 px no mobile / 64 px no desktop, busca integrada e navegação de @/lib/navigation. */
export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const { isPremium, isTrialActive, trialDaysRemaining, subscriptionTier } = usePremiumStatus()
  const { trackEngagement } = useEngagementPixel()
  const { openSearch } = useShell()

  if (isStandaloneRoute(pathname)) return null

  const minimal = isMinimalChromeRoute(pathname)
  const sections = session ? navigation.app : navigation.marketing
  const handleAnonClick = () => {
    if (!session) trackEngagement()
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-background lg:h-16">
        <div className="container mx-auto flex h-full items-center gap-1 px-4 sm:gap-2">
          {!minimal && <MobileMenuButton className="-ml-2 lg:hidden" />}

          <BrandLogo priority className="h-7 lg:h-8" />

          {!minimal && (
            <>
              <nav aria-label="Principal" className="ml-4 hidden items-center gap-0.5 lg:flex xl:ml-6">
                {sections.map((section) => (
                  <NavDropdown key={section.label} section={section} />
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <SearchTrigger className="hidden lg:inline-flex" />
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buscar ativo" onClick={openSearch}>
                  <Search className="size-5 text-muted-foreground" strokeWidth={1.75} />
                </Button>

                <ThemeToggle variant="icon" className="hidden lg:inline-flex" />

                {status === "loading" ? (
                  <Skeleton className="h-9 w-9 lg:w-[132px]" aria-hidden="true" />
                ) : session ? (
                  <>
                    <NotificationBell />
                    <div className="hidden lg:block">
                      <UserProfileDropdown
                        userName={session.user?.name}
                        userEmail={session.user?.email}
                        isPremium={isPremium || false}
                        isTrialActive={isTrialActive || false}
                        trialDaysRemaining={trialDaysRemaining || null}
                        subscriptionTier={(subscriptionTier as 'FREE' | 'PREMIUM' | 'VIP') || 'FREE'}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/login" onClick={handleAnonClick}>Entrar</Link>
                    </Button>
                    <Button size="sm" asChild className="hidden sm:inline-flex">
                      <Link href="/register" onClick={handleAnonClick}>Criar conta</Link>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {!minimal && (
        <>
          <GlobalSearchBar />
          <MobileNav />
        </>
      )}
    </>
  )
}
