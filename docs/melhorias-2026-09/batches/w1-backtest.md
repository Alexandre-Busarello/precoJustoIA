# BATCH w1-backtest (wave 1): Backtest: public landing for anonymous (fix 307 gate), tool opens with an example portfolio, neutral results, mobile sticky CTA

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/backtest/**
- src/app/backtesting-carteiras/**
- src/components/backtest-*.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.6 (backtest); simplificacao.md C4; mobile.md 3.11. Running a backtest locally is fine (local DB compute). Never trigger AI.

1) Gate fix (P0). backtest/layout.tsx redirects anonymous users (307 to /login) and free users (to /dashboard?upgrade=backtest), which hides the existing anonymous landing and returns 307 to Googlebot. Remove those redirects from the layout. In page.tsx:
- anonymous -> landing (existing content, restyled; the landing kit is owned by w1-home-pricing-checkout, so render it, do not edit it);
- logged-in free -> inline upgrade card (no redirect);
- premium -> tool.
Export metadata with alternates.canonical '/backtest' and a clean title. The redirect /backtesting-carteiras -> /backtest is added later by w2-platform-seo-pwa; here only make sure /backtesting-carteiras links point to /backtest.

2) Tool (P0).
- Open directly in the configurator with an example portfolio preloaded: PETR4, VALE3, ITUB4, WEGE3, BBAS3, equal weights, 5 years, R$ 10.000 initial, no contributions.
- 'Minhas configurações' becomes a tab.
- Remove backtest-welcome-screen and the blue 'Dica' card.

3) Results (P0).
- The KPI cards become one row of neutral Stats (delta color only for gain/loss).
- Charts: portfolio chart-1, benchmarks chart-2 dashed, pt-BR tooltips, dark-visible.
- Tables in DataTable.
- Scrollable tabs (the Configs/Config/Result tabs were cut off).
- Calculation changes in backtest-results happen in wave 2 (w2-returns); here restyle only.

4) Form (P1).
- 'Capital inicial' and 'Aporte mensal' use inputMode='decimal' + a BRL mask; enterKeyHint.
- The mobile sticky bottom bar holds 'Executar backtest' (h-12, safe-area, above the bottom nav).

5) Strip title suffixes in the layout and pages.

ACCEPTANCE:
- curl -I /backtest as anonymous returns 200 (no 307), with canonical /backtest.
- Free users see an inline upgrade card; premium users see the tool with the example loaded and can run it with 0 extra configuration.
- KPIs are neutral; no overflow at 320/360; dark legible.

## TEST PLAN
Routes: /backtest (anonymous, free, premium), /backtesting-carteiras. Viewports 320/small/mobile/desktop; light/dark.
Check:
(1) curl -sI http://localhost:3100/backtest -> HTTP 200 and no Location header; curl -s shows rel=canonical .../backtest.
(2) Free user: no redirect, upgrade card visible.
(3) Premium: the 5 example assets are prefilled; click 'Executar backtest' (local compute) -> results render; the KPI Stats have no pastel backgrounds.
(4) The sticky CTA is visible at 360 while scrolling the form.
(5) Inputs have inputmode=decimal.
(6) scrollWidth == innerWidth.
