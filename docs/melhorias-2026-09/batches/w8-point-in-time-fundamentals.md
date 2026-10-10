# BATCH w8-point-in-time-fundamentals (wave 8): point-in-time fundamentals history for honest strategy backtests

Owner request (2026-10-10): the platform must start keeping company fundamentals history so that strategy backtests (e.g. "Top Graham rebalanceado") become possible without look-ahead bias. Read docs/melhorias-2026-09/backlog-rules.md and docs/vault/00 - Início.md first.

## ⚠️ SCHEMA CHANGE — REQUIRES OWNER APPROVAL BEFORE MERGE
This wave needs new tables. The production build runs `prisma db push`, so a schema change is applied to PRODUCTION on deploy.
Rules:
- ADDITIVE ONLY: new models and new nullable columns. Never rename, drop or alter existing columns.
- Write the change in prisma/schema.prisma, apply it ONLY to the local Docker DB (`DATABASE_URL=postgresql://postgres:local@localhost:55432/pja npx prisma db push`) and document it in the report.
- The commit message must start with "feat(schema)!" and list the new tables, so the owner reviews it before deploying.

## What already exists (verify)
- BalanceSheet / IncomeStatement / CashflowStatement: yearly and quarterly, with endDate.
- FinancialData: per year, with ratios computed at fetch time.
- DailyQuote: daily prices.
- DividendHistory.
- AssetSnapshot: the score with isLatest.
Check whether companies that leave the B3 are deleted or kept (search the fetchers and admin code for prisma.company.delete). This is critical for survivorship bias.

## TASKS
1. **Model (P0).**
   - `FundamentalsSnapshot`, immutable:
     - companyId, asOfDate (date);
     - source ('reconstructed' | 'live');
     - basis: the period endDate used, plus the assumed availability date;
     - metrics Json: lpa, vpa, roe, roic, margemLiquida, dividaLiquidaEbitda, dividaLiquidaPl, liquidezCorrente, payout, cagrLucros5a, receita, lucroLiquido, ebit, ebitda, dy12m, price, pl, pvp, evEbit, marketCap…;
     - engineVersion;
     - createdAt.
     Unique on (companyId, asOfDate, source).
   - Optional: `CompanyListingStatus` (companyId, listedFrom, delistedAt, reason), so delisted companies are kept and flagged instead of deleted.
2. **As-of engine (P0)**, pure functions in src/lib/point-in-time/**, with unit tests and no Prisma in the tests.
   - Given statements and prices, compute the metrics "as known at date D".
   - Use only periods whose assumed availability date is ≤ D: quarterly endDate + 45 days, annual endDate + 90 days. Make both configurable. If the statement filing date (CVM) exists in the data, use it instead.
   - Use the price on the last trading day ≤ D, and TTM sums from the last 4 available quarters.
3. **Backfill job (P0).** Reconstruct monthly snapshots (last business day of each month) for every company, from the earliest statement on.
   - Make it idempotent: upsert by unique key.
   - Batch it, and make it resumable by cursor.
   - Run it via an admin or cron route protected by CRON_SECRET.
   - NEVER run it against production from local; the owner triggers it after deploy.
   - Locally, run it for the seed and report the counts.
4. **Live snapshots going forward (P0).**
   - A daily cron writes `source='live'` snapshots from the same engine. The current FinancialData and quote at that date must match what the asset page shows.
   - Keep them forever. They are never updated, only inserted.
5. **Survivorship (P1).** Stop deleting companies that leave the B3: mark delistedAt and keep their statements, quotes and snapshots. Document the gap: companies delisted before this change are missing.
6. **Strategy backtest groundwork (P1).** Add `getUniverseAsOf(date)` and `runStrategyAsOf(strategy, date)` helpers, reading snapshots instead of the current data. Write a short design note in docs/vault/Features/ for a future "backtest de estratégia" (monthly rebalance; costs; the survivorship caveat shown in the UI).
   - Do NOT ship a user-facing strategy backtest in this batch.
7. **Docs.** Add docs/vault/Arquitetura/Histórico de fundamentos.md: the model, the availability rules and the known limitations (delisted gap, approximate filing dates, restated statements keep only the latest version).

## ACCEPTANCE
- The schema change is additive and was applied only locally.
- Unit tests cover the as-of rules (no look-ahead: a period ending on 31/03 is not visible on 30/04 with a 45-day lag), TTM, missing data and price alignment.
- Backfill on the local DB produces monthly snapshots for every seeded company. A spot check of PETR4 at 2024-06-28 shows lpa/pl consistent with the statements available on that date (hand check in the report).
- The live cron is idempotent.
- tsc, eslint and tests are clean. No production DB access.

## TEST PLAN
- `timeout 300 npx tsx --test src/lib/__tests__/point-in-time/*.test.ts`.
- Local: run the backfill route with the local CRON_SECRET, then query counts per company and month in the local DB.
- Re-run the backfill and confirm no duplicates.
