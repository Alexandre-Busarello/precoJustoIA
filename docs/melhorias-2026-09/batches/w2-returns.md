# BATCH w2-returns (wave 2): Returns correctness: backtest without dividend double counting/look-ahead, Sharpe with CDI, TWR/XIRR, IPCA benchmarks

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/adaptive-backtest-service.ts
- src/lib/backtest-service.ts
- src/app/api/backtest/configs/route.ts
- src/lib/portfolio-metrics-service.ts
- src/lib/portfolio-analytics-service.ts
- src/lib/benchmark-service.ts
- src/components/portfolio-analytics.tsx
- src/components/backtest-results.tsx
- src/lib/__tests__/returns/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md 3.3 and 3.12. Use src/lib/finance/dividends.ts (jcpNet, events) and finance/macro.

1) Backtest (P0; adaptive-backtest-service.ts ~327-328, ~445-530; api/backtest/configs/route.ts ~92-97). Today prices use adjustedClose (already dividend-adjusted) AND synthetic dividends (price x averageDividendYield in Mar/Aug/Oct) are credited, which double counts and applies today's DY to the past. First inspect HistoricalPrice (close vs adjustedClose) and index-engine.ts (~107-194, read-only).
- Preferred: use close adjusted only for capital events (splits/reverse splits; derive the factor from adjustedClose/close only if dividends are not mixed in, otherwise use raw close + known split events) and credit REAL dividends from DividendHistory at the ex-date (JCP net via jcpNet), reinvested or held as cash per config.
- If a capital-only series cannot be built reliably: use adjustedClose and credit NO dividends; label it 'retorno total (preço ajustado por proventos)'.
- Remove averageDividendYield-based synthetic credits entirely.
- Show trading costs (0.03% per trade) as an explicit assumption.

2) Benchmarks (P0). benchmark-service: add IPCA (SGS 433) and IPCA+6% next to CDI (SGS 12) and IBOV; compound DAILY CDI factors (not (1+avg)^21).

3) Portfolio metrics (P0; portfolio-metrics-service.ts ~993-996, ~369, ~656-684).
- Sharpe = (Rp - CDI of the same period) / σ.
- Add TWR (quota-based) and XIRR in portfolio-analytics-service.
- Keep 'retorno sobre capital investido', clearly labeled.

4) UI (P1).
- portfolio-analytics.tsx: Stats for TWR, XIRR and Sharpe; chart with the portfolio in chart-1 and CDI/IBOV/IPCA in chart-2 dashed variants, with a legend.
- backtest-results.tsx: show benchmarks CDI and IBOV on the same chart plus the assumptions (costs, dividend treatment).
- Keep the restyle from wave 1 (tokens) intact.

5) Tests (src/lib/__tests__/returns/*.test.ts):
- a synthetic portfolio that returns exactly the CDI -> Sharpe ≈ 0 (|x| < 0.05);
- an XIRR known case;
- a 1-asset backtest fixture: credited dividends == sum of the fixture DividendHistory and no synthetic credit;
- TWR with a mid-period contribution equals the quota return.

ACCEPTANCE:
- Tests pass and tsc is clean.
- A local premium backtest (example portfolio) runs and shows benchmarks.
- /carteira/[id]/analise shows TWR, XIRR and Sharpe with CDI.
- grep averageDividendYield in the backtest services -> only removed or commented-out references.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/returns/.
(2) Premium: /backtest run the example portfolio (local compute); compare the total return with and without the change (report both numbers); the chart shows CDI and IBOV.
(3) /carteira/<seed id>/analise: TWR, XIRR and Sharpe visible; the benchmarks legend shows CDI/IBOV/IPCA; dark/light screenshots.
(4) Confirm that no external calls other than BCB SGS/Yahoo happened (dev log).
