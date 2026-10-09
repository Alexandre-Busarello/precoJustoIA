---
tags: [arquitetura, tema]
updated: 2026-10-09
fontes: [src/lib/theme.ts, src/components/theme-provider.tsx, src/components/theme-toggle.tsx, src/app/globals.css, src/app/layout.tsx]
---
# Tema e dark mode
> Dark mode por tokens com `next-themes`: seletor Claro / Escuro / Sistema, padrão = sistema. Liberado na [[Onda 4]] (commit `e0c3907`) depois do QA de todas as rotas.

## Como funciona
- `src/lib/theme.ts`: `THEME_DEFAULT = 'system'`, `THEME_TOGGLE_ENABLED = true`, `THEME_STORAGE_KEY = 'theme'`, `FORCED_LIGHT_PREFIXES = ['/admin', '/oferta']`, `THEME_COLOR = { light: '#ffffff', dark: '#0e0f12' }`, `isForcedLightRoute()`.
- `src/components/theme-provider.tsx`: `NextThemesProvider` com `attribute="class"` (classe `.dark` no `<html>`), `enableSystem`, `disableTransitionOnChange` e `forcedTheme='light'` nas rotas forçadas. `ThemeColorMeta` ajusta as metas `theme-color` quando o usuário escolhe Claro/Escuro.
- `src/components/theme-toggle.tsx`: Claro / Escuro / Sistema (ícones Sun / Moon / Monitor), variantes `icon` (header) e `list` (menu mobile e avatar); também aparece em `/perfil`.
- `src/app/globals.css`: tokens em `:root` e `.dark` (`--background`, `--foreground`, `--surface`, `--brand`, `--positive`, `--negative`, `--warning`, `--chart-1…5` etc.) e `@custom-variant dark (&:where(.dark, .dark *))`.
- `src/app/layout.tsx`: `<html suppressHydrationWarning>` e `viewport.themeColor` por `prefers-color-scheme`.
- `src/components/app-toaster.tsx`: toasts do `sonner` seguem o tema resolvido.
- Logo: versão escura com `dark:hidden` / `hidden dark:block` (depois virou SVG, `127bb16`).

## Regras / limites
- Requisito do dono: dark mode completo; o seletor só aparece quando todas as rotas passam (ver [[Decisões do dono]]).
- Gráficos usam `var(--chart-*)`/`currentColor`, nunca hex fixo; markdown com `dark:prose-invert` (lote `w3-dark-mode-final-qa`).
- `/admin` e `/oferta` ficam sempre claros (ainda não migrados para tokens).

## Histórico nas ondas
- [[Onda 0]]: encanamento (`6ad9d41`) com `THEME_DEFAULT = 'light'` e seletor desligado.
- [[Onda 1]]–[[Onda 3]]: telas migradas para tokens.
- [[Onda 4]]: varredura dark em todas as rotas e `e0c3907` (padrão sistema, seletor no header, menu, avatar e perfil; correções em data-table, checkbox, switch, home, como-funciona, ação/BDR).

## Pendências
- Capturas do produto (`public/images/product/*`, `how-it-works/*`) só existem claras.
- `src/app/admin/**` ainda tem gradientes e classes antigas.

## Relacionadas
[[Design system]] · [[Ambiente local e CI]] · [[Decisões do dono]] · [[Onda 4]]
