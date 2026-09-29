# BATCH w1-finance-foundation (wave 1): Finance foundation: pure, tested helpers (dividends TTM/full-years, valuation math, liquidity, sector classes, macro assumptions from BCB) + additive strategy types

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/finance/**
- src/lib/__tests__/finance/**
- src/lib/strategies/types.ts
- src/app/api/cron/macro-indicators/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

This batch creates the contracts that the wave-2 finance batches (w2-valuation-core, w2-rankings-new-models, w2-score-compliance-fii, w2-returns, w2-dividends-agenda, w2-alerts) consume in parallel. Keep the functions PURE where possible, fully typed, documented, and covered by node:test tests. Spec: docs/melhorias-2026-09/reports/mercado-financeiro.md sections 3 and 8. No UI.

1) src/lib/finance/dividends.ts.
- DividendEvent { exDate: Date; paymentDate?: Date|null; amount: number; type?: string|null } (map from Prisma DividendHistory: Decimal -> number).
- sumTTM(events, asOf): dividends + JCP with exDate in the last 12 months.
- removeExtraordinary(events): drop amounts > 2x the median.
- averageFullYears(events, { years = 5, asOf }): calendar years N-1..N-years only; exclude the current partial year and any partial first year of coverage.
- annualizeFromLast12(events).
- jcpNet(amount, date): IRRF 17.5% from 2026-01-01, 15% before.
- isJcp(type).
- projectSeasonal(events, asOf, monthsAhead = 12): deterministic projection; months with an ex-date in >= 2 of the last 3 years project the median amount of that month.

2) src/lib/finance/valuation.ts.
- equityFromEV(ev, totalDebt, cash) = ev - (totalDebt - cash); fallback helper using enterpriseValue - marketCap.
- gordonValue({ d0, g, k, minSpread = 0.04 }) -> null when k - g < minSpread; uses D1 = d0 * (1 + g).
- fairPVP({ roe, g, ke }) = (roe - g) / (ke - g) with the same spread guard.
- bankFairValue(vpa, roe, g, ke).
- peg(pl, gFraction) = pl / (g * 100).
- lynchFairPE(gFraction, dyFraction) = g * 100 + dy * 100.
- magicFormulaRank(items: { id, roic, evEbit }[]): rank by ROIC desc + rank by EY = 1/evEbit desc, sum ascending; ignore evEbit <= 0.
- Re-export marginOfSafety and upside from @/lib/valuation-metrics.

3) src/lib/finance/liquidity.ts (server-only).
- LIQUIDITY_DEFAULTS = { stock: 1_000_000, fii: 500_000, bdr: 200_000 } (BRL/day).
- getAverageDailyTradedValue(companyIds, { minDays = 21, maxDays = 60 }): one batched query over HistoricalPrice interval '1d' (close x volume), fallback PriceOscillations.tradedVolumePerDay; in-memory cache for 1 h. You may import getAverageDailyVolume from src/lib/index-strategy-integration.ts (lines ~245-320), but do not edit that file.
- isIlliquid(value, assetType, threshold?): pure predicate.

4) src/lib/finance/sector-classification.ts.
- isFinancial(sector, industry): banks, insurers, financial holdings; port the logic of isBankOrFinancial from src/lib/strategies/overall-score.ts (~line 2112) by copying, not editing.
- isUtility: energia elétrica, saneamento, gás.
- isCyclicalCommodity: petróleo, mineração, siderurgia, papel e celulose, commodities agrícolas.
Dictionary-based and accent/case-insensitive. Cover both B3 names and the LLM-translated Yahoo names: inspect the local DB with 'SELECT DISTINCT sector, industry FROM companies' using inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja (read-only; check the table/column names in prisma/schema.prisma). Note in the report that the production sector strings must be validated by the owner.

5) src/lib/finance/macro.ts.
- MACRO_FALLBACK = { selic: 0.1375, cdi: 0.1365, ipcaExpected: 0.04, ntnbRealLong: 0.0768, erp: 0.055, ust10y: 0.042, asOf: '2026-09-16' }.
- getMacroAssumptions(): async; reads the latest values from EconomicIndicatorHistory (symbols 'BCB_SGS_432' Selic meta, 'BCB_SGS_12' CDI, 'BCB_SGS_433' IPCA, 'NTNB_REAL_LONG'), falling back to MACRO_FALLBACK per field; returns values + asOf + source per field.
- warmMacroAssumptions() + getMacroAssumptionsSync(): a sync snapshot for strategies, which are synchronous.
- computeKe({ rfNominal, beta = 1, erp }), where rfNominal = (1 + ntnbReal) * (1 + ipcaExpected) - 1; the result is never below selic.
- fetchSgsSeries(code, fromDate) using https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial=dd/MM/yyyy (public API).

6) Cron endpoint src/app/api/cron/macro-indicators/route.ts.
- GET, authorized exactly like the existing cron routes (CRON_SECRET check as in src/app/api/cron/fetch-fii/route.ts).
- Fetches SGS 432, 12 and 433 (last 90 days) and upserts EconomicIndicatorHistory (interval '1d').
- Do NOT edit vercel.json; report that the owner must add the schedule.
- Test the upsert function from a tsx script with inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja (never against .env).

7) src/lib/strategies/types.ts, ADDITIVE ONLY (it must keep compiling everywhere):
- StrategyAnalysis gets optional discount?: number|null (1 - P/VJ), terminalValueShare?: number|null, equityBridge?: { ev: number; netDebt: number; equity: number }|null, dataCoverage?: { used: number; total: number }.
- CompanyData.dividendHistory element type gets optional paymentDate?: Date|null and type?: string|null.
- Add exported interfaces BazinParams, LynchParams, BankPvpParams.
- Do NOT add keys to existing unions or Record types if that breaks exhaustive switches; export a separate NewModelKey = 'bazin'|'lynch'|'bankPvp' instead.

8) Tests in src/lib/__tests__/finance/*.test.ts (node:test + node:assert):
- EV 100, net debt 40, 10 shares -> 6.0/share.
- 12 payments of 0.10 -> TTM 1.20.
- 6 years of history + a partial current year -> the average uses exactly the 5 full years.
- margin VJ 100 / P 75 -> 0.25 and upside 0.3333.
- Gordon with k - g < 4pp -> null; k 0.16, g 0.05, d0 1.20 -> 1.26/0.11 = 11.4545.
- fairPVP roe 0.20, g 0.05, ke 0.15 -> 1.5.
- peg(10, 0.20) = 0.5; lynchFairPE(0.15, 0.04) = 19.
- magicFormulaRank with 5 synthetic companies matches a hand-computed order.
- jcpNet before/after 2026.
- FII: monthly 0.10 x 12 / 0.10 target -> 12.00.
- isIlliquid thresholds.
- projectSeasonal determinism.

ACCEPTANCE:
- npx tsx --test src/lib/__tests__/finance/ passes.
- npx tsc --noEmit introduces no errors.
- No edits outside the owned paths.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/finance/ — all green; paste the summary into the report.
(2) npx tsc --noEmit — no new errors.
(3) Local-only integration: DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja npx tsx -e "import('./src/lib/finance/liquidity').then(async m => console.log(await m.getAverageDailyTradedValue([...some local company ids...])))" returns numbers for seeded tickers.
(4) The macro upsert function run with the local DB env writes rows for the 3 SGS codes (verify with a read-only SELECT on the local DB), then getMacroAssumptions() returns source 'db' for those fields.
(5) Confirm that no command ran without the inline local DB env.


## ADDENDUM (owner decision 2026-09-29) — market signals helper, needed by wave 3 (screening filters + "Onde aportar")
Add src/lib/finance/signals.ts (pure, typed, unit-tested in src/lib/__tests__/finance/signals.test.ts):
- smaAt(prices: {date, close}[], window=200) and priceVsSma(prices, window=200) -> { sma, pctAbove } (null-safe, needs >= window points).
- drawdownFrom52wHigh(prices) -> { high52w, drawdown } (fraction, negative when below the high).
- fundamentalsIntact(quarters: {date, lucroLiquido, roe, margemLiquida, dividaLiquida, ebitda}[], opts?) -> { intact: boolean, checks: {name, passed, detail}[] }: last 4 quarters vs the previous 4 (TTM comparison): net income TTM not down more than 15%, ROE TTM not down more than 3 p.p., net margin TTM not down more than 3 p.p., net debt/EBITDA not up more than 1.0x; missing data -> intact=false with a 'dados insuficientes' check (never benefit of the doubt). Thresholds exported as constants and documented in pt-BR JSDoc.
- dipWithIntactFundamentals(ctx) -> boolean: (priceVsSma200.pctAbove < 0 OR drawdownFrom52wHigh <= -0.20) AND fundamentalsIntact.intact.
Tests: synthetic series for each branch, including insufficient data.
