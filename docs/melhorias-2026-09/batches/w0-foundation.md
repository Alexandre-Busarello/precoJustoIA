# BATCH w0-foundation (wave 0): Foundation: design tokens + dark-mode plumbing, primitives, format lib, app shell, interruption policy, guardrails

## OWNED PATHS (edit only these; importing from anywhere is fine)
- package.json
- yarn.lock
- src/app/layout.tsx
- src/app/globals.css
- src/components/ui/**
- src/components/page-header.tsx
- src/components/asset/asset-header.tsx
- src/components/asset/score-card.tsx
- src/components/asset/asset-section-nav.tsx
- src/components/theme-provider.tsx
- src/components/theme-toggle.tsx
- src/components/app-toaster.tsx
- src/components/shell-context.tsx
- src/lib/theme.ts
- src/lib/format.ts
- src/lib/valuation-metrics.ts
- src/lib/navigation.ts
- src/lib/site-constants.ts
- src/lib/interruptions.ts
- src/lib/__tests__/format.test.ts
- src/lib/__tests__/valuation-metrics.test.ts
- src/components/header.tsx
- src/components/footer.tsx
- src/components/slim-footer.tsx
- src/components/mobile-nav.tsx
- src/components/mobile-bottom-nav.tsx
- src/components/global-search-bar.tsx
- src/components/company-search.tsx
- src/components/nav-dropdown.tsx
- src/components/oportunidades-dropdown.tsx
- src/components/analise-estrategia-dropdown.tsx
- src/components/carteiras-dropdown.tsx
- src/components/user-profile-dropdown.tsx
- src/components/notification-bell.tsx
- src/components/notification-markdown.tsx
- src/components/admin-link.tsx
- src/components/indices/market-ticker-bar.tsx
- src/components/company-logo.tsx
- src/components/info-tooltip.tsx
- src/components/ben-chat-fab.tsx
- src/components/ben-proactive-popup.tsx
- src/components/email-capture-modal.tsx
- src/components/exit-intent-provider.tsx
- src/components/exit-intent-modal.tsx
- src/hooks/use-exit-intent.ts
- public/logo-preco-justo-dark.png
- scripts/check-ui.sh
- scripts/check-ui.allowlist
- scripts/local/screenshots.ts
- scripts/local/README.md
- MECHANICAL-ONLY edits (remove <Footer/> import+usage): src/app/acao/[ticker]/page.tsx, src/app/analisar-acoes/client.tsx, src/app/analise-setorial/page.tsx, src/app/backtesting-carteiras/page.tsx, src/app/backtest/layout.tsx, src/app/backtest/page.tsx, src/app/bdr/[ticker]/page.tsx, src/app/comparador-etfs/page.tsx, src/app/comparador/page.tsx, src/app/compara-etfs/[...tickers]/page.tsx, src/app/etf/[ticker]/page.tsx, src/app/fii/[ticker]/page.tsx, src/app/indices/page.tsx, src/app/indices/[ticker]/page.tsx, src/app/radar-dividendos/page.tsx, src/app/suporte/page.tsx
- MECHANICAL-ONLY edits (remove <BenChatFAB/> import+usage): src/app/acao/[ticker]/analise-tecnica/page.tsx, src/app/bdr/[ticker]/analise-tecnica/page.tsx, src/app/etf/[ticker]/analise-tecnica/page.tsx, src/app/dashboard/page.tsx, src/components/dividend-radar-ticker-page-content.tsx, src/components/radar-page-content.tsx (plus the asset pages above)

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

This batch runs ALONE before everything else. Every later batch builds on its APIs, so keep component APIs stable, typed and documented with a short JSDoc. Work in this order and do not skip the P0 items. Spec: docs/melhorias-2026-09/reports/ux-ui.md (sections 2, 3, 4, 6), docs/melhorias-2026-09/reports/mobile.md (3.1-3.5, 3.10, 3.11), docs/melhorias-2026-09/reports/simplificacao.md (5.2 navigation).

1) Dependencies and scripts (P0). Run 'yarn add next-themes @radix-ui/react-popover' (use yarn, not npm; postinstall runs prisma generate, which is safe and does not touch any DB). Add package.json scripts: "test": "tsx --test \"src/**/__tests__/**/*.test.ts\"", "check:ui": "bash scripts/check-ui.sh". Do not remove dependencies (wave 3 does that).

