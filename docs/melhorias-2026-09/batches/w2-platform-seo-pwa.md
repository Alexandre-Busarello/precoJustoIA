# BATCH w2-platform-seo-pwa (wave 2): Platform: activate src/middleware.ts, close public Gemini endpoints, remove debug route, canonical/redirects/robots/sitemap, single gtag, PWA manifest+icons, loading/error states

## OWNED PATHS (edit only these; importing from anywhere is fine)
- middleware.ts
- src/middleware.ts
- src/app/layout.tsx
- src/app/manifest.ts
- public/site.webmanifest
- public/icons/**
- public/ben.png
- next.config.ts
- src/app/robots.ts
- src/app/sitemap.ts
- src/app/page.tsx
- src/app/api/generate-analysis/**
- src/app/api/review-analysis/**
- src/app/api/ai-reports/[ticker]/generate/route.ts
- src/lib/ai/**
- src/app/api/debug/**
- src/app/error.tsx
- src/app/not-found.tsx
- src/app/acao/[ticker]/loading.tsx
- src/app/fii/[ticker]/loading.tsx
- src/app/bdr/[ticker]/loading.tsx
- src/app/etf/[ticker]/loading.tsx
- src/app/dashboard/loading.tsx
- src/app/carteira/[id]/loading.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: simplificacao.md C1, C3, C5, sections 3 and 5.3-5.4; mobile.md 3.13 and 3.14. Production checks are READ-ONLY curls reported to the owner; never deploy.

1) Middleware (P0). Delete the root middleware.ts (a no-op with precedence over src/middleware.ts). Do not git rm/commit, just delete the file. Then verify on the running dev server (it reloads; if not, wait for the watchdog):
- .next/server/middleware-manifest.json lists /api/:path* and /admin/:path*;
- curl -I /upgrade -> 301 /checkout;
- /fundador -> 410;
- /acao/PETR4 -> 301 /acao/petr4;
- normal /api/* calls still return 200, and the rate limit does not block normal local browsing (if Redis is absent it must fail open; confirm in the log).
Also add a declarative redirect for /upgrade and /upgrade/:path* in next.config.ts.

2) Gemini endpoints (P0). Move generateAnalysisInternal and reviewAnalysisInternal (with helpers) into src/lib/ai/generate-analysis.ts and src/lib/ai/review-analysis.ts, update the imports in src/app/api/ai-reports/[ticker]/generate/route.ts (lines ~6-7), and delete the two public route.ts files. Check the ai-reports generate route itself enforces auth (session admin/premium or CRON_SECRET); add a check if missing. POST /api/generate-analysis must return 404. Do NOT call any generation to test.

3) Debug (P0). Delete src/app/api/debug/user-status (it writes to the DB via syncUserSubscription and has no callers; confirm with grep in src and scripts).

4) SEO (P0).
- Remove alternates.canonical '/' from the root layout and set it only in src/app/page.tsx. Other owners set their own canonicals; list in the report every public route that ends up with NO canonical (curl each route of the baseline list).
- next.config.ts redirects (permanent): /backtesting-carteiras -> /backtest; /comparador-etfs -> /comparador?tipo=etfs; /upgrade(/:path*) -> /checkout.
- robots.ts: replace /backtesting-carteiras with /backtest in allow and remove '/test-markdown/'.
- sitemap.ts: ensure /backtest and /comparador are present, /comparador-etfs is absent, add /calculadoras.
- Keep /webhooks/stripe untouched.

5) layout.tsx (P1).
- ONE gtag.js script (G-G7T3PKSEY4) with both config calls (G- and AW-) and strategy 'lazyOnload'.
- Remove the manual <link rel=manifest> and the favicon-as-apple-touch-icon; metadata.icons uses /icons/apple-touch-icon.png (180).

6) PWA (P1).
- Delete public/site.webmanifest.
- Generate public/icons/icon-192.png, icon-512.png, icon-maskable-512.png (brand mark centered with a 20% safe zone on the brand background) and apple-touch-icon.png (180). Render them from an inline SVG/HTML of the brand mark with Playwright screenshots or sharp; they must be crisp.
- manifest.ts: name 'Preço Justo AI', short_name 'Preço Justo', start_url '/?source=pwa', display 'standalone', background_color '#ffffff', theme_color '#ffffff', correct icons, no fake screenshots.
- Replace public/ben.png content with a 256x256 optimized PNG (< 60 KB, same file name, so no references change).
- The service worker is deferred.

7) States (P1).
- loading.tsx skeletons for /acao, /fii, /bdr, /etf (AssetHeader + table shape), /dashboard and /carteira/[id] (ui/skeleton).
- src/app/error.tsx (client; message + 'Tentar novamente' -> reset()).
- src/app/not-found.tsx (simple, with search + home link).

ACCEPTANCE:
- All the curls above behave as described.
- POST /api/generate-analysis -> 404; /api/debug/user-status -> 404.
- /backtesting-carteiras -> 308 /backtest; /comparador-etfs -> 308 /comparador?tipo=etfs.
- A single gtag.js request per page.
- The manifest is served once, and all icons return 200 with the right sizes.
- Navigating to /acao/x shows the skeleton instantly.
- tsc is clean.
- Report the owner's production checks: curl -I https://precojusto.ai/upgrade and /fundador (before/after deploy).

## TEST PLAN
Shell (local only):
- curl -sI localhost:3100/upgrade | head -3; /fundador; /acao/PETR4; /backtesting-carteiras; /comparador-etfs; curl -s -X POST localhost:3100/api/generate-analysis -o /dev/null -w '%{http_code}'; /api/debug/user-status.
- For each baseline public route: curl -s <route> | grep -o 'rel="canonical"[^>]*' (report the table).
Playwright:
- count requests to googletagmanager.com/gtag/js (== 1);
- fetch /manifest.webmanifest and each icon (200, PNG dimensions via sharp);
- the <head> has exactly one rel=manifest;
- throttle the network and navigate to /acao/petr4 -> the skeleton is visible before content.
Also browse /acao/petr4, /ranking and /dashboard normally with API calls -> no 429 from the rate limiter in normal use.


## Carry-over from wave 1 (added before launching wave 2)
- Add a permanent redirect /comparador-etfs → /comparador?tipo=etfs in next.config.ts (check the comparador already reads `tipo=etfs`).
- Do NOT edit vercel.json crons (owner action).
