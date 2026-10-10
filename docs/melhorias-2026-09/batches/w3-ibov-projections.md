# BATCH w3-ibov-projections (wave 3 — runs in parallel with w3-onde-aportar and w3-screening-filters, disjoint files): IBOV projections redone with statistics instead of an LLM number

Owner decision (2026-10-07): the current projections ("Estimativa do Ben": a single IBOV number for week, month and year written by Gemini) are of poor quality and stopped updating. Redo them as statistical ranges. The AI only writes the commentary.

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/projecoes-ibov/**
- src/app/api/ibov-projections/**
- src/app/api/cron/calculate-ibov-projections/route.ts
- src/app/api/ben/project-ibov/route.ts
- src/app/actions/ibov-projection.ts
- src/app/admin/ibov-projections/**
- src/components/admin/ibov-projections-manager.tsx
- src/components/dashboard-ibov-banner.tsx
- src/lib/ibov-projection-helpers.ts
- src/lib/ibov-projections/** (new)
- src/lib/__tests__/ibov-projections/** (new)

## HARD CONSTRAINTS
- **No Prisma schema change.** The production build runs `prisma db push` automatically, so any change in `prisma/schema.prisma` would alter the production database on deploy. Reuse the existing `IbovProjection` table (period, projectedValue, confidence, reasoning, keyIndicators Json, validUntil) and put the new fields (range bounds, method, sample size, horizon) inside `keyIndicators`, or compute on request and cache. Never write to the production DB; local Docker DB only (see backlog-rules.md).
- **No numeric forecast from the LLM.** Every number shown comes from the deterministic computation. The LLM (optional) may only write 2–3 sentences of context about the macro scenario, and it receives the computed numbers as input. Label it "Comentário gerado por IA". It must not output its own targets or alter the range.
- **Compliance (CVM):** frame it as "faixa estatística com base no comportamento histórico do índice, não é previsão nem recomendação". Never use "o IBOV vai", "alvo" or "compra".

## CONTEXT YOU MUST READ FIRST
- docs/melhorias-2026-09/backlog-rules.md (global rules).
- The current pipeline: the cron route (≈1.5k lines, Gemini prompts with technical analysis, macro and election period), src/lib/ibov-projection-helpers.ts, /api/ibov-projections, the dashboard banner and /projecoes-ibov (the UI was redone in wave 2 by w2-ui-market-tools; keep its layout and design system).
- Where IBOV daily history comes from: getIbovData in src/lib/ben-tools.ts (Yahoo `^BVSP`), YahooFinance2Service.getHistorical, and any index history table used by /indices. Pick ONE source of daily closes, at least 10 years if available, and cache it per trading day with the existing cache service.
- src/lib/finance/* (macro: Selic/CDI/IPCA) and the P/L da bolsa data (/pl-bolsa) for context.
- **Why it stopped updating.** Find out before changing anything:
  - the cron is NOT scheduled in vercel.json (crons are scheduled outside the repo);
  - check the route's guards ("já existe projeção válida", holidays, validUntil logic), timeouts and error paths;
  - write the diagnosis in your report.
  The new design should not depend on a fragile LLM cron to stay fresh: compute on demand with a 1-trading-day cache, so it refreshes on the first request of each trading day even if the cron never runs. Keep the cron route working, but make it a cheap warm-up.

## TASKS
1) **Deterministic engine (P0)**, in src/lib/ibov-projections/ (pure functions with unit tests).
   - Horizons: 1 semana (5 pregões), 1 mês (21) and 12 meses (252).
   - From daily closes, compute log returns over each horizon using all overlapping windows of the last 10 years (state the actual sample).
   - Report the empirical percentiles p5, p16, p50, p84 and p95 of the horizon return, applied to the current close, as the "faixa provável" (p16–p84, about 68%) and the "faixa ampla" (p5–p95, about 90%).
   - Also report the historical share of positive windows ("em 58% dos meses o IBOV subiu").
   - Optional regime adjustment: scale by the current 63-day realized volatility vs the 10-year median, capped to 0.7–1.5×. Show it as "ajustado pela volatilidade recente" if used.
   - Handle missing data, stale quotes (> 3 trading days old, flag it) and short histories gracefully.
2) **Track record (P1).**
   - Backtest the method on the history: for past dates, how often the realized value fell inside p16–p84 and inside p5–p95.
   - Show it as calibration: "nos últimos 5 anos, o fechamento caiu dentro da faixa provável em 67% das semanas".
   - It must be honest. If the calibration is off, say so and adjust the method, not the copy.
3) **Context (P1)**, without changing the numbers:
   - P/L da bolsa vs its historical percentile;
   - Selic/CDI;
   - the latest close and date;
   - optional short AI commentary, per the constraint above.
4) **UI (P0).**
   - /projecoes-ibov: for each horizon, a card with the current value, the "faixa provável" (and "faixa ampla"), the % of positive periods and the calibration.
   - A simple fan/cone chart (reuse the existing chart lib) with the history plus the bands.
   - Remove the old single-number projections and the "confiança 0–100" score.
   - Methodology paragraph + link to /metodologia (add an anchor section there ONLY if src/app/metodologia/** has no owner conflict; otherwise put the methodology on the page itself).
   - Dashboard banner: one line, e.g. "Ibovespa: faixa provável para o mês entre 198 mil e 214 mil pts (estatística histórica)", dismissible as today.
   - Mobile-first, dark mode, design system, check-ui passes.
5) **Ben / admin (P2).**
   - /api/ben/project-ibov and the admin manager: return and show the new structure. The admin "force recreate" just recomputes.
   - Remove the dead LLM prompt code once nothing uses it.

## ACCEPTANCE
- Same input → same numbers (pure functions with unit tests for percentiles, windows, the volatility scaling cap, stale-data flags and calibration).
- /projecoes-ibov and the dashboard banner show fresh values computed from the latest close, with no LLM call in the number path.
- No schema change.
- tsc clean, eslint clean on changed files, check-ui passes, no horizontal scroll at 320, dark mode legible.
- The report includes the diagnosis of why the old projections stopped updating.

## TEST PLAN
- `timeout 300 npx tsx --test src/lib/__tests__/ibov-projections/*.test.ts`.
- With the local DB and the IBOV source: /projecoes-ibov (anon + premium, mobile + desktop, light + dark) shows 3 horizons with ranges that make sense. The week p16–p84 should be a few % wide, never ±30%. Cross-check one horizon by hand from the raw closes.
- /dashboard banner shows the new line; old cached projections are not shown.
- Hit /api/cron/calculate-ibov-projections locally (with the cron secret from the local env, if required) → returns quickly and warms the cache.
