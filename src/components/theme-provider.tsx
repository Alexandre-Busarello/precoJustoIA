'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { THEME_COLOR, THEME_DEFAULT, THEME_STORAGE_KEY, isForcedLightRoute } from '@/lib/theme'

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
      <ThemeColorMeta pathname={pathname} />
      {children}
    </NextThemesProvider>
  )
}

/**
 * As metas theme-color do layout seguem só o prefers-color-scheme do sistema. Quando o usuário escolhe
 * Claro/Escuro, as duas metas passam a ter a cor do tema escolhido, e a barra do navegador mobile acompanha.
 */
function ThemeColorMeta({ pathname }: { pathname: string | null }) {
  const { resolvedTheme, forcedTheme } = useTheme()
  const theme = forcedTheme ?? resolvedTheme

  useEffect(() => {
    if (theme !== 'light' && theme !== 'dark') return
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLOR[theme])
    })
    // pathname: a navegação pode recriar as metas do layout com as cores padrão.
  }, [theme, pathname])

  return null
}
