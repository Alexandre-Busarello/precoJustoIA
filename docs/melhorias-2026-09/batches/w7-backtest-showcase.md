# BATCH w7-backtest-showcase (wave 7, after w7-backtest-flow): real, dated example backtests ("vitrine")

Read docs/melhorias-2026-09/backlog-rules.md first, plus the "Vitrine de backtests" section of docs/melhorias-2026-09/reports/auditoria-onda7.md (the go/no-go reasoning). No Prisma schema change and no DB writes: results live in the Next data cache. Do not touch the simulation engine (`src/lib/adaptive-backtest-service.ts`). Use it as is.

## Why
- The home "Backtest" block shows a static screenshot with "87.47%" (en-US decimals, no period, no method). That is the riskiest kind of past-performance claim, and it shows an old UI.
- Anonymous and free users never see a real backtest output, but backtest is a Premium feature. A real, dated, reproducible result with costs and benchmarks is the honest way to show what the tool does.

## Compliance rules (non-negotiable)
- **Rule-based, chosen before looking at results.** The showcases are fixed in code (`definitions.ts`), each with a one-line "por que esta carteira" that does not mention performance. All of them are always shown, in the same order, including when they lose to the CDI. If any one can't be computed (missing data), the whole block is hidden. No partial vitrine.
- **No strategy or stock-picking backtests.** No "Top Graham rebalanceado" or anything built from today's ranking: the engine has no point-in-time fundamentals, so that would be look-ahead and survivorship bias. The IPJ indices (/indices) are the strategy track record. Link to them with their real start date.
- Every card shows:
  - the exact period ("out. 2021 a set. 2026");
  - capital + aporte;
  - rebalancing;
  - the trading cost used (0,03% per trade) and the total in R$;
  - that IR on capital gains and spread are not included;
  - the benchmarks (CDI; Ibovespa as a price index, without dividends, stated explicitly);
  - max drawdown next to the return (never the return alone);
  - "Calculado em <data>";
  - "Rentabilidade passada não garante resultados futuros. Simulação, não é recomendação.";
  - a link to /metodologia#backtest.
- Copy: no "ganhe", "lucro garantido", "bata o CDI", "melhor"; sentence case; no emoji. `bash scripts/check-compliance.sh` must pass.

## Showcases (v1)
1. `ibov-aportes`: BOVA11 100%, 5 years, R$ 0 initial + R$ 1.000/mês. "Investir todo mês no índice, sem escolher ações."
2. `dividendos-etf`: DIVO11 100%, same parameters. "Um ETF de empresas pagadoras, sem escolher ações."
3. `exemplo-5-acoes`: the tool's example portfolio (`EXAMPLE_TICKERS` from `src/app/backtest/backtest-utils.ts`, equal weights, monthly rebalancing), R$ 10.000, no aportes. "A carteira de exemplo que abre a ferramenta; não foi escolhida pelo desempenho."
Window: the last 5 full years ending on the 1st day of the current month (America/Sao_Paulo), the same rule as `buildExampleConfig`. If ETF history in production is shorter than 5 years, use the longest common window ≥ 3 years for all three, and say so on the card. Otherwise drop the ETF showcases. Report the actual production coverage, checked from the local seed and the code paths only: no production reads.

