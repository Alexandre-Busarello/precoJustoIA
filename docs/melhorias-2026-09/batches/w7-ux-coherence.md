# BATCH w7-ux-coherence (wave 7, parallel with w7-backtest-flow): same words, same numbers, honest plan copy, one navigation

Read docs/melhorias-2026-09/backlog-rules.md first, plus the findings table in docs/melhorias-2026-09/reports/auditoria-onda7.md (IDs C-xx are cited below). No Prisma schema change. Copy and labels only, plus one formatting helper. No change to formulas, rankings or gating logic, except the documented copy alignment in task 1.

## OWNED PATHS
- src/components/landing-pricing-section.tsx, src/app/planos/plan-comparison.tsx, src/app/planos/page.tsx (plan copy only)
- src/components/portfolio-empty-state.tsx, src/components/portfolio-list-page.tsx (pass the plan flag only)
- src/lib/valuation-metrics.ts (+ its tests): new `formatMarginOfSafety` / `formatUpside` helpers
- src/components/screening/screening-results.tsx, src/components/screening/screening-metrics.ts (+ src/components/screening/screening-metrics.test.ts), src/components/screening-results-blur.tsx, src/components/screening-configurator.tsx, src/components/screening-conversion-page.tsx
- src/components/screening/screening-hub-page.tsx (breadcrumb only)
- src/components/radar-grid.tsx, src/components/dashboard-radar-section.tsx, src/components/related-companies.tsx
- src/components/technical-analysis-traffic-light.tsx (labels only)
- src/lib/navigation.ts (+ its tests, if any)
- src/app/perfil/page.tsx (labels only)
- src/app/analise-setorial/page.tsx, src/app/radar-dividendos/page.tsx, src/app/pl-bolsa/page.tsx, src/app/comparador/comparador-hub.tsx, src/app/comparador/page.tsx (breadcrumb + metadata title only)

## TASKS
1. **Plan promise vs. reality (P0, C-01).**
   - `/planos` (`plan-comparison.tsx`: "Backtest de carteiras · Grátis: 1 por mês") and the home pricing (`landing-pricing-section.tsx`: "1 backtest por mês") promise a free backtest, but `/backtest` and `/api/backtest/run` require Premium. The `backtest_run` free limit in `usage-based-pricing-service.ts` is never used. **Default:** align the copy to reality. Free shows "—" / "Premium", and the list item is removed. Leave a `// DECISÃO DO DONO` note pointing to the option of enabling 1 quick backtest/month for free, which is a gating change and out of this batch.
   - Same audit for "1 carteira com acompanhamento": free users can create 1 carteira, but /onde-aportar locks "Minha carteira" for free (`onde-aportar-client.tsx:239`). Do not change the gating. List it in the report as an owner decision, since it contradicts the core promise.
   - `portfolio-empty-state.tsx`: hide "Criar a partir de um backtest" when the user is not Premium (dead end, C-12).
2. **One vocabulary for valuation numbers (P0, C-02).** The rule from ux-ui.md §1.1 is that the 4 answers are Preço · Preço justo · Margem de segurança · Score.
   - Screening cards, the screening table (`header: "Upside"`), the blur preview and the dividend radar (`'Upside · P/VP e DY'`) show "Upside" (VJ/P − 1). The asset header and the ranking show "Margem de segurança" (1 − P/VJ). PETR4 reads "Upside +11,9%" in the screening and "Margem de segurança +10,6%" on the asset page for the same FCD price.
   - Switch the card/table headline metric to **Margem de segurança** via `marginOfSafety()`, with the model name under the price, as today.
   - Rename every remaining user-facing "Upside X" to "Potencial X" (definition in /metodologia#definicoes) in filter labels, metric labels, hints and `screening-conversion-page` ranges. Keep the internal keys (`grahamUpside`…) unchanged.
   - `rg -n '"Upside|>Upside|Upside ' src/components src/app` must return 0 user-facing hits, outside `parceiros/**` and tests.
3. **Margin display floor (P1, C-03).** The dashboard radar shows WEGE3 "−307,2%" and other places show "< −100%". Add `formatMarginOfSafety(m)`, returning "< −100%" below −1 and `formatDeltaPct` otherwise. Use it in dashboard-radar-section, related-companies, radar-grid and screening. Unit test it.
4. **"Preço justo" only means a valuation model (P1, C-04).** In `technical-analysis-traffic-light.tsx`, rename "Preço justo técnico" to "Referência técnica" in labels and hints. The copy stays descriptive ("faixa estimada"), and the logic does not change.
5. **Navigation coherence (P1, C-05).** In `navigation.ts`:
   - one label per route ("Índices", not "Índices teóricos" in one menu and "Índices" in another);
   - "Agenda de proventos" appears once in the app menu (keep it under "Carteiras");
   - remove the duplicate from "Alertas";
   - "Backtest" sits under the same group label in marketing and app. Pick "Ferramentas" in marketing and "Carteiras" in app, and document why in a comment. Or move it to Descobrir in both, but be consistent;
   - "Meu radar" in the menu vs the page title "Radar de oportunidades": align to "Meu radar" in the menu, and keep a subtitle.
   In `perfil/page.tsx`: "Minhas inscrições" → "Alertas de preço", "Monitoramentos customizados" → "Monitoramentos". These are the same names as the menu and the page titles.
6. **Breadcrumbs (P2, C-06).** Rule: a top-level page reachable from the menu has **no** breadcrumb, and nested pages keep `Parent > Page`. Remove the breadcrumb from:
   - the screening hub ("Ferramentas" → /ranking is wrong);
   - analise-setorial (same);
   - radar-dividendos;
   - pl-bolsa;
   - comparador hub.
   Comparador metadata: drop the trailing "| Preço Justo AI" (title template rule) and the "Gratuito" superlative title.
7. **Leftover copy (P2).** Home models table "Valor justo pelo lucro…" is owned by w7-backtest-showcase (page.tsx), so list it, don't edit it. Sentence case "Muito Bom" → "Muito bom" lives in `src/lib/strategies/*` type unions: do not touch, and list it.

## ACCEPTANCE
- /planos and the home pricing no longer promise anything the free plan can't do. Screenshot both (free + anon, mobile + desktop).
- /screening-acoes, the dashboard radar and /acao/petr4 show the same metric name and the same number for PETR4 with the same model. Include 3 screenshots with the values in the report.
- `rg` checks for "Upside" and "preço justo técnico" (UI) return 0.
- The app menu has no route listed twice. The `navigation` unit test asserts unique hrefs per menu, so add it if missing.
- tsc, eslint, check-ui and check-compliance are clean. Unit tests pass with `timeout 300`.

## TEST PLAN
- Unit: `formatMarginOfSafety` (−3.07 → "< −100%", 0.106 → "+10,6%", null → "—"), and navigation hrefs unique per menu.
- Screenshots: `--routes /,/planos,/screening-acoes,/dashboard,/acao/petr4,/radar-dividendos,/perfil,/carteira --auth all --viewports small,mobile,desktop --theme both`.
- Manual: open each menu (desktop dropdowns + mobile sheet) and confirm the labels and the single entry per route.
