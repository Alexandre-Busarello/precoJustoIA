'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

import { startPageView } from '@/lib/interruptions'

interface ShellContextValue {
  /** Drawer de navegação mobile. */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  /** Busca global (dialog no desktop, sheet em tela cheia no mobile). */
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  openSearch: () => void
  openMobileNav: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

/** Estado compartilhado do shell (header, drawer, bottom nav e busca). */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  // Cada troca de rota é uma nova visualização para a política de interrupções.
  useEffect(() => {
    if (pathname) startPageView(pathname)
  }, [pathname])

  const openSearch = useCallback(() => {
    setMobileNavOpen(false)
    setSearchOpen(true)
  }, [])
  const openMobileNav = useCallback(() => {
    setSearchOpen(false)
    setMobileNavOpen(true)
  }, [])

  const value = useMemo(
    () => ({ mobileNavOpen, setMobileNavOpen, searchOpen, setSearchOpen, openSearch, openMobileNav }),
    [mobileNavOpen, searchOpen, openSearch, openMobileNav]
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

/** Acesso ao estado do shell. Deve ser usado dentro de <ShellProvider>. */
export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell deve ser usado dentro de <ShellProvider>')
  return ctx
}
