# BATCH w2-ui-market-tools (wave 2): Market tools UI: índices, P/L da bolsa, análise setorial, projeções IBOV, calculadoras (+ /calculadoras index), arbitragem de dívida

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/indices/**
- src/components/indices/index-asset-performance.tsx
- src/components/indices/index-card.tsx
- src/components/indices/index-comparison-chart.tsx
- src/components/indices/index-composition-table.tsx
- src/components/indices/index-daily-view.tsx
- src/components/indices/index-detail-client.tsx
- src/components/indices/index-disclaimer.tsx
- src/components/indices/index-performance-header.tsx
- src/components/indices/index-realtime-badge.tsx
- src/components/indices/index-realtime-return.tsx
- src/components/indices/index-rebalance-timeline.tsx
- src/components/indices/index-sparkline.tsx
- src/components/indices/indices-client.tsx
- src/app/pl-bolsa/**
- src/components/pl-bolsa-chart.tsx
- src/components/pl-bolsa-filters.tsx
- src/components/pl-bolsa-page-client.tsx
- src/app/analise-setorial/**
- src/components/sector-analysis-client.tsx
- src/components/sector-selector.tsx
- src/app/projecoes-ibov/**
- src/app/calculadoras/**
- src/components/dividend-yield-calculator.tsx
- src/components/dividend-yield-results.tsx
- src/components/dividend-yield-register-modal.tsx
- src/components/asset-search-input.tsx
- src/components/recovery-calculator.tsx
- src/components/recovery-calculator-client.tsx
- src/components/recovery-limit-cta.tsx
- src/app/arbitragem-divida/**
- src/components/debt-calculator.tsx
- src/components/debt-form.tsx
- src/components/simulation-chart.tsx
- src/components/simulation-summary.tsx
- src/components/ai-analysis-section.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.16; mobile.md 3.8 (índices tabs), 3.11 (inputs) and 3.14 (sparklines/dynamic). Do not trigger AI (ai-analysis-section, IBOV projections are pre-seeded). The landing kit (src/components/landing/*) is rendered, not edited; LandingHero usages become PageHeader.

1) Índices (P1).
- The disclaimer moves from a big yellow box to text-xs below the cards.
- Cards: index-sparkline becomes an inline SVG polyline (remove Recharts there) in chart-1, with the benchmark in grey.
- Static MarketTickerBar at the top of /indices (import from src/components/indices/market-ticker-bar).
- Detail tabs: scrollable with an edge fade.
- Remove aggregateRating in indices/[ticker]/page.tsx (~418).
- Charts below the fold via next/dynamic (ssr: false) + Skeleton.

2) P/L da bolsa (P1). One chart-1 line (1.5 px), area fill 6%, historical average dashed grey; filters inline above the chart (not in a separate card); pt-BR axis/tooltip.

3) Análise setorial (P1). The 3 icon stat cards become a row of Stats; remove the yellow 'TOP 1' badge; each sector as a 5-row DataTable.

4) Projeções IBOV (P1). Add src/app/projecoes-ibov/layout.tsx with metadata (title + alternates.canonical '/projecoes-ibov'); tokens; values labeled 'estimativa'; charts with projections dashed.

5) Calculators (P0).
- Create src/app/calculadoras/page.tsx: an index with PageHeader and a list of 3 calculators (Dividend yield, Recuperação, Arbitragem de dívida), canonical '/calculadoras' (fixes the 404).
- DY and Recuperação: form on the left and result on the right on desktop; results as Stats; money inputs inputMode='decimal' + BRL mask; enterKeyHint='go'.
- dividend-yield-register-modal: only on user action (never automatic), on ui/dialog.
- Arbitragem de dívida: alternates.canonical '/arbitragem-divida'; charts in tokens (rentability-selector is owned by w2-score-compliance-fii: render only).

6) Strip title suffixes in all owned pages.

ACCEPTANCE:
- /calculadoras returns 200.
- index-sparkline does not import recharts.
- Charts are visible in dark; tabs do not overlap at 320; no overflow at 360.
- Canonicals are correct for /projecoes-ibov, /arbitragem-divida and /calculadoras.
- No aggregateRating.

## TEST PLAN
Routes: /indices, /indices/ipj-value, /pl-bolsa, /analise-setorial, /projecoes-ibov, /calculadoras, /calculadoras/dividend-yield, /calculadoras/recuperacao, /arbitragem-divida. Modes: anonymous/premium; 320/small/mobile/desktop; light/dark.
Check:
(1) curl the canonicals.
(2) grep recharts src/components/indices/index-sparkline.tsx -> 0.
(3) The sparklines and P/L chart are visible in dark screenshots.
(4) Inputs have inputmode=decimal; type a value and the BRL mask formats it.
(5) No auto-opening dialog on the DY calculator within 10 s.
(6) scrollWidth == innerWidth at 320/360.


## Carry-over from wave 1 (added before launching wave 2)
- /projecoes-ibov still has the old red cards and gradients; calculators still use gradients — remove them all (scripts/check-ui.sh must pass on these paths).
