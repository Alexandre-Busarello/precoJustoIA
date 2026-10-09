# BATCH w7-backtest-flow (wave 7, run first): one click from any screen → backtest result

Owner request (2026-10-09): a "quick backtest" started on another screen does not take the user to a result; the user ends up lost in the configuration screens. Read docs/melhorias-2026-09/backlog-rules.md first, plus the "Backtest" section of docs/melhorias-2026-09/reports/auditoria-onda7.md (entry-point map, evidence). No Prisma schema change. Do not touch the simulation engine (`src/lib/adaptive-backtest-service.ts`).

## Today (summary of the audit)
- Asset page (`/acao`, `/bdr`), comparador (`/compara-acoes/...`) and ranking rows open `BacktestConfigSelector`. Ranking "Backtest do ranking" opens `BatchBacktestSelector` (2 steps). Both ask the user to pick an existing config or fill a form with a **required name**, 2 dates, capital and aporte. They then close the dialog with a toast and **stay on the current page**. Nothing runs.
- On `/backtest` the tool opens the **example portfolio** (PETR4, VALE3, ITUB4, WEGE3, BBAS3), not the config that was just created. The user must find it in "Minhas configurações", open it, then click "Executar".
- "Adicionar a uma configuração existente" silently re-weights a saved config.
- The selectors still fetch `/api/dividend-yield-average/*` and post `averageDividendYield` (legacy since w5).
- The localStorage handoff `backtest-preconfigured-assets` is read by `/backtest` but no longer written by any entry point, except the dead branches of `add-to-backtest-button.tsx`.
- Carteira: `/api/portfolio/[id]/to-backtest` exists, but no UI calls it. The carteira detail has no "Simular no backtest" action.
- The results tab has no "Ajustar configuração" or "Criar carteira com estes ativos" action.

## OWNED PATHS
- src/lib/backtest/quick-backtest.ts (new: pure helpers: defaults, URL params, config name)
- src/lib/__tests__/backtest/quick-backtest.test.ts (new)
- src/components/backtest/quick-backtest-button.tsx (new: shared trigger + optional "Personalizar" popover)
- src/components/add-to-backtest-button.tsx
- src/components/backtest-config-selector.tsx (delete if unused at the end)
- src/components/batch-backtest-selector.tsx (delete if unused at the end)
- src/components/backtest-page-client.tsx
- src/components/backtest-results.tsx (results header actions only)
- src/components/strategic-analysis-client.tsx (backtest action only)
- src/components/quick-ranker.tsx (the "Backtest do ranking" wiring only)
- src/components/ranking-wizard/ranking-results-table.tsx (backtest cell only)
- src/app/compara-acoes/[...tickers]/page.tsx (backtest row only)
- src/components/portfolio-backtest-action.tsx (new) + src/components/portfolio-detail-page.tsx (MECHANICAL ONLY: place the action in the page header actions)
- src/app/api/backtest/quick/route.ts (new)

## TASKS
1. **Quick-run contract (P0).** Add `POST /api/backtest/quick` (premium only, same checks as `/api/backtest/run`).
   - Input: `{ tickers: string[] (1–20, deduped, FIIs rejected with a readable message), source: 'asset'|'ranking'|'comparador'|'carteira', sourceLabel?: string, weights?: number[], overrides?: { years?: 3|5|10, initialCapital?, monthlyContribution?, rebalanceFrequency? } }`.
   - Defaults:
     - last 5 full years, ending on the 1st day of the current month in America/Sao_Paulo (same rule as `buildExampleConfig`);
     - R$ 10.000 initial capital;
     - R$ 1.000 monthly contribution;
     - monthly rebalancing;
     - equal weights.
     For a carteira: the current target weights, or else the current position weights.
   - Upserts one config per user+source+ticker set, using `upsertBacktestConfig`/`saveBacktestConfig`'s dedupe, so repeated clicks don't pile up configs. The name is automatic: "PETR4 · 5 anos", "Top 5 · Fórmula de Graham · 09/10/2026", "Carteira Dividendos · 5 anos".
   - Then validates data with the existing validator. If the period has to shrink because of missing history, it adjusts the start to the first common month and returns the `adjustments`; it never blocks. It runs the simulation and returns `{ configId, resultId, adjustments }`.
   - Pure helpers (defaults, naming, ticker normalization, weight normalization) go in `src/lib/backtest/quick-backtest.ts` with unit tests (no Prisma import).