2) Font + tokens + dark plumbing (P0).
- src/app/layout.tsx: move the Geist font variables from <body> to <html lang="pt-BR" suppressHydrationWarning>; body gets 'font-sans antialiased bg-background text-foreground'. Add 'export const viewport' = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: <dark --background as hex> }] }. Remove the manual theme-color meta and set msapplication-TileColor to #ffffff. Title template becomes '%s | Preço Justo AI' (keep the default title). Leave canonical, manifest link and gtag for batch w2-platform-seo-pwa.
- src/app/globals.css: replace the tokens with the full block from ux-ui.md section 2.2 (@theme inline + :root + .dark + @layer base). Change the dark variant to '@custom-variant dark (&:where(.dark, .dark *));'. Keep any sidebar-* tokens that are referenced in src (grep first). Add: table,[data-num]{font-variant-numeric:tabular-nums}; a 'no-scrollbar' utility; a prefers-reduced-motion rule that disables animate-bounce, animate-pulse (except [data-slot=skeleton]), marquee and smooth scrolling.
- src/lib/theme.ts: export THEME_DEFAULT = 'light' (wave 3 switches it to 'system'), THEME_TOGGLE_ENABLED = false (wave 3 enables it), FORCED_LIGHT_PREFIXES = ['/admin', '/oferta'].
- src/components/theme-provider.tsx ('use client'): next-themes ThemeProvider with attribute='class', defaultTheme=THEME_DEFAULT, enableSystem, disableTransitionOnChange, storageKey 'theme', and forcedTheme='light' when usePathname() starts with a FORCED_LIGHT_PREFIXES entry. Wrap the app in layout.tsx.
- src/components/theme-toggle.tsx: Claro / Escuro / Sistema (Sun / Moon / Monitor). Variants: 'icon' (header dropdown) and 'list' (mobile nav / avatar menu). It renders null unless THEME_TOGGLE_ENABLED.
- src/components/app-toaster.tsx: sonner Toaster using the resolved theme from next-themes; replace the Toaster in layout.tsx.
- Dark logo: if the header logo PNG has dark text, produce public/logo-preco-justo-dark.png (a light-text version made with sharp, or a faithful SVG recreation) and swap with 'dark:hidden' / 'hidden dark:block' in the header and footer.

3) Primitives in src/components/ui (P0). Follow ux-ui.md 2.3-2.4 and the mobile touch targets.
- button.tsx: variants default (brand), secondary (muted neutral), outline, ghost, destructive, link. Remove shadow-xs. Sizes: default h-11 md:h-9, sm h-10 md:h-8, lg h-12 md:h-10, icon size-11 md:size-9, icon-sm size-9 md:size-8 with a before: pseudo hit area reaching 44 px. No 'premium' gradient variant (decision: gradient buttons become default).
- badge.tsx: add variants neutral, positive, negative, warning, brand (subtle bg + semantic text, rounded-sm, text-xs font-medium). Keep the legacy names working: default -> brand, secondary -> neutral, outline -> neutral, destructive -> negative.
- card.tsx: remove mb-4 and shadow-sm; use rounded-lg py-5 gap-4; add prop density='compact' (py-4 gap-3). Removing mb-4 can change spacing across pages; that is expected and wave-1 batches re-space their pages.
- tabs.tsx: add variant 'underline' (2 px brand indicator, content navigation) and 'segmented' (muted background, view toggles). TabsList must scroll horizontally (overflow-x-auto no-scrollbar snap-x) with shrink-0 triggers so labels never overlap at 320 px, and show a fade at the edge when it overflows.
- input.tsx and select.tsx (trigger): h-11 md:h-9, text-base md:text-sm. textarea.tsx: text-base md:text-sm.
- dialog.tsx, sheet.tsx, alert-dialog.tsx: overlay bg-black/40 without blur, rounded-xl, close button 44x44 with aria-label 'Fechar'. Sheet supports side='bottom' with max-h-[85dvh] and safe-area padding.
- table.tsx: header cells bg-surface text-xs font-medium text-muted-foreground; rows h-10 with a thin divider; cells no longer force whitespace-nowrap (allow opt-in); numeric alignment helper class.
- dropdown-menu, tooltip, new popover.tsx (Radix): border + shadow-md, tokens.
- New: ui/stat.tsx (label xs muted, value text-2xl semibold tabular-nums, optional delta rendered with formatDeltaPct in positive/negative, optional hint via InfoHint, size sm/md, locked state = blurred value + lock icon); ui/section-header.tsx (title text-lg semibold, optional description, actions slot); ui/info-hint.tsx (Popover-based help for touch and mouse, 16 px Info icon inside a 44x44 hit area, aria-label); ui/data-table.tsx (generic typed columns {key, header, align, sortable, sticky, width, cell}; rows; dense (36 px) and default (40 px) rows; sticky header; stickyFirstColumn with horizontal scroll and edge shadow; client-side sort; loading skeleton rows; empty state {title, action}; optional expandable rows; onRowClick; numbers right-aligned tabular-nums).
- src/components/page-header.tsx: optional breadcrumb, H1 text-2xl semibold tracking-tight, one-line description, actions slot.
- src/components/info-tooltip.tsx: re-implement as a thin wrapper over InfoHint and keep the same props.

