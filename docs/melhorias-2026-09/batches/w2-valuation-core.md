# BATCH w2-valuation-core (wave 2): Valuation math core: FCD (EV->Equity, FCFF, Ke), Gordon (TTM D0, spread), Graham label/normalized EPS, margin vs potential, Magic Formula, P/L baixo, dividend criteria by business type

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/strategies/base-strategy.ts
- src/lib/strategies/fcd-strategy.ts
- src/lib/strategies/gordon-strategy.ts
- src/lib/strategies/graham-strategy.ts
- src/lib/strategies/magic-formula-strategy.ts
- src/lib/strategies/lowpe-strategy.ts
- src/lib/strategies/dividend-yield-strategy.ts
- src/lib/strategies/strategy-config.ts
- src/components/strategic-analysis-client.tsx
- src/components/asset/valuation-table.tsx
- src/lib/__tests__/strategies/valuation-core.test.ts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md 3.1, 3.2, 3.4, 3.7, 3.8, 3.9 and 3.11 (useTechnicalAnalysis). Use the helpers from src/lib/finance/* (created in wave 1); do not re-implement them.

Contracts with the parallel batch w2-rankings-new-models (B):
- B populates CompanyData.dividendHistory (last 6 years, with type/paymentDate) and the historicalFinancials profit fields in the loaders. You consume them when present and fall back gracefully when absent.
- B de-duplicates share classes by liquidity upstream. You make filterTickerEndingDigits in base-strategy.ts return its input unchanged (keep the function and its signature) so liquid PNA/PNB classes (USIM5, BRKM5, ELET6...) are no longer dropped.
- Do NOT edit types.ts, strategy-factory.ts or company-analysis-service.ts (owned by B). The optional fields discount, terminalValueShare and equityBridge already exist on StrategyAnalysis.

1) FCD (P0; base-strategy.ts ~281-336, fcd-strategy.ts ~31-47, 125-214).
- fairValue per share = equityFromEV(EV, totalDivida, caixa)/shares, with fallback EV - (enterpriseValue - marketCap). Remove the 'double counting' comment.
- FCFF = EBIT*(1-34%) + D&A - Capex - ΔNCG from CompanyData.incomeStatements/cashflowStatements/balanceSheets when available. If only levered FCF exists, discount it at Ke and do NOT subtract debt. Never use EBITDA*0.6.
- Growth: min(CAGR 5y of revenue/earnings, 10%) converging linearly to terminal g over the projection years (replace 0.05*e^(-0.5t)).
- Discount rate: Ke from computeKe(getMacroAssumptionsSync()), never below Selic. WACC only for FCFF (Kd*(1-34%) when debt data exists).
- Terminal g: nominal BRL between 4-5% (consistent with the nominal k); document it.
- BDR: discount in USD terms with ust10y + erp (currency conversion is deferred; flag the analysis as 'estimativa em USD convertida' only if the data is in USD — otherwise keep as is and note it).
- Exclude financials (isFinancial) with the reasoning 'Modelo não se aplica a bancos e seguradoras; veja P/VP justo'.
- Fill terminalValueShare and equityBridge.

2) Gordon (P0; gordon-strategy.ts ~155-170, 42-73).
- D0 = removeExtraordinary + sumTTM(dividendHistory) when present; else dividendYield12m * price. Never use ultimoDividendo as D1. D1 = D0*(1+g).
- k = Ke; g <= min(ROE*(1-payout), 6%); require k - g >= 4pp, otherwise ineligible with a clear reason.
- Replace the exact-match sector map with the sector-classification helpers.
- runRanking must use the same metrics (averages) as runAnalysis.

3) Graham (P1). Label 'Número de Graham (preço máximo defensivo)'. Use normalized EPS = average of the last 5 years from historicalFinancials when available, and always for isCyclicalCommodity; say so in the reasoning.

4) Margin vs potential (P0; graham ~166, 211; fcd ~217, 245; base ~431).
- Every analysis/ranking result sets discount = 1 - P/VJ and keeps upside = VJ/P - 1 (potential).
- Filters named marginOfSafety must use discount semantics: update the strategy-config defaults so the same intent holds (document the conversion in comments).
- convertToRankingResult fills both.

5) Magic Formula (P0). EY = 1/evEbit; order by magicFormulaRank (sum of ranks); exclude isFinancial and isUtility; default minEY 0.08 (not 0.8); correct the description.

6) P/L baixo (P1). Correct the description (fixed P/L <= 15, not 'below sector'); financials skip the current-ratio / debt-to-equity criteria.

7) Dividend yield / anti-armadilha (P0; dividend-yield-strategy.ts ~222-230, 264).
- Criteria by business type. Financials: ROE 5y avg >= 12%, payout 25-80%, consistent profits, no current ratio or debt/equity. Utilities: net debt/EBITDA <= 3.5 instead of debt/equity <= 1.
- The rationale text formats DY/ROE/margin with formatPct (it printed 'DY 0.1%').

8) strategy-config (P1). useTechnicalAnalysis: false by default for every model. Fix the Barsi comments/labels (minConsecutiveDividends / maxDebtToEquity, lines ~103-104).

9) UI (P0). valuation-table.tsx / strategic-analysis-client.tsx:
- 'Margem de segurança' = discount (fallback marginOfSafety(price, fairValue));
- 'Potencial' = upside in the expanded row;
- FCD row details show the EV -> Equity bridge (formatBRLCompact) and 'Valor terminal: N% do total';
- Gordon details show D0, g, k;
- Graham label as above.

10) Tests (valuation-core.test.ts) running the strategies' analysis functions on synthetic CompanyData fixtures:
- the FCD bridge (EV 100, net debt 40, 10 shares -> 6.0);
- Gordon TTM with 12 x 0.10;
- Magic Formula ordering with 5 companies;
- a bank fixture evaluated by financial criteria in the DY strategy;
- discount vs upside semantics;
- filterTickerEndingDigits keeps USIM5.

ACCEPTANCE:
- Tests pass and tsc is clean.
- Premium /acao/petr4 and /acao/itub4 render: ITUB4 shows FCD not applicable with the reason; the DY model evaluates ITUB4 by financial criteria.
- The Graham, FCD, Gordon and Fórmula Mágica rankings run from /ranking locally without errors.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/strategies/valuation-core.test.ts plus the finance tests.
(2) Premium screenshots light/dark of /acao/petr4, /acao/itub4, /acao/taee11, /acao/vale3: expand the FCD row (bridge + terminal share visible), Gordon row (D0, g, k), Graham label. Margem and Potencial are distinct: for one row compute 1-P/VJ and VJ/P-1 by hand from the displayed numbers.
(3) /ranking as premium: run Graham, FCD, Gordon, Fórmula Mágica (local compute); no errors in the dev log (<SCRATCH>/dev.log or the terminal output), with non-empty results. Fórmula Mágica excludes banks (ITUB4, BBAS3, BBDC4) and utilities (TAEE11, EGIE3, CMIG4, CPLE6, SBSP3, ELET3).
(4) grep the strategy files for 'EBITDA \* 0.6|0\.05 \* Math.exp' -> 0.
