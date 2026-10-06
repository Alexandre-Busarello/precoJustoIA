'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { House, Menu, Radar, Search, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isActiveHref, isAppChromeHidden } from '@/lib/navigation'
import { useShell } from '@/components/shell-context'

type Item =
  | { label: string; icon: LucideIcon; href: string; exact?: boolean }
  | { label: string; icon: LucideIcon; action: 'search' | 'menu' }

const ITEMS: Item[] = [
  { label: 'Início', icon: House, href: '/dashboard', exact: true },
  { label: 'Radar', icon: Radar, href: '/radar' },
  { label: 'Buscar', icon: Search, action: 'search' },
  { label: 'Carteira', icon: Wallet, href: '/carteira' },
  { label: 'Mais', icon: Menu, action: 'menu' },
]

const ITEM_CLASS =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none'

/**
 * Navegação inferior do app (só mobile, só logado). Renderiza um espaçador no fluxo
 * para que o fim da página nunca fique escondido atrás da barra nem do FAB do Ben.
 */
export function MobileBottomNav() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { openSearch, openMobileNav, searchOpen, mobileNavOpen } = useShell()

  if (!session || isAppChromeHidden(pathname)) return null

  return (
    <>
      {/* Reserva a barra (3,5rem) + o FAB do Ben acima dela (4rem) para nada ficar coberto no fim da página */}
      <div aria-hidden="true" className="h-[calc(7.5rem+env(safe-area-inset-bottom))] bg-surface lg:hidden" />
      <nav
        aria-label="Navegação do app"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex h-14">
          {ITEMS.map((item) => {
            const Icon = item.icon
            if ('href' in item) {
              const active = isActiveHref(pathname, item.href, item.exact)
              return (
                <li key={item.label} className="flex flex-1">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(ITEM_CLASS, active && 'text-brand')}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              )
            }
            const expanded = item.action === 'search' ? searchOpen : mobileNavOpen
            return (
              <li key={item.label} className="flex flex-1">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={item.action === 'search' ? openSearch : openMobileNav}
                  className={cn(ITEM_CLASS, expanded && 'text-brand')}
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
