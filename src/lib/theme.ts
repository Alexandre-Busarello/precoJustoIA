/**
 * Configuração de tema (dark mode por tokens via next-themes).
 *
 * - `THEME_DEFAULT`: tema inicial para quem nunca escolheu. A onda 3 troca para 'system'.
 * - `THEME_TOGGLE_ENABLED`: o seletor Claro/Escuro/Sistema só aparece quando todas as páginas passarem no QA dark.
 * - `FORCED_LIGHT_PREFIXES`: rotas que continuam sempre claras (ainda não migradas para tokens).
 */
export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_DEFAULT: ThemePreference = 'light'
export const THEME_TOGGLE_ENABLED = false
export const THEME_STORAGE_KEY = 'theme'
export const FORCED_LIGHT_PREFIXES = ['/admin', '/oferta']

/** true quando a rota deve ficar sempre no tema claro. */
export function isForcedLightRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return FORCED_LIGHT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
