# BATCH w2-dividends-agenda (wave 2): Dividend agenda (watchlist + portfolio) with ICS export, deterministic dividend projections (no LLM), portfolio dividend suggestions from DividendHistory, projected monthly income, yield on cost

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/lib/dividend-service.ts
- src/lib/dividend-radar-service.ts
- src/app/api/dividend-radar/projections/**
- src/app/agenda-proventos/**
- src/app/api/agenda-proventos/**
- src/lib/portfolio-transaction-service.ts
- src/components/portfolio-holdings-table.tsx
- src/lib/navigation.ts
- src/app/dashboard/page.tsx
- src/components/dashboard-agenda-widget.tsx
- src/lib/__tests__/dividends/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: mercado-financeiro.md 3.16 and section 7 (F5, F6 dividend part, F12). No schema changes. No emails: the weekly summary e-mail is deferred.

1) Deterministic projections (P0). dividend-radar-service.ts (~261-300) projects dividends with an LLM (gemini-flash-lite). Replace it with projectSeasonal from finance/dividends; label the values 'estimativa estatística'. Keep the exported function signatures used by the radar components; remove the Gemini import/usage from this service and from api/dividend-radar/projections if it calls the LLM.

2) Agenda page (P0). /agenda-proventos: logged-in only (redirect anonymous users to /login?callbackUrl=...); metadata robots noindex.
- Events for the user's watchlist (RadarConfig) + portfolio assets, from DividendHistory + projections: data-com, pagamento, valor por ação, tipo (JCP/Dividendo/Rendimento), bruto/líquido (jcpNet), and for portfolio positions the estimated amount = quantity held at the ex-date.
- Filters: Carteira / Radar / Todos; próximos 30/90 dias / últimos 90 dias.
- DataTable with a sticky ticker column; empty state with a link to /radar.
- Monthly income projection for the portfolio (next 12 months): bars in chart-1, solid for confirmed and outline/hollow for projected, with a legend.
- Buttons: 'Baixar .ics' and 'Adicionar ao Google Agenda'.

3) API (P0). src/app/api/agenda-proventos/route.ts (JSON, session required) and src/app/api/agenda-proventos/ics/route.ts (text/calendar; RFC 5545: CRLF line endings, VCALENDAR/VEVENT, DTSTART;VALUE=DATE on the payment date, else the ex-date labeled 'Data-com', UID stable per event, SUMMARY '<TICKER> JCP R$ 0,45/ação'). Session required.

4) Portfolio dividends (P1). portfolio-transaction-service.ts (suggestions near ~1822): compute DIVIDEND suggestions from DividendHistory x the position held at the ex-date (from confirmed transactions), with JCP net; dedupe against existing DIVIDEND transactions. Keep the confirm/reject flow: never auto-write transactions without user confirmation. Add yield-on-cost (annual TTM dividends / average cost) as a column in portfolio-holdings-table.tsx (desktop table and mobile card).

5) Navigation + dashboard (P1).
- navigation.ts: add 'Agenda de proventos' (/agenda-proventos) to the app Alertas group (and to Carteiras if it fits the 5-item rule).
- dashboard-agenda-widget.tsx: 'Próximos proventos' with 5 rows + link; add it to /dashboard/page.tsx.

6) Tests (src/lib/__tests__/dividends/): projection determinism with a fixture, ICS string validity (CRLF, required fields), position-at-ex-date calculation with buys/sells around the date, JCP net.

ACCEPTANCE:
- premium@local.test (seeded 'Carteira Dividendos' + radar) sees ordered events and a 12-month income chart.
- The .ics download opens as a valid calendar (parse it in a test).
- The radar-dividendos projections no longer reference Gemini (grep).
- Dark legible; no overflow at 360.

## TEST PLAN
(1) npx tsx --test src/lib/__tests__/dividends/.
(2) Premium: /agenda-proventos light/dark at small/mobile/desktop; toggle the filters; the chart renders; download the .ics via Playwright (page.waitForEvent('download')) and check it starts with BEGIN:VCALENDAR and uses CRLF.
(3) Anonymous -> /agenda-proventos redirects to login.
(4) /dashboard shows the widget; /carteira/<id> shows the yield-on-cost column/card.
(5) /radar-dividendos renders projections with the 'estimativa estatística' label; grep -n gemini src/lib/dividend-radar-service.ts -> 0.
(6) Portfolio transactions page: the suggested dividends list appears and nothing is auto-confirmed.
