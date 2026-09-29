# BATCH w3-onde-aportar (wave 3 — runs after wave 2, in parallel with w3-screening-filters which owns the screening files): "Onde aportar" — the platform's core promise

Owner request (2026-09-29): "deixar CLARO para o usuário onde alocar capital novo: tenho R$ 2.000 para aportar e estou olhando para essas ações, ou tenho essa carteira — qual o melhor ativo para alocar esse capital?" This becomes the central premise of the product. It must be excellent, simple, transparent and compliant.

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/allocation/** (new: engine, types, explanations)
- src/lib/__tests__/allocation*.test.ts
- src/app/onde-aportar/** (new route: page, layout/metadata, loading)
- src/app/api/allocation/** (new API)
- src/components/allocation/** (new UI components)
- src/lib/portfolio-transaction-service.ts (contribution-suggestion prioritization only)
- src/components/portfolio-suggestions-page.tsx
- src/components/portfolio-transaction-form-suggested.tsx
- src/app/dashboard/page.tsx (entry point block only)
- src/app/page.tsx and src/components/landing/landing-hero*.tsx (hero promise + entry only)
- src/lib/navigation.ts (add the nav item)
- src/app/api/cron/aporte-mensal/route.ts (new) and src/lib/email-templates/aporte-mensal* (new; follow the existing e-mail template pattern in src/lib — find it)
- src/app/sitemap*.xml/route.ts entries ONLY if a public landing is added (the tool page itself can be public)

## CONTEXT YOU MUST READ FIRST
- docs/melhorias-2026-09/backlog-rules.md (global rules — production DB safety, design system, compliance copy, mobile, dark mode, validation).
- reports/mercado-financeiro.md §3 (the corrected valuation semantics: marginOfSafety = 1 − P/VJ, liquidity filter, financials profile, Bazin, Peter Lynch, banks), §4 (CVM compliance) and §6.
- reports/ux-ui.md §1–2 (design system), §5.5 (carteira).
- The existing contribution-suggestion engine: src/lib/portfolio-transaction-service.ts (~line 150+ "Get contribution suggestions … prioritizing assets furthest from target"), src/components/portfolio-suggestions-page.tsx, the carteira pages, and the wave-1/2 helpers in src/lib/finance/* and src/lib/valuation-metrics.ts, the strategies in src/lib/strategies/* (as fixed in wave 2), the liquidity helper, AssetSnapshot data, UserAssetSubscription/watchlist (radar) models.
- git log for waves 1–2 to see what already exists (liquidity badge, Bazin/Lynch/banks models, dividends TTM, alerts).

## TASKS

1) Allocation engine (P0) — `src/lib/allocation/` — PURE, deterministic, unit-tested. No LLM anywhere in the numbers.
- Input: `{ amount (BRL), universe: Asset[] (ticker, current qty/value if from a portfolio, optional targetWeight), options: { models: StrategyId[] (default: the models applicable to each asset type, e.g. Graham/Bazin/FCD/Gordon/banks for stocks, FII price-ceiling for FIIs), maxPerAssetPct (default 40% of the amount AND a portfolio concentration cap, default 25% of portfolio after the aporte), allowFractional (default true: B3 fracionário, qty integer ≥ 1 share), minLiquidity (default from the liquidity helper), respectTargets (default true when the universe is a portfolio with target weights) } }`.
- Per-asset context from existing data: price, fair values per model, marginOfSafety per model (1 − P/VJ), overall quality score + data coverage, liquidity, "fundamentals intact" check — USE src/lib/finance/signals.ts (fundamentalsIntact, priceVsSma, drawdownFrom52wHigh from wave 1); do not re-implement, current weight vs target.
- Eligibility gates (asset gets 0 with a human-readable reason): below liquidity; price above fair value in ALL selected models; quality score below threshold; fundamentals deteriorating; missing data (coverage too low) — never "benefit of the doubt".
- Priority score for eligible assets = transparent weighted sum of normalized components: valuation discount (median margin of safety across selected models), quality, target-gap (only when respectTargets), with weights exposed in the result and adjustable in the UI (3 presets: "Mais desconto", "Equilíbrio" (default), "Seguir meus pesos-alvo").
- Distribution: greedy-with-rounding in whole shares honoring caps and the amount; leftover cash reported; deterministic tie-breaks (higher discount, then higher liquidity, then ticker).
- Output: `{ allocations: [{ ticker, qty, price, value, pctOfAmount, reasons: string[], components: {...} }], excluded: [{ ticker, reasons: string[] }], leftover, assumptions: { models, weights, caps, dataDate, macro (Selic/Ke used) } }`. `reasons` are short pt-BR strings built from numbers ("22% abaixo do preço-teto (Bazin)", "Nota de qualidade 8,1 (9/9 critérios)", "3,0 p.p. abaixo do peso-alvo").
- Tests (node:test via `yarn test`): caps respected; amount never exceeded; whole shares; exclusion reasons; target-gap mode reproduces the old "furthest from target" behavior when valuation weight = 0; deterministic output; empty/all-excluded universe returns a clear empty state; FII + stock mixed universe.

2) API (P0) — `POST /api/allocation/simulate` (zod-validated body). Auth rules: anonymous and free users may simulate with up to 3 tickers and the free models; premium unlimited + all models + portfolio/watchlist universes. Rate-limit per the project's existing pattern. Load data server-side from the DB (local in tests). Never call Gemini. Add `GET` helpers only if the UI needs them (e.g. universe from portfolio id / watchlist) with ownership checks.

3) UI — `/onde-aportar` (P0), design system from ux-ui.md (tokens only, dark-mode legible, mobile-first).
- One screen, three steps visible at once (no wizard): (a) "Quanto você vai aportar?" currency input (pt-BR mask, ≥16 px on mobile); (b) "Entre quais ativos?" segmented: Minha carteira (select) · Minha watchlist · Digitar tickers (AssetSearch chips); (c) Critério: the 3 presets as a segmented control + "Ajustar" disclosure (models checklist, caps, fracionário). Button "Calcular distribuição".
- Result: summary line ("R$ 1.974,30 distribuídos em 4 ativos · sobra R$ 25,70"); DataTable (Ativo · Qtd · Preço · Valor · % do aporte · Por quê) with reasons as short lines; mobile = stacked rows. "Ficaram de fora" collapsible list with reasons. Assumptions footnote (models, weights, data date, macro) + link to /metodologia#onde-aportar.
- Actions: "Registrar compras na carteira" (premium, when universe = portfolio: creates PENDING buy transactions via the existing transaction service/confirm flow, never auto-confirms), "Copiar lista", "Ajustar critérios".
- States: loading skeleton, empty (no eligible asset → explain why + suggest widening the universe), error with retry, locked (free beyond limits → real blurred preview + 1 CTA "Desbloquear com 1 dia grátis").
- Compliance copy (mandatory): title "Onde aportar"; subtitle "Distribuição simulada do seu aporte segundo os critérios que você escolheu."; persistent note near results: "Simulação baseada nos modelos quantitativos da plataforma e nos critérios definidos por você. Não é recomendação de investimento." Never use "recomendamos", "compre", "melhor ação". Use "prioridade", "distribuição simulada", "desconto vs. valor estimado".

3b) PREMIUM mode "Todo o mercado" (P0 — owner request 2026-09-29: "o melhor custo de oportunidade obtido automaticamente de todo o universo de tickers da plataforma, sem precisar informar a lista").
- New universe option (premium only; free/anon see it locked with a blurred real preview + 1 CTA): "Todo o mercado". The user does not type tickers.
- Filters shown inline (sensible defaults, all optional): asset types (Ações [default on], FIIs, ETFs, BDRs), número de ativos no aporte (default 5, range 1–10), máx. por setor (default 2 ativos / 35% do aporte), "Complementar minha carteira" (when the user has a portfolio: penalize sectors/assets already above target or above the concentration cap, prefer diversification; default on if a portfolio exists), exclude tickers (chips).
- Candidate generation must be FAST and deterministic: use precomputed per-asset data (AssetSnapshot / latest ranking outputs / cached fair values) — never recompute every strategy for every ticker per request. Pipeline: universe of the platform → hard gates (liquidity default ≥ R$ 1 mi/dia for stocks, FII ≥ R$ 500 mil/dia; data coverage; quality threshold; fundamentals intact; price below fair value in ≥ 1 selected model) → priority score (same engine as step 1) → diversification-aware selection (sector caps, N assets, complement-portfolio penalty) → whole-share distribution. Target p95 < 2 s on the local DB; cache the candidate table per (dataDate, modelSet) in the existing cache service.
- Transparency is mandatory: besides the distribution, show "Candidatos avaliados" — the top 20 ranked candidates with their components (desconto, qualidade, liquidez, setor) and, for the ones not chosen, why ("limite de 2 por setor atingido", "prioridade menor que X"). Also show the counts per gate ("412 ativos → 188 com liquidez → 97 com qualidade → 41 abaixo do valor estimado").
- Compliance (stricter here, because the platform picks the assets): frame as "Ranking do mercado segundo os critérios escolhidos por você + distribuição simulada". The user must actively pick the preset/filters before calculating (no one-click "me diga o que comprar"). Persistent note: "Resultado de modelos quantitativos aplicados a dados públicos, segundo os critérios que você definiu. Não é recomendação de investimento nem consultoria." Add a short owner follow-up in the final report: validate this mode with a lawyer / CNPI partner before heavy marketing (Res. CVM 19/20).
- Dashboard/e-mail: when the user has no watchlist/portfolio, "Onde aportar este mês" defaults to "Todo o mercado" (premium) with the default filters; the monthly e-mail may use it for premium users who opted in.
- Tests: gates counts; sector cap; N assets; complement-portfolio penalty moves allocation away from an over-weight sector; deterministic across runs; performance smoke test with the seeded universe.

4) Integrations (P0/P1).
- Carteira: replace the contribution-suggestion prioritization in portfolio-transaction-service.ts with the allocation engine in "Seguir meus pesos-alvo" + valuation mode (keep backward-compatible data shapes for existing PENDING suggestions); portfolio-suggestions-page shows the same "por quê" reasons and links to /onde-aportar?carteira=<id>.
- Dashboard: the primary block at the top becomes "Onde aportar este mês" (amount input + universe = main portfolio or watchlist → opens /onde-aportar prefilled).
- Home: hero promise and CTA point to the tool ("Descubra onde aportar — calcule a distribuição do seu aporte em segundos") while keeping the ticker search from wave 1; the tool works for anonymous users with up to 3 tickers (product-led).
- Navigation: add "Onde aportar" as a primary item (app nav first position after Início; marketing nav under Descobrir or as its own item — keep ≤ 5 primary items).
- Monthly e-mail (P1): template "Seu aporte do mês" (carteira vs CDI/IBOV summary if available + top 3 prioritized assets with reasons + link) and `GET /api/cron/aporte-mensal` protected by CRON_SECRET, batching users with a portfolio + opted-in preference. DO NOT add it to vercel.json and DO NOT send any e-mail in tests (dry-run flag that renders HTML to a file under the scratchpad). List "enable cron in vercel.json" as an owner follow-up.

5) Methodology (P1): add an "Onde aportar" section to the methodology content (if /metodologia is data-driven, add the entry; if it lives in a file owned by another batch that is already committed, you may append the section — it is wave 3 and runs alone) explaining gates, score, weights, caps and limits in plain pt-BR.

## ACCEPTANCE
- Premium "Todo o mercado": with no tickers typed, R$ 2.000 → N assets respecting sector caps, with the top-20 candidates table and gate counts; free/anon see it locked.
- `yarn test` passes with the new allocation tests; tsc clean; eslint clean on changed files; check-ui passes.
- Anonymous user at 390 px: enters R$ 2.000 + 3 tickers → sees a distribution in whole shares, leftover, reasons and exclusions; no horizontal scroll; dark legible.
- Premium user: universe = seeded portfolio → distribution respects caps and target weights; "Registrar compras" creates PENDING transactions visible in the carteira (local DB only).
- Every allocated/excluded asset shows at least one numeric reason; no LLM-generated number; compliance copy present; the word "recomend" does not appear in the UI of this feature.
- Old contribution suggestions still load for existing portfolios (no crash on legacy PENDING rows).

## TEST PLAN
- Unit: engine cases listed above.
- Screenshots (mobile + desktop, light + dark, anon + premium): /onde-aportar empty, filled result, all-excluded state, locked state (free > 3 tickers); /dashboard top block; / hero; /carteira/<seeded id> suggestions page.
- Playwright flow: fill amount + 3 tickers → calculate → table rows sum ≤ amount; switch preset → result changes deterministically; premium → register purchases → transactions appear as PENDING.
- Sanity of numbers: pick 2 seeded tickers and verify by hand that margin of safety and qty × price match the table.