4) Libraries (P0).
- src/lib/format.ts with Intl pt-BR: formatBRL, formatBRLCompact (mi/bi/tri, e.g. 'R$ 625,7 bi'), formatPct(fraction, {digits=1}), formatDeltaPct(fraction) (always signed, U+2212 minus), formatMultiple ('10,8x'), formatNumber, formatDate (short '29 set. 2026' and relative 'há 5 dias'), formatNullable(value, fn) -> '—'. All accept null/undefined/NaN and return '—'. Tests in src/lib/__tests__/format.test.ts (node:test).
- src/lib/valuation-metrics.ts: marginOfSafety(price, fair) = 1 - price/fair; upside(price, fair) = fair/price - 1; both null-safe; valuationStatus(margin) -> 'below' | 'within' | 'above' with the pt-BR labels 'Abaixo do preço justo' / 'Dentro da faixa estimada' / 'Acima do preço justo' (within = |margin| < 5%). Tests: VJ 100, P 75 -> margin 0.25, upside 0.3333.
- src/lib/site-constants.ts: COVERED_COMPANIES_LABEL = 'mais de 350 empresas' (conservative; home said +500 and planos said 350+; flag in the report for the owner to confirm), DATA_SOURCES_LABEL, UPDATE_FREQUENCY_LABEL.
- src/lib/interruptions.ts: claimModalSlot(id): boolean / releaseModalSlot(id); at most one auto-shown modal per page view (module state + sessionStorage wrapped in try/catch). The exit intent uses it now; onboarding/notification/quiz adopt it in w1-account-ben-onboarding.

5) Asset building blocks (P0; used by 3 wave-1 batches).
- src/components/asset/asset-header.tsx per ux-ui.md 5.2/5.9: props { ticker, name, subtitle, logoUrl?, price, dayChange? (fraction), fairValue?, fairValueLabel?, fairValueSlot? (model selector), marginOfSafety? (fraction), score?: {value, label}, updatedAt?, actions?: {label, icon?, href?, onClick?}[], badges? (max 2), locked?: {fairValue?: boolean, score?: boolean, cta?: {label, href}} }. Row 1: logo 40 px + ticker (text-2xl semibold, shrink-0, never truncates) + name (muted, truncates). Row 2: 4 Stats (Preço with day delta, Preço justo, Margem de segurança, Score) in a 2x2 grid on mobile and 4 columns on desktop, with 'Atualizado em' below. Actions: outline sm buttons on desktop; on mobile a compact scrollable row of icon+label buttons (no fixed bar). Price is text-foreground.
- src/components/asset/score-card.tsx: one visual (big number 0-100 + label + thin neutral bars per pillar with brand fill) with variants 'compact' (header) and 'full' (pillars list).
- src/components/asset/asset-section-nav.tsx: sticky (top-14 lg:top-16) underline anchor tabs from a sections prop [{id, label}], horizontal scroll on mobile, active item via IntersectionObserver, scroll-margin handled.
- src/components/company-logo.tsx: fallback = 2-letter ticker monogram in bg-muted text-muted-foreground rounded-md (no gradient building icon).

