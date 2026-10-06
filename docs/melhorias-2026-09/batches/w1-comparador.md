# BATCH w1-comparador (wave 1): Comparator: single table without medals, ETFs as a tab in /comparador, mobile sticky column, remove aggregateRating

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/comparador/**
- src/app/comparador-etfs/**
- src/app/compara-acoes/**
- src/app/compara-etfs/**
- src/components/comparison-table.tsx
- src/components/enhanced-stock-comparison-selector.tsx
- src/components/etf-comparison-selector.tsx
- src/components/seo-section-wrapper.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.8; mobile.md 3.8 (comparison-table and compara-etfs); simplificacao.md section 2 (comparador + comparador-etfs merge). src/app/comparador/page-old.tsx is dead: delete it (verify with grep that nothing imports it).

1) Results pages /compara-acoes/[...tickers] and /compara-etfs/[...tickers] (P0).
- One table: rows = indicators grouped (Valuation, Rentabilidade, Endividamento, Dividendos, Crescimento); columns = assets (up to 6).
- Sticky first column: w-[112px] whitespace-normal, description hidden sm:block.
- Values right-aligned tabular-nums via lib/format.
- The best value per row is font-semibold with a small brand dot (not color alone: add a visually hidden 'melhor' label).
- Summary line at the top: '<TICKER> lidera em N de M indicadores'.
- Remove '#1 Ouro / #2 Prata', trophies, crowns and yellow backgrounds.
- The ticker never truncates (it showed 'V...').
- Keep the 1,700-line page working; extract the table rendering into comparison-table.tsx if useful.

2) Hub (P0).
- /comparador gets Tabs 'Ações | ETFs' (tab state in ?tipo=etfs). The ETFs tab reuses EtfComparisonSelector and the ETF SEO content from /comparador-etfs.
- /comparador-etfs keeps working for now by rendering the same hub with the ETFs tab selected (w2-platform-seo-pwa adds the permanent redirect later).
- Update links in compara-etfs (lines ~259, ~267) to /comparador?tipo=etfs.
- Remove aggregateRating from the comparador JSON-LD (line ~519).
- The LandingHero usage becomes PageHeader, and the landing-kit components are rendered, not edited.
- seo-section-wrapper: tokens.

3) Strip title suffixes.

ACCEPTANCE:
- Comparing 2 stocks fits in <= 2 screens at 1440x900.
- No overflow at 320/360 (was 347 px at 320).
- No medal/trophy/crown icons or 'Ouro/Prata' text.
- /comparador?tipo=etfs lands on the ETFs tab and leads to /compara-etfs/a/b.
- No aggregateRating; dark legible.

## TEST PLAN
Routes: /comparador, /comparador?tipo=etfs, /comparador-etfs, /compara-acoes/petr4/vale3, /compara-acoes/petr4/vale3/itub4/wege3, /compara-etfs/bova11/divo11. Modes: anonymous/premium; viewports 320/small/mobile/desktop; light/dark.
Check:
(1) Page height at 1440 for 2 tickers <= 1800 px.
(2) scrollWidth == innerWidth at 320.
(3) innerText has no /Ouro|Prata|Bronze/.
(4) The best-value marker exists per row and has an accessible text.
(5) The ETFs tab selector submits to /compara-etfs/...
(6) View source: no aggregateRating.