## OWNED PATHS
- src/lib/backtest-showcase/** (new: definitions, compute, cache)
- src/lib/__tests__/backtest-showcase/** (new)
- src/components/backtest-showcase/** (new: card, compact strip, disclosures)
- src/app/api/cron/backtest-showcase/route.ts (new)
- src/app/backtest/backtest-landing.tsx, src/app/backtest/backtest-upgrade-card.tsx, src/app/backtest/example-portfolio-card.tsx
- src/app/page.tsx (the "Backtest" feature block and its image, plus the one-word fix in the models table: "Valor justo pelo lucro…" → "Preço justo pelo lucro…")
- src/app/metodologia/page.tsx (new "Backtest" section only)

## TASKS
1. **Compute (P0).** `getShowcaseResults()` runs the 3 definitions through `BacktestService.runBacktest` (server only), wrapped in `unstable_cache`. The key is definition id + window; it uses `revalidate: 7 days` and the tag `backtest-showcase`.
   - It returns a serializable summary per showcase: final value, invested, total and annualized return, CDI and IBOV final values, max drawdown, volatility, total costs, period, computedAt, and a downsampled monthly series of ≤ 72 points.
   - The window changes once per month, so the cache naturally turns over monthly.
   - On any error, return `null` for the whole block and log once. Never throw into the page.
   - Pure helpers (window, downsampling, summary mapping, "all-or-nothing" rule) are unit tested without Prisma.
2. **Cron (P1).** `GET /api/cron/backtest-showcase` with the existing `CRON_SECRET` check (copy the pattern from `api/cron/macro-indicators`) calls `revalidateTag('backtest-showcase')` and then warms it. Add it to the RESUME "agendar no agendador externo" list in your report; do not edit RESUME.
3. **UI (P0).** `ShowcaseCard`:
   - title + "por que";
   - 4 stats: final value, return, CDI, Ibovespa;
   - drawdown line;
   - a small line chart (portfolio vs CDI vs IBOV, chart tokens, no gradients);
   - disclosure footer;
   - CTA.
   The CTA:
   - premium: "Abrir no backtest" → the w7-backtest-flow quick-run endpoint with the same tickers/params, landing on the result;
   - free: "Ver planos";
   - anon: "Criar conta grátis" (`/register?returnUrl=/backtest`).
   A compact `ShowcaseStrip` shows 3 rows with return, CDI and drawdown for the home.
4. **Placement (P0).**
   - /backtest landing (anon): replace `ExamplePortfolioCard` with the 3 cards.
   - Upgrade card (free): one compact strip.
   - Home "Backtest" block: replace the static image with the strip, keep the copy, and remove `/images/product/backtest.webp` from the page.
   - Not in the home hero, and not in e-mails or ads (out of scope).
5. **Methodology (P0).** Add `/metodologia#backtest`:
   - how the simulation works: monthly; buys at the month's close; dividends from DividendHistory, credited on the data-com and reinvested the next month; JCP net of IRRF; cost of 0,03% per trade; whole shares, with cash left over;
   - what is not modeled: IR on gains, spread, slippage, delisted companies;
   - benchmarks: CDI from BCB SGS 12; Ibovespa from `^BVSP`, a price index without dividends;
   - the vitrine rules above, and that definitions only change with a dated note on this page.
6. **States (P0).** Loading uses a server component, so there is no client spinner. Unavailable means the block is hidden and the page still reads well. Dark mode, 320 px, and numbers through `@/lib/format` with `tabular-nums`.

## ACCEPTANCE
- /backtest (anon) shows 3 dated cards with numbers identical to running the same params in the tool as premium. Run each one through the tool and paste both numbers in the report. Allow a tolerance of 1 cent of R$ and 0,1 p.p.
- The home "Backtest" block has no static result image. The strip shows the period and the disclosure, and links to /metodologia#backtest.
- A second page load does not re-run the simulation: server log or timing < 200 ms after warm-up.
- Breaking one definition (e.g. an unknown ticker in a test) hides the whole block.
- check-compliance, check-ui, tsc, eslint and the unit tests pass.

## TEST PLAN
- Unit: window computation at month boundaries, downsampling keeps first/last points, all-or-nothing rule, summary mapping units (fractions vs percent).
- Manual parity: as premium, open each showcase via "Abrir no backtest" and compare the KPIs.
- Screenshots: `--routes /,/backtest --auth all --viewports small,mobile,desktop --theme both`, and `/metodologia#backtest` desktop light + mobile dark.
- Cron: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3100/api/cron/backtest-showcase` (local secret only) returns 200; without the header it returns 401.
