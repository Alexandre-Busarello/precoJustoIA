"use client"

import { useEffect, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronDown, LogOut, Menu, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { useEngagementPixel } from "@/hooks/use-engagement-pixel"
import { useAdminCheck } from "@/hooks/use-user-data"
import {
  getAccountLinks,
  isActiveHref,
  isSectionActive,
  navigation,
  type NavSection,
} from "@/lib/navigation"
import { THEME_TOGGLE_ENABLED } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { useShell } from "@/components/shell-context"
import { BrandLogo } from "@/components/ui/brand-logo"
import { getPlanLabel, getUserInitials } from "@/components/user-profile-dropdown"

const ROW = "flex min-h-12 w-full items-center rounded-md px-3 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"

function NavGroup({ section, pathname, onNavigate }: { section: NavSection; pathname: string; onNavigate: () => void }) {
  const active = isSectionActive(pathname, section)
  const [open, setOpen] = useState(active)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(ROW, "justify-between rounded-md font-medium text-foreground hover:no-underline")}
      >
        {section.label}
        <ChevronDown className="size-4 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="pb-1">
          {(section.items ?? []).map((item) => {
            const itemActive = isActiveHref(pathname, item.href, item.exact)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={itemActive ? "page" : undefined}
                  className={cn(ROW, "pl-6 text-muted-foreground", itemActive && "bg-accent font-medium text-foreground")}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Menu de navegação mobile (Sheet lateral): um único contêiner rolável com navegação e conta. */
export function MobileNav() {
  const { data: session } = useSession()
  const pathname = usePathname() ?? "/"
  const { mobileNavOpen, setMobileNavOpen } = useShell()
  const { isPremium, isTrialActive, trialDaysRemaining, subscriptionTier } = usePremiumStatus()
  const { data: adminData } = useAdminCheck()
  const { trackEngagement } = useEngagementPixel()
  const isAdmin = adminData?.isAdmin || false

  // Fecha ao trocar de rota
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname, setMobileNavOpen])

  const close = () => {
    if (!session) trackEngagement()
    setMobileNavOpen(false)
  }

  const sections = session ? navigation.app : navigation.marketing
  const tier = (subscriptionTier as "FREE" | "PREMIUM" | "VIP") || "FREE"
  const accountLinks = getAccountLinks(Boolean(session && isPremium))
  const isPremiumViaTrial = Boolean(isTrialActive) && tier === "FREE"

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-[85vw] max-w-80 gap-0 p-0 lg:hidden">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4 pr-14">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal e conta</SheetDescription>
          <BrandLogo className="h-7" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3" data-mobile-nav-scroll>
          {session ? (
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-border px-3 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {getUserInitials(session.user?.name, session.user?.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.user?.name || session.user?.email?.split("@")[0]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {getPlanLabel({
                    isPremium: Boolean(isPremium),
                    isTrialActive: Boolean(isTrialActive),
                    subscriptionTier: tier,
                    trialDaysRemaining: trialDaysRemaining ?? null,
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-2 px-1">
              <Button asChild>
                <Link href="/register" onClick={close}>Criar conta</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login" onClick={close}>Entrar</Link>
              </Button>
            </div>
          )}

          <nav aria-label="Principal">
            <ul className="space-y-0.5">
              {sections.map((section) => (
                <li key={section.label}>
                  {section.href ? (
                    <Link
                      href={section.href}
                      onClick={close}
                      aria-current={isSectionActive(pathname, section) ? "page" : undefined}
                      className={cn(ROW, "font-medium text-foreground", isSectionActive(pathname, section) && "bg-accent")}
                    >
                      {section.label}
                    </Link>
                  ) : (
                    <NavGroup section={section} pathname={pathname} onNavigate={close} />
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {session && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Conta</p>
              <ul className="space-y-0.5">
                {accountLinks.map((link) =>
                  link.href ? (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        onClick={close}
                        className={cn(ROW, "text-foreground", isActiveHref(pathname, link.href) && "bg-accent font-medium")}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : null
                )}
                {(!isPremium || isPremiumViaTrial) && (
                  <li>
                    <Link href="/planos" onClick={close} className={cn(ROW, "font-medium text-brand")}>
                      {isPremiumViaTrial ? "Assinar o Premium" : "Conhecer o Premium"}
                    </Link>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <Link href="/admin" onClick={close} className={cn(ROW, "gap-3 text-foreground")}>
                      <Shield className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                      Painel admin
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {THEME_TOGGLE_ENABLED && (
            <div className="mt-3 border-t border-border px-1 pt-3">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Tema</p>
              <ThemeToggle variant="list" />
            </div>
          )}

          {session && (
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false)
                  signOut()
                }}
                className={cn(ROW, "gap-3 text-foreground")}
              >
                <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                Sair
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Botão hambúrguer (44 × 44 px) que abre o menu mobile. */
export function MobileMenuButton({ className }: { className?: string }) {
  const { mobileNavOpen, openMobileNav } = useShell()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Abrir menu"
      aria-expanded={mobileNavOpen}
      onClick={openMobileNav}
    >
      <Menu className="size-5" strokeWidth={1.75} />
    </Button>
  )
}
