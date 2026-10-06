'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const ALERT_TABS = [
  { href: '/radar', label: 'Meu radar' },
  { href: '/dashboard/subscriptions', label: 'Alertas de preço' },
  { href: '/dashboard/monitoramentos-customizados', label: 'Monitoramentos' },
  { href: '/notificacoes', label: 'Notificações' },
] as const

/** Navegação entre as páginas de acompanhamento (abas sublinhadas; rola na horizontal no mobile). */
export function AlertsTabs({ className }: { className?: string }) {
  const pathname = usePathname() ?? ''
  const navRef = useRef<HTMLElement>(null)

  // No mobile a faixa rola: traz a aba ativa para a área visível (sem mexer na rolagem vertical da página)
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    const overflow = active.offsetLeft + active.offsetWidth - (nav.scrollLeft + nav.clientWidth)
    if (overflow > 0) nav.scrollLeft += overflow + 16
  }, [pathname])

  return (
    <nav ref={navRef} aria-label="Acompanhamento" className={cn('no-scrollbar relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <ul className="flex w-max min-w-full gap-1 border-b border-border">
        {ALERT_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'border-brand text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