2. **One click everywhere (P0).** Replace `BacktestConfigSelector` / `BatchBacktestSelector` with `QuickBacktestButton`:
   - asset header action "Backtest";
   - ranking row action;
   - "Backtest do ranking" (top 5 by default, with a compact "Top 3/5/10" choice inside the button popover);
   - comparador row;
   - new "Simular no backtest" in the carteira detail header.
   The click shows an inline busy state ("Simulando 5 anos…", with the button disabled and `aria-busy`), calls `/api/backtest/quick`, then `router.push('/backtest?view=results&configId=…&from=<source>')`. Optional secondary "Personalizar antes" opens `/backtest?view=configure&configId=…` with the same prefilled config (no run). Anonymous and free behaviour stays as today: login, or `/checkout?product=backtest` / upgrade card. FII stays disabled with the current hint.
3. **Landing on the result (P0).** In `backtest-page-client.tsx`, when the URL has `view=results&configId`, show the results with a header strip above the KPIs:
   - "Simulação rápida de <sourceLabel> · <período> · <capital> + <aporte>/mês · rebalanceamento mensal";
   - primary "Ajustar configuração" (switches to Configurar with this config loaded, scrolls to the form);
   - secondary "Voltar para <origem>" (only when `from` is present, using `router.back()` when history allows; otherwise the origin URL);
   - when `adjustments` exist, one `PageNotice`/warning line ("Período começou em mar. 2022: VALE3 não tem cotações antes disso").
   After "Ajustar configuração" → "Executar", stay on Resultados as today.
4. **Results actions (P1).** In the results header add "Criar carteira com estes ativos" (reuse `/api/portfolio/from-backtest`, the same call as `convert-backtest-modal.tsx`) and "Nova simulação". The tabs keep their names. The "Resultados" tab is never disabled after a quick run.
5. **Cleanup (P1).**
   - Delete the `backtest-preconfigured-assets` localStorage handoff (reader in page client, writers in add-to-backtest-button), the `/api/dividend-yield-average` calls from the selectors, and any `averageDividendYield` sent by them.
   - Delete the two selector components when they have no importers. `rg` must show 0 importers.
   - Remove the "Adicionar a uma configuração existente" path: editing an existing config happens on /backtest.
6. **Mobile/a11y (P0).** The tab row on /backtest is cut at 390 px ("Minhas c…"): use short labels on mobile ("Configurar · Resultado · Execuções · Salvas") or a scrollable row with an edge fade.
   - Busy button ≥ 44 px, no layout jump;
   - focus moves to the results heading after navigation;
   - the header strip wraps at 320 px;
   - dark mode legible.

## ACCEPTANCE
- As premium, starting from each of: /acao/petr4 header, /ranking row, /ranking "Backtest do ranking", /compara-acoes/petr4/vale3 row, /carteira/<id> "Simular no backtest". One click lands on `/backtest?view=results&configId=…` showing KPIs and the chart in ≤ 1 navigation, with no dialog in between. Record each final URL in the report.
- Clicking the same entry point 3× leaves 1 config row for that ticker set (local DB count before/after).
- "Ajustar configuração" opens Configurar with the same tickers/period. Changing the period and running shows the new result.
- Free user: the same buttons lead to the upgrade path. Anon: to login. No API call returns 200 for them on `/api/backtest/quick`.
- `rg "BacktestConfigSelector|BatchBacktestSelector|backtest-preconfigured-assets|dividend-yield-average" src` → only the API route of dividend-yield-average itself, if still used elsewhere.
- tsc, eslint, check-ui and check-compliance are clean. Unit tests pass (`timeout 300 npx tsx --test src/lib/__tests__/backtest/quick-backtest.test.ts`).

## TEST PLAN
- Unit: default dates (month boundary, Sao Paulo timezone), naming, ticker dedupe/upper-case, weight normalization (sum = 1, carteira weights), FII rejection message, years override bounds.
- Playwright (premium, desktop 1440 + mobile 390, light + dark): run the five entry points and capture the landing result plus the header strip. Capture "Ajustar configuração" → Configurar.
- Free + anon: capture the upgrade/login paths for the asset header and the ranking.
- DB check (local only): `select count(*) from backtest_configs where user_id=<premium>` before/after 3 repeated clicks.
- Screenshots: `npx tsx scripts/local/screenshots.ts --routes /backtest,/acao/petr4,/ranking,/carteira/<id> --auth both --viewports small,mobile,desktop --theme both`.
