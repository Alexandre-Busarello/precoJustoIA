# BATCH w5-dividends-bdr-data (wave 5): data quality for FII dividends and BDR fair values

Read docs/melhorias-2026-09/backlog-rules.md first. **No Prisma schema change and never write to the production DB.** Code-only fixes; local DB for tests.

## OWNED PATHS
- src/lib/dividend-service.ts (dedupe/normalization only), src/lib/finance/dividends.ts (a new dedupe helper only, backward compatible)
- src/lib/bdr-data-service.ts
- src/lib/strategies/base-strategy.ts (BDR not-applicable helper only)
- src/lib/__tests__/data-quality/** (new)

## TASKS
1. **FII dividends duplicated across sources (P0).** For HGLG11 the local DB has Yahoo rows (amount 1.17, no type or paymentDate, ex on the 1st) next to seed RENDIMENTO rows (ex on the 3rd). Duplicates inflate yield on cost, DY TTM and the agenda.
   - Add a read-time dedupe in finance/dividends: same ticker, |exDate diff| ≤ 5 days, amounts within 2%; prefer the row with type/paymentDate.
   - Apply it in DividendService readers.
   - In the writer, stop inserting the near-duplicate (upsert by window).
   - The repeated `upsert-dividend_history` unique-constraint errors in dev.log come from the same path: fix them.
2. **BDR fair values (P1).** Today all models are "não aplicável" for BDRs because FinancialData lacks currency/parity/FX. Without a schema change:
   - derive parity (BDR ratio) from B3 data, if bdr-data-service already fetches it, or from a static, documented map of the most traded BDRs;
   - derive USD/BRL from the quote source (Yahoo `BRL=X`, cached per day);
   - convert the underlying per-share fundamentals.
   Only when all three exist, enable Graham/FCD/Gordon/Bazin for that BDR; otherwise keep "não aplicável" with the reason. Never show a negative or >500% potential.
   If this is not feasible without a schema change, stop at a documented design and report it.

## ACCEPTANCE
- HGLG11 agenda and DY TTM no longer double count (local DB).
- No unique-constraint errors when opening /fii/hglg11.
- AAPL34 either shows sane converted fair values (with "convertido por paridade X e câmbio Y") or "não aplicável" with the reason.
- Tests for dedupe and conversion.