6) App shell (P0). Spec: ux-ui.md section 3, mobile.md 3.1-3.3, simplificacao.md 5.2.
- src/lib/navigation.ts: single source {marketing, app, account}. marketing = Descobrir (Screening de ações, Screening de FIIs, Rankings, Radar de dividendos, Índices), Ferramentas (Comparador, Backtest, Análise setorial, P/L da bolsa, Calculadora de dividend yield, Calculadora de recuperação, Arbitragem de dívida), Aprender (Blog, Metodologia, Como funciona), Planos (/planos). app = Início (/dashboard), Descobrir, Carteiras (Minhas carteiras /carteira, Backtest, Índices teóricos /indices), Alertas (Meu radar /radar, Alertas de preço /dashboard/subscriptions, Monitoramentos /dashboard/monitoramentos-customizados, Notificações /notificacoes), Ferramentas (Comparador, Análise setorial, P/L da bolsa, Projeções do Ibovespa, calculators). account = Perfil, Assinatura (/perfil#assinatura), Conversas com o Ben, Suporte (/suporte for premium, /contato otherwise), Sair. At most 5 top-level items per mode.
- header.tsx: h-14 lg:h-16, bg-background border-b, no backdrop-blur, logo h-7 lg:h-8. Desktop nav rendered from navigation.ts through a rewritten generic nav-dropdown.tsx (the header no longer uses oportunidades/analise-estrategia/carteiras dropdowns; leave those files in place, wave 3 deletes them). Search inside the header: on desktop a compact search button with a Ctrl/Cmd K hint that opens a search dialog; on mobile a magnifier icon that opens a full-screen Sheet with an input (inputMode='search', enterKeyHint='search', 16 px, large results). Reuse company-search.tsx results inside global-search-bar.tsx, which becomes that dialog/sheet; remove the separate sticky search strip and its JS 'top' calculation. Remove MarketTickerBar from the header. Remove the gradient 'Premium' badge and the gradient support dot. 'Preços'/'Planos' links to /planos. Session loading shows a fixed-width Skeleton instead of 'Carregando...'. On /login, /register, /esqueci-senha, /redefinir-senha, /verificar-email and /checkout* render only the logo (no nav, search or ticker). Add ThemeToggle (renders null while disabled).
- mobile-nav.tsx: rewrite on ui/sheet side='left' w-[85vw] max-w-80 h-dvh with ONE scroll container that includes the account section (fixes the 223 px scroll area). Items min-h-12, from navigation.ts, collapsible groups, no onTouchEnd handlers, menu button 44x44, theme toggle row (null while disabled). Open state lives in shell-context.tsx so the bottom nav can open it.
- mobile-bottom-nav.tsx (new, lg:hidden, only with a session, hidden on auth/checkout/oferta/admin): Início /dashboard, Radar /radar, Buscar (opens the search sheet via shell-context), Carteira /carteira, Mais (opens the drawer). h-14 + pb-[env(safe-area-inset-bottom)], active state brand, aria-current. It renders a spacer so page content is never hidden.
- footer.tsx: same logo as the header, links from navigation.ts (no duplicates, no href='#'; include /planos, /indices, /radar-dividendos, /screening-fiis, /backtest instead of /backtesting-carteiras), grid-cols-2 on mobile, dynamic year, legal notice in text-xs text-muted-foreground without a colored box or emoji, no badges. Render <Footer/> once in layout.tsx (hidden on auth routes, /checkout* and /oferta, which keeps SlimFooter) and remove the per-page <Footer/> import+usage in the 16 files listed in ownedPaths. That mechanical edit is the ONLY change allowed in those files.
- indices/market-ticker-bar.tsx: static (no marquee/scroll-ticker animation), not sticky, no backdrop-blur, horizontally scrollable on mobile, exported for /dashboard and /indices (added later by their batches).
- user-profile-dropdown.tsx, notification-bell.tsx, notification-markdown.tsx, admin-link.tsx, slim-footer.tsx: tokens, 44 px targets, theme toggle entry in the avatar menu.

7) Interruption policy (P0). Decisions: no automatic interruptions. Spec: ux-ui.md section 4.
- email-capture-modal.tsx: remove the 6 s auto-open. The component becomes controlled (open/onOpenChange) with a backward-compatible default export that renders nothing unless opened. Built on ui/dialog, autoComplete='email', inputMode='email'. Wiring the inline 'Acompanhar' card is w1-asset-stock's job.
- ben-chat-fab.tsx: render nothing without a session, and never call useBenProactivePopup (this removes the 401 on /api/ben/interactions). Mount <BenChatFAB/> ONCE in layout.tsx and remove it from the 11 files listed. If pages passed props (ticker/context), derive them from usePathname() inside the FAB. FAB size-12 at right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]; when the bottom nav is visible, sit above it. Hidden on /checkout*, /login, /register, /oferta, /admin. ben-proactive-popup.tsx: stop rendering anywhere (keep the file; wave 3 deletes it if unused).
- exit-intent-provider.tsx / exit-intent-modal.tsx / hooks/use-exit-intent.ts: replace the blocking Dialog with a non-blocking card in the bottom-right corner (not modal, Esc/X close, same 1-click feedback). Desktop only (min-width 1024 and pointer: fine); only anonymous or trial users; never on /checkout*; at most once every 30 days via localStorage key 'pja-exit-intent-last-shown' (try/catch); uses claimModalSlot. Do not submit the feedback while testing.

