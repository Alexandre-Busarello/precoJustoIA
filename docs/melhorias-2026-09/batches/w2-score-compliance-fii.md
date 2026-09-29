# BATCH w2-score-compliance-fii (wave 2): Overall/FII score methodology, FII price ceiling (12m / NTN-B spread), AI strategy without numeric fair values, Ben guardrail, compliance copy + CI grep

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/strategies/overall-score.ts
- src/lib/strategies/fii-overall-score.ts
- src/lib/fii-listing-valuation.ts
- src/lib/strategies/ai-strategy.ts
- src/lib/ben-service.ts
- src/components/rentability-selector.tsx
- src/lib/rentability-service.ts
- src/components/company-preview.tsx
- src/app/api/company-preview/[ticker]/route.ts
- src/components/fii-strategic-analysis.tsx
- scripts/check-compliance.sh
- src/lib/__tests__/strategies/overall-score.test.ts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md 3.11, 3.13, 3.17 and section 4. NEVER call Gemini: test prompts by reading the code, and the AI strategy by unit-testing the post-processing only.

1) Overall score (P0; overall-score.ts ~4119, 4144-4200, 4665-4730, 4255-4266, 4928-4968).
- Normalize the weights to sum to 1 (with and without dividends).
- A missing datum is NEUTRAL: exclude it from the denominator instead of counting it as passed. Return dataCoverage {used, total} so the UI can show 'nota baseada em X de Y critérios'.
- Remove the 10% YouTube sentiment from the score (keep the data available separately for display).
- Correct the lowPE and magicFormula descriptions.
- recommendation strings become quality labels ('Qualidade alta/boa/moderada/baixa'). Keep the field name recommendation for compatibility and add qualityLabel.

2) FII (P0).
- fii-listing-valuation.ts: ceiling = sum of the last 12 distributions (annualizeFromLast12) / DY-alvo. DY-alvo = ntnbRealLong + ipcaExpected + spread (tijolo 2.5pp, papel 2pp, default 2.5pp) from getMacroAssumptionsSync(); keep a fallback. Remove the 0.55 heuristic. KEEP the exported function names and signatures (the FII page and listings use them); add optional params.
- fii-overall-score.ts: scoreDY differentiates papel vs tijolo (papel 13-15% is normal); rename the displayed 'gestão' pillar label to 'Segmento e resiliência' (keep the key); qualityLabel.
- fii-strategic-analysis.tsx: show the DY-alvo and the assumptions line ('NTN-B + IPCA esperado + spread de N pp'), consistent with the header.

3) AI strategy (P0; ai-strategy.ts ~563-590, ~1078). The LLM must not produce numeric fairValue/upside. Set them to null (or derive them from the deterministic models' median) and restrict the prompt to summarizing the calculated models. Remove 'ranking preditivo personalizado por perfil de risco'.

4) Ben (P0; ben-service.ts ~1745, ~1749). Replace 'qual a recomendação' / 'ao recomendar investimentos' with instructions to explain what the models indicate without recommending buy or sell. Add a refusal guardrail for 'devo comprar/vender X?' answering with an explanation plus the disclaimer.

5) Copy (P0).
- rentability-selector.tsx ~487: 'Rentabilidade mínima garantida' -> 'Piso de simulação: 5% a.a. (hipótese, não garantia)'.
- rentability-service: offer 'CDI líquido' (cdi * 0.85 from macro) as the risk-free alternative.
- company-preview.tsx (~479, ~602) and api/company-preview/[ticker]/route.ts (~322): remove the mock 'Compra'.

6) CI grep (P1). scripts/check-compliance.sh: case-insensitive grep over src/**/*.ts(x) user-facing strings for 'Compra\b|Sinal de compra|Região segura|garantid|preditiv|únic[oa]s? (no|do) (Brasil|mercado)|melhores ações|recomendação'. Exclude console.* lines, admin, and lines containing 'não é recomendação' / 'não constitui recomendação' / 'não são recomendação'; also support an allowlist file. Exit 1 with file:line. Run it, fix the hits inside your files, and LIST the hits in other files in your report (w3 fixes leftovers).

7) Tests (overall-score.test.ts): a perfect synthetic company can reach 100; a company with 50% missing data does not outscore an otherwise identical company with complete data; the weights sum to 1.

ACCEPTANCE:
- Tests pass and tsc is clean.
- FII ceiling: monthly 0.10 with a 10% target -> 12.00 (covered by the foundation test; add an integration test for fii-listing-valuation).
- /fii/hglg11 shows a coherent ceiling and DY-alvo.
- check-compliance.sh reports 0 hits in owned files.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/strategies/overall-score.test.ts (+ finance tests).
(2) Premium /fii/hglg11 and /fii/mxrf11 light/dark: the ceiling and potential agree in sign, the DY-alvo assumption line is visible, the pillar is named 'Segmento e resiliência'.
(3) /acao/petr4: the score block shows coverage 'X de Y critérios' if the UI surfaces it (the UI may be handled later; at least verify the API/analysis payload includes dataCoverage via a local fetch of the page data or unit test).
(4) bash scripts/check-compliance.sh — paste the output.
(5) /arbitragem-divida: the selector copy shows 'Piso de simulação'.
(6) Read ben-service prompt diff; no network calls to Gemini during tests.
