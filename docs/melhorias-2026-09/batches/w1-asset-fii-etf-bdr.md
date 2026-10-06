# BATCH w1-asset-fii-etf-bdr (wave 1): FII / ETF / BDR pages: fix FII data bugs, unified AssetHeader + ScoreCard, same container

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/fii/**
- src/app/etf/[ticker]/page.tsx
- src/app/bdr/[ticker]/page.tsx
- src/components/fii-header-score.tsx
- src/components/fii-strategic-analysis.tsx
- src/components/fii-page-locked-shell.tsx
- src/components/etf-header-score.tsx
- src/components/etf-score-pillars.tsx
- src/components/technical-analysis-section.tsx
- src/components/price-chart.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.3 and 5.9; QA bugs 3-4 in the orchestrator notes. Shared components you RENDER but do not edit: strategic-analysis-client / header-score-wrapper (w1-asset-stock), financial-indicators / comprehensive-financial-view / ai-analysis-dual (w1-asset-indicators-ai).

0) Data bugs first (P0).
- fii/[ticker]/page.tsx line ~539: DY is a fraction; display it with formatPct (x100). Audit the other FII fields for units.
- fii-strategic-analysis.tsx lines ~95-98: the price ceiling currently divides the LAST MONTHLY distribution by 8%, which gives about R$ 11-12 and '-92% vs teto' while the header says '+7,5%'. Annualize by reusing the exported logic of src/lib/fii-listing-valuation.ts (lines ~54-69). Import it; do NOT edit it (wave 2 changes its methodology). The header potential and the ceiling must come from the same function.
- Remove 'truncate' from the ticker H1 (line ~463).

1) AssetHeader on all three (P0).
- FII: subtitle 'FII · <segmento>'; fairValueLabel 'Preço-teto (DY-alvo 8%)'; margin; ScoreCard compact.
- ETF: no fair value, so show a Stat 'DY 12m' or 'Retorno 12m' in that slot, plus the score.
- BDR: like the stock page (AssetHeader + ScoreCard via header-score-wrapper, AssetSectionNav with the same anchors as the stock page).
- Ticker never truncates. Containers max-w-6xl on all three.

2) Scores (P1). fii-header-score.tsx and etf-header-score.tsx become ScoreCard; etf-score-pillars renders ScoreCard 'full' pillars. One visual: number + label + thin neutral bars. No orange/teal numbers.

3) Content blocks (P1).
- FII 'Dados do Fundo Imobiliário' blue box -> Stat grid / definition list without a colored background.
- Hide 'Backtest (indisponível)'.
- ETF historical returns -> Stats with deltas; holdings -> DataTable with tabular-nums.
- ETF page link to the ETF comparator (line ~301) -> '/comparador?tipo=etfs'.
- fii-page-locked-shell: locked preview pattern (blurred real values + 1 CTA).

4) Charts (P1). technical-analysis-section and price-chart: series chart-1, grid stroke var(--border), axes text-xs muted, pt-BR tooltip via lib/format, area fill <= 8% opacity, benchmarks in chart-2 dashed. Must be visible in dark.

5) Strip title suffixes in fii/layout.tsx and the three pages.

ACCEPTANCE:
- HGLG11 DY = stored fraction x 100 (plausible ~8-9%), and the ceiling is consistent in sign and magnitude with the header potential.
- The ticker shows in full.
- The 4 answers (or the ETF equivalent) are above the fold at 390x844 and 1440x900 on /fii, /etf and /bdr.
- No overflow at 320; dark legible.

## TEST PLAN
Routes: /fii/hglg11, /fii/mxrf11, /fii/knri11, /etf/bova11, /etf/ivvb11, /etf/divo11, /bdr/aapl34, /bdr/msft34. Modes: anonymous/free/premium; small/mobile/desktop; light/dark.
Check:
(1) HGLG11 DY text equals (stored dy x 100) formatted pt-BR. Query the local DB with inline env, read-only: SELECT dividend_yield ... from fii_data for hglg11 (inspect the column names in prisma/schema.prisma FiiData).
(2) The ceiling vs header potential have the same sign; the ceiling is annual-based (not ~R$ 11).
(3) The H1 ticker text equals the full ticker (no ellipsis; check scrollWidth <= clientWidth of the H1).
(4) Stat boxes are inside the first viewport.
(5) The ETF comparator link goes to /comparador?tipo=etfs.
(6) Charts are visible in dark (screenshot).
(7) At 320 px scrollWidth == innerWidth.
