# BATCH w5-data-consistency (wave 5): same numbers everywhere for the same ticker

Read docs/melhorias-2026-09/backlog-rules.md first. No Prisma schema change (the production build runs `prisma db push`). Run tests with `timeout 300`; unit tests must not import Prisma.

## OWNED PATHS
- src/lib/rank-builder-service.ts, src/lib/company-analysis-service.ts (loaders/params only)
- src/lib/strategies/fii-ranking-strategy.ts, src/lib/strategies/fii-dividend-yield-strategy.ts (or wherever fiiDividendYield lives), src/lib/strategies/fii-overall-score.ts
- src/lib/strategies/strategy-factory.ts (defaults wiring only)
- src/lib/etf-scoring*.ts and the ETF preset matching code
- src/app/api/rank-builder/route.ts (defaults/premium only; keep the `preview` flag and the Premium gates)
- src/lib/__tests__/consistency/** (new)

## TASKS
1. **Asset page × ranking (P0).** For the same ticker, the asset page (`executeCompanyAnalysis`) and the ranking (`rank-builder-service` loaders) must feed the same CompanyData fields: dividend history window, historical financials, macro assumptions, growth inputs. They must also use the same default params. Known gaps:
   - Gordon VALE3 is R$ 86,80 on the page × R$ 80,08 in the ranking;
   - Gordon g = 0% on the page for PETR4 and TAEE11, but 4–5% in the ranking;
   - FCD fair values also differ.
   Unify on one loader/params path. When the user changes ranking sliders, differences are expected and must be explained in the row ("parâmetros do ranking: …").
2. **FII defaults (P1).** `fiiDividendYield` falls back to `maxPvp ?? 1.3` and `limit ?? 100`; `fiiRanking` falls back to `limit ?? 100`. The registry (src/lib/ranking-models.ts) says 1,1 / 50 / 30. `withRegistryDefaults` only covers stocks: extend it to FIIs.
3. **FII segment pillar (P1).** It scores 60 in the ranking × 80 on the FII page because `lastFetchedAt` isn't passed in the ranking path. Pass it.
4. **ETF scoring (P2).**
   - A fee or return equal to 0 is treated as missing: use null checks, not falsy checks.
   - The fixed-income preset matches "ima" by substring: use a word or explicit list.
5. **Magic Formula plan (P2).** The registry says premium, but the API gives 3 results to the free plan. Keep the API behavior (marketing pages rely on it) and make the registry/UI copy say "3 resultados no plano gratuito".

## ACCEPTANCE
- A test that runs the asset-page path and the ranking path on the same fixture CompanyData and asserts equal fair values for Graham, FCD, Gordon and Bazin.
- On the local DB: /acao/vale3 Gordon equals the default Gordon ranking value for VALE3 (screenshot + API JSON).
- FII ranking defaults equal the registry.
- tsc, eslint and check-ui are clean.
