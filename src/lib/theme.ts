/**
 * Configuração de tema (dark mode por tokens via next-themes).
 *
 * - `THEME_DEFAULT`: tema inicial para quem nunca escolheu (segue a preferência do sistema).
 * - `THEME_TOGGLE_ENABLED`: exibe o seletor Claro/Escuro/Sistema (header, menu mobile, menu do avatar e /perfil).
 * - `FORCED_LIGHT_PREFIXES`: rotas que continuam sempre claras (ainda não migradas para tokens).
 */
export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_DEFAULT: ThemePreference = 'system'
export const THEME_TOGGLE_ENABLED = true
export const THEME_STORAGE_KEY = 'theme'
export const FORCED_LIGHT_PREFIXES = ['/admin', '/oferta']

/** true quando a rota deve ficar sempre no tema claro. */
export function isForcedLightRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return FORCED_LIGHT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
