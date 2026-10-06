# BATCH w1-screening (wave 1): Screening (ações e FIIs): two-panel live results, inline AI field (no modal), fix sectors 404, mobile overflow

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/components/screening/**
- src/components/screening-configurator.tsx
- src/components/screening-ai-assistant.tsx
- src/components/screening-results-blur.tsx
- src/components/screening-conversion-page.tsx
- src/components/fii-screening-configurator.tsx
- src/components/social-share-button.tsx
- src/app/screening-acoes/**
- src/app/screening-fiis/**
- src/lib/screening-presets.ts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.7 and section 4 (AI modal); mobile.md 3.8 (screening cards) and 3.11; QA bugs 1 and 5. NEVER click 'Configurar com IA' (it calls /api/screening-ai / Gemini); verify the inline field by rendering only.

1) Bugs (P0).
- screening-hub-page.tsx line ~176 fetches /api/sectors (404). Use /api/sectors-industries and adapt to its response shape so the sector and industry filters populate on /screening-acoes and /screening-fiis.
- Mobile result cards (lines ~896-945): add min-w-0 and break-words to the grid children; market cap via formatBRLCompact (e.g. 'R$ 29,3 tri').
- Complete translateMetricName (marketCap, grahamUpside, fcdUpside, gordonUpside and any camelCase key rendered).
- Hide the 'Status: Nenhum filtro ativo' rationale when there are results.

2) Layout (P0).
- Desktop: two panels. Filters on the left (w-[280px]; neutral collapsible groups; active filter count; 'Limpar') and results on the right (DataTable, count 'N ações', sortable), updated live after filter changes (debounce ~400 ms; keep the existing API).
- Mobile: results first + a 'Filtros (n)' button opening a bottom Sheet, whose footer holds a sticky 'Ver resultados' button.
- Remove the per-category colors (purple/green/blue/yellow/red) and the emoji in selects (🏢 🌎 💯).
- For anonymous users the tool comes before the marketing/SEO content (move the SEO content after the results).
- Replace the LandingHero usage with PageHeader (do not edit src/components/landing/*).

3) AI (P0). Remove the blocking custom modal 'Não sabe como configurar?' (screening-ai-assistant.tsx lines ~138-145: no role=dialog, no Esc, unlabeled X). Put an inline field at the top of the filter panel, 'Descreva o que procura (ex.: bancos com DY acima de 8%)', with the button 'Configurar com IA' calling the same existing handler. Plan gating stays.

4) Presets (P1). In src/lib/screening-presets.ts, change DISPLAY names only to descriptive ones ('Desconto vs. preço justo', 'Crescimento de receita acima de 20% a.a.', 'Dividendos acima da Selic', ...). Keep slugs and keys unchanged: the /screening-acoes/[slug] SEO pages depend on them. screening-conversion-page, screening-results-blur and social-share-button: tokens and a locked-preview pattern.

5) Strip title suffixes in screening-acoes/layout.tsx, [slug]/layout.tsx and screening-fiis/layout.tsx.

ACCEPTANCE:
- Results visible without scrolling at 1440x900.
- Sector filters populated (no 404 in the network log).
- After a search at 360: document.documentElement.scrollWidth == 360 (was 534).
- No camelCase metric keys in the UI; no custom modal; no emoji; dark legible.

## TEST PLAN
Routes: /screening-acoes, /screening-acoes/<one preset slug from screening-presets>, /screening-fiis. Modes: anonymous/free/premium; viewports 320/small/mobile/desktop; light/dark.
Check:
(1) The network log has no 404 for /api/sectors; the sector select has options.
(2) Change a filter (e.g. P/L max 10) -> results update without clicking a search button (desktop).
(3) Mobile: 'Filtros' opens a sheet; applying shows results; scrollWidth == innerWidth.
(4) innerText has no /[a-z]+[A-Z][a-zA-Z]+Upside|marketCap/.
(5) No element with position fixed inset-0 appears automatically within 10 s for premium.
(6) Presets show descriptive names while the slug URLs still return 200.