8) Guardrails and harness (P1).
- scripts/check-ui.sh: 'bash scripts/check-ui.sh [files...]'; with no args it checks changed and untracked .tsx/.ts/.css files under src (git diff --name-only HEAD + git ls-files --others --exclude-standard). It fails (exit 1, prints file:line) on: bg-gradient-to-, bg-clip-text, backdrop-blur, font-black|font-extrabold, shadow-(lg|xl|2xl) outside src/components/ui/(dialog|sheet|popover|dropdown-menu|alert-dialog), emoji in .tsx outside console.* lines (grep -P with emoji ranges), text-(purple|violet|indigo|pink)-. Per-file allowlist in scripts/check-ui.allowlist. Add '--all' to scan all of src and print counts per rule (used to measure the >90% gradient reduction).
- scripts/local/screenshots.ts: add '--theme light|dark|both' (addInitScript setting localStorage 'theme' + emulateMedia colorScheme; output dir <viewport>-dark for dark) and a 'small' viewport (360x740, DPR 2, touch) usable via --viewports small,mobile,desktop. Update scripts/local/README.md.

ACCEPTANCE:
- getComputedStyle(document.body).fontFamily starts with Geist and document.fonts shows Geist loaded.
- bg-brand, text-positive, text-negative, bg-surface compile; the default Button is ink-blue.
- No primitive has an outer margin or large shadow.
- At 360x740, after scrollTo(0,1000), the fixed/sticky chrome at the top is <= 56 px on every baseline route.
- Browsing 3 stock pages anonymously at 390x844 shows no modal.
- Ben FAB only for logged-in users; no 401 from /api/ben/interactions for anonymous users.
- Exit intent is not blocking and shows once in 30 days.
- The mobile drawer scroll area is >= 500 px when logged in.
- The bottom nav is visible only for logged-in mobile users and never covers content.
- Header, footer, drawer, bottom nav, dialogs and primitives are legible with --theme dark.
- All 40 baseline routes still return 200.
- npx tsc --noEmit is clean; npx tsx --test src/lib/__tests__/format.test.ts src/lib/__tests__/valuation-metrics.test.ts pass; check-ui.sh passes on the new files.

## TEST PLAN
Run the full baseline route set (see scripts/local/README.md) with --auth both --viewports small,mobile,desktop --theme both and compare against <SCRATCH>/shots/baseline.
Verify:
(1) Geist is loaded (evaluate document.fonts and body fontFamily).
(2) Chrome height <= 56 px at 360x740 after scrolling on /, /acao/petr4, /dashboard, /ranking, /screening-acoes (docs/melhorias-2026-09/tools/mobile-audit.mjs STICKY metric).
(3) Anonymous visits to /acao/petr4 -> /acao/itub4 -> /fii/hglg11 with 10 s waits: no dialog appears.
(4) Premium on /acao/petr4 and /dashboard: no Ben popup; the FAB sits above the bottom nav and has a safe-area offset.
(5) Anonymous: the network log has no /api/ben/interactions 401.
(6) /planos desktop anonymous: move the mouse out of the viewport -> a corner card (not a dialog) appears; repeat -> it does not appear again (localStorage key set). It never appears on /checkout.
(7) Logged-in mobile menu: the scroll container height is >= 500 px, all items >= 44 px, Esc closes it, focus is trapped.
(8) Bottom nav: 5 items; Buscar opens the search sheet; Mais opens the drawer; the last content of /dashboard is not hidden behind it.
(9) Header search: desktop Ctrl+K opens the dialog; typing 'petr' lists PETR4; Enter navigates. Mobile icon -> full-screen sheet with an input font-size of 16 px.
(10) The footer appears exactly once on /acao/petr4 and /ranking, and is absent on /login and /checkout.
(11) The market ticker is gone from the header on all routes.
(12) Dark screenshots: no white leaks in the header, footer, drawer, dialogs or cards on /, /login, /dashboard.
(13) At 320 px: no horizontal overflow introduced by the shell.
(14) Run the unit tests and npx tsc --noEmit.
(15) bash scripts/check-ui.sh --all prints the baseline counts (record them in the report for the wave-3 comparison).
