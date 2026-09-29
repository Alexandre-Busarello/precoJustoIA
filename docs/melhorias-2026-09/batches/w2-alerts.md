# BATCH w2-alerts (wave 2): Retention alerts: price-ceiling (Bazin), discount vs model fair value, DY TTM; prefilled creation; plan limits

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/custom-trigger-service.ts
- src/lib/asset-monitoring-service.ts
- src/lib/custom-trigger-report-service.ts
- src/components/custom-monitor-form.tsx
- src/components/custom-monitors-list.tsx
- src/components/monitor-limit-banner.tsx
- src/app/api/user-asset-monitor/**
- src/app/dashboard/monitoramentos-customizados/**
- src/lib/__tests__/alerts/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md section 7 (F4). No schema change: UserAssetMonitor.triggerConfig is JSON. NEVER send e-mails locally: the seed users have email notifications off. Verify triggering through unit tests and a local-DB evaluator run, never the production cron.

1) Trigger types (P0). Keep the existing types; add:
- 'bazin_ceiling' { targetYield = 0.06 }: ceiling = averageFullYears(dividends + JCP, 5)/targetYield, computed here with finance/dividends (no dependency on the Bazin strategy file);
- 'fair_value_discount' { model: 'graham'|'fcd'|'gordon'|'barsi'|'dividendYield'|..., minDiscount }: fair value read from the latest AssetSnapshot.snapshotData (inspect its shape), discount = marginOfSafety(price, fair);
- 'dy_ttm_above' { minDy }: sumTTM / price.
Implement a PURE evaluator evaluateTrigger(config, context) -> { triggered, message } in custom-trigger-service.ts, and use it inside the existing monitoring flow (asset-monitoring-service) which sets lastTriggeredAt / isAlertActive and enqueues the existing in-app notification + e-mail pipeline (do not change the delivery code).

2) Form (P0). custom-monitor-form.tsx: the new types with pt-BR labels and helper text ('Avise quando o preço ficar abaixo do preço-teto Bazin (DY-alvo 6%)'); prefill from ?ticker= and ?type=; money/percent inputs inputMode='decimal'. custom-monitors-list: human-readable descriptions of each trigger + status (last triggered). API validation (zod) for the new configs in src/app/api/user-asset-monitor/**.

3) Limits (P1). Free: 3 active alerts; premium: unlimited. Reuse the existing limit logic and monitor-limit-banner if present; otherwise implement it in the API (return 403 with a clear message) and show the banner.

4) Tests (src/lib/__tests__/alerts/): evaluator cases for each new type (triggered / not triggered / missing data -> not triggered with a reason) and the limit check.

ACCEPTANCE:
- Tests pass.
- Locally, creating a 'bazin_ceiling' alert for PETR4 as premium works from /dashboard/monitoramentos-customizados/criar?ticker=PETR4&type=bazin_ceiling.
- Running the evaluator via a tsx script with the inline LOCAL DB env and a mocked price below the ceiling marks it triggered; no e-mail is sent.
- A free user cannot create a 4th alert.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/alerts/.
(2) Premium UI: create each new alert type from the prefilled URL; the list shows readable descriptions; dark/light, small/desktop screenshots.
(3) LOCAL DB evaluator run with inline env (script under $SCR, not scripts/): mock the price via the context argument -> triggered=true and lastTriggeredAt set on the LOCAL row; verify EmailQueue has no new row or that the seed user's email preference blocks it.
(4) free@local.test: create 3 alerts, the 4th is refused with a banner.
