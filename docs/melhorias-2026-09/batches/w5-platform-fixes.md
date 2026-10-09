# BATCH w5-platform-fixes (wave 5): leftover platform bugs

Read docs/melhorias-2026-09/backlog-rules.md first. No Prisma schema change. Tests with `timeout 300`, without Prisma imports.

## OWNED PATHS
- src/app/api/backtest/config/route.ts, src/app/backtest/backtest-page-client.tsx (or the file that posts the example portfolio), src/components/backtest-config-form.tsx, src/app/api/backtest/run/route.ts (legacy averageDividendYield only)
- src/lib/format.ts (date formatting only) + its tests
- src/middleware.ts, src/lib/rate-limit-cache-service.ts
- src/app/api/sector-analysis/route.ts
- src/app/login/page.tsx (redirect only), src/app/acao/[ticker]/not-found.tsx, src/app/acao/[ticker]/page.tsx (existence check before projections only)
- package.json ("test" script only)
- src/lib/__tests__/platform/** (new)

## TASKS
1. **Example portfolio duplicates (P0).** The UI posts to `/api/backtest/config` (singular), which creates a new "Carteira de exemplo" on every run. Use `upsertBacktestConfig` (already in adaptive-backtest-service). Also remove the legacy `averageDividendYield` read/write and the DY inputs in the form, since the simulation uses DividendHistory.
2. **Dates one day early (P0).** `formatDate` with America/Sao_Paulo shows dates stored as UTC midnight one day early (TAEE11 dividend 2026-08-17T00:00Z shows as 16 ago.). Date-only values (ex/payment dates, report dates) must be formatted in UTC; timestamps stay in America/Sao_Paulo. Add a `dateOnly` option or detect midnight-UTC values. Audit the callers that pass date-only values: agenda, dividends, radar, ICS export.
3. **API rate limit (P1).** It never ran in production. Add `/api/*` to the middleware matcher with the rate limiter, guarding `process.on` in rate-limit-cache-service (Edge has no `process.on`; Next middleware runs on Node now, but guard anyway). Exempt crons (secret header), auth and webhooks. Use generous limits; log, don't block, for the first release if unsure (flag).
4. **`/api/sector-analysis` (P1).** It returns the top company to anyone. Apply the same plan check as the page.
5. **Logged-in user on /login (P2).** Redirect to the callbackUrl or /dashboard.
6. **Asset 404 (P2).**
   - not-found must have only `robots: { index: false }`;
   - the asset page must check existence before generating dividend projections.
7. **Tests (P1).** The `yarn test` glob misses src/components/**/*.test.ts. Include them, then make the suite green.

## ACCEPTANCE
- Running the example backtest 3× creates one config row (local DB count).
- TAEE11 ex-date shows 17 ago. 2026.
- `yarn test` runs the components tests and passes.
- /login while logged in redirects.
- The rate limiter is active locally on /api/* (a burst returns 429 only above the limit), and crons are exempt.
