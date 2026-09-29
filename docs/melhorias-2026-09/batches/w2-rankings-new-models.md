# BATCH w2-rankings-new-models (wave 2): Rankings pipeline + new models: liquidity filter/dedupe + badge, consistent-profits fix, Barsi full years, Bazin, Peter Lynch, bank P/VP; wiring in registries and pages

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/api/rank-builder/route.ts
- src/lib/rank-builder-service.ts
- src/app/api/ranking/[id]/route.ts
- src/lib/strategies/screening-strategy.ts
- src/lib/strategies/fii-ranking-strategy.ts
- src/lib/strategies/fii-screening-strategy.ts
- src/lib/strategies/barsi-strategy.ts
- src/lib/strategies/bazin-strategy.ts
- src/lib/strategies/lynch-strategy.ts
- src/lib/strategies/bank-pvp-strategy.ts
- src/lib/strategies/strategy-factory.ts
- src/lib/strategies/index.ts
- src/lib/strategies/types.ts
- src/lib/company-analysis-service.ts
- src/components/asset/valuation-models.ts
- src/lib/ranking-models.ts
- src/components/quick-ranker.tsx
- src/components/radar-strategy-badges.tsx
- src/app/api/radar/data/route.ts
- src/app/acao/[ticker]/page.tsx
- src/app/bdr/[ticker]/page.tsx
- src/app/fii/[ticker]/page.tsx
- src/lib/__tests__/strategies/rankings-models.test.ts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md 3.5, 3.6, 3.7 (financials), 3.9 (dedupe), 3.15 and section 7 (F1, F2, F3, F13). Use src/lib/finance/*.

Contracts with w2-valuation-core (A): A owns base/fcd/gordon/graham/magic-formula/lowpe/dividend-yield/strategy-config and the valuation table UI. You own types.ts, the factory and the loaders. Populate CompanyData.dividendHistory (last 6 years, mapped via the finance DividendEvent shape incl. type and paymentDate) for stocks in company-analysis-service.ts and in both loaders of the rank-builder route. A's Gordon consumes it.

1) Liquidity (P0).
- In src/app/api/rank-builder/route.ts (getCompaniesData ~142, getCompaniesDataFii ~72) and src/lib/rank-builder-service.ts getCompaniesData, compute the average daily traded value with getAverageDailyTradedValue (batched), and exclude below LIQUIDITY_DEFAULTS by default. Stocks: 1 mi/day. FIIs: FiiData.liquidez >= 500k. BDRs: do not exclude; flag them.
- Request param minLiquidity: number | null (null = include illiquid).
- Deduplicate share classes of the same company by keeping the MOST liquid ticker (A neutralizes filterTickerEndingDigits).
- Results carry averageDailyTradedValue.
- quick-ranker.tsx: add one checkbox 'Incluir ativos com baixa liquidez' (off by default) plus a column/InfoHint showing the volume.
- Screening (screening-strategy + the screening path in the route) applies the same default.

2) Consistent profits (P0). Both loaders (route ~323 and rank-builder-service ~142-163) must include lucroLiquido, receitaTotal, ebitda and fluxoCaixaOperacional in historicalFinancials so hasConsistentProfits (base-strategy ~493-544) evaluates 8 years.

3) Barsi (P1). calculateAverageDividend uses averageFullYears (5 complete years; no partial current or first year). Label the amounts 'bruto'. The radar mislabels Barsi as 'Bazin': fix radar-strategy-badges (if still present) and src/app/api/radar/data/route.ts (~302).

4) Bazin (new, P0). bazin-strategy.ts:
- ceiling = averageFullYears(dividends + JCP gross, 5)/targetYield (default 0.06, param);
- criteria DY >= 6%, net debt/equity <= 0.5 (financials use the financial criteria), consistent profits;
- fairValue = ceiling, discount/upside, pt-BR reasoning;
- runAnalysis + runRanking + generateRational.

5) Peter Lynch (new, P0). lynch-strategy.ts:
- g = min(validated cagrLucros5a (finite and > 0), 25%);
- PEG = P/L / (g*100); fair P/E = g*100 + DY*100; fair = LPA * fair P/E;
- bands < 0.5 muito barato, 0.5-1 barato, > 1 caro;
- ineligible when LPA <= 0 or isCyclicalCommodity (reason shown).

6) Bank P/VP (new, P1). bank-pvp-strategy.ts, only for isFinancial:
- g = min(ROE*(1-payout), 6%); P/VP justo = fairPVP(ROE 5y avg, g, Ke from computeKe);
- fair = VPA * P/VP justo; ineligible when Ke - g < 4pp.

7) Wiring (P0).
- strategy-factory + index.ts exports.
- company-analysis-service strategies map: bazin, lynch, bankPvp with the same plan gating as the other premium models; the registry 'plan' field lets the owner flip Bazin to free later.
- valuation-models.ts entries: bazin 'Bazin (preço-teto)', lynch 'Peter Lynch (PEG)', bankPvp 'P/VP justo (bancos)' appliesTo 'financial'.
- ranking-models.ts entries for bazin and lynch.
- rank-builder route dispatch and generateRational for them.
- Keep types additive and compile-safe.

8) Liquidity badge (P1). In acao/bdr/fii pages, pass an AssetHeader badge 'Baixa liquidez' (Badge warning) with InfoHint 'Volume médio diário de R$ X nos últimos 60 pregões' when below the threshold. Touch only that part of the pages.

9) Tests (rankings-models.test.ts):
- Bazin with 6 years + a partial current year (uses 5 full years);
- Lynch 3 PEG cases + cyclical exclusion;
- bank P/VP;
- liquidity exclusion with an injected liquidity map;
- dedupe keeps the most liquid class;
- consistent profits: 8 years with 3 losses excluded, 2 kept.

ACCEPTANCE:
- Default rankings exclude an illiquid ticker and the page shows the badge. To simulate: in the LOCAL DB only, lower HistoricalPrice volume for HAPV3 (UPDATE with inline env; re-seeding restores it).
- BBAS3, ITUB4 and BBSE3 appear in the dividend ranking when they meet the financial criteria.
- Bazin and Lynch rows appear on premium /acao/petr4 and are selectable in /ranking.
- Tests pass; tsc is clean.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/strategies/rankings-models.test.ts.
(2) LOCAL DB only (inline env): set HAPV3's daily volumes near zero; run /ranking Graham as premium -> HAPV3 absent; tick 'Incluir ativos com baixa liquidez' -> present; /acao/hapv3 shows the 'Baixa liquidez' badge. Restore with the seed.
(3) /ranking: the Bazin and Lynch models exist in the selector and return results.
(4) /acao/petr4 premium: Bazin and Lynch rows in the valuation table; /acao/itub4: the P/VP justo row appears and the FCD row is not applicable.
(5) The dividend ranking as premium includes financial tickers.
(6) /radar shows 'Barsi' (not 'Bazin') for the Barsi method.
(7) Dark/light screenshots of the changed pages.
