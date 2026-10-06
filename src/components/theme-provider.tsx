'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { THEME_DEFAULT, THEME_STORAGE_KEY, isForcedLightRoute } from '@/lib/theme'

/** Tema claro/escuro por classe `.dark` no <html>. Rotas ainda não migradas (admin, oferta) ficam sempre claras. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={THEME_DEFAULT}
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
      forcedTheme={isForcedLightRoute(pathname) ? 'light' : undefined}
    >
      {children}
    </NextThemesProvider>
  )
}
