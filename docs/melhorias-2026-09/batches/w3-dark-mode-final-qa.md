# BATCH w3-dark-mode-final-qa (wave 4 — runs after the wave-3 batches w3-onde-aportar and w3-screening-filters): Dark mode verification on every route + fix leaks, compliance/UI-guardrail leftovers, enable the theme toggle and system default, final mobile QA

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/** (live UI files only; excludes files deleted by w3-cleanup-deps-ci and src/app/admin/**)
- src/components/** (live UI files only; excludes files deleted by w3-cleanup-deps-ci and src/components/admin/**)
- src/lib/theme.ts
- public/logo-*

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Owner requirement: dark mode across the whole platform, only if it works everywhere and looks good. This batch is the gate.

1) Full dark sweep (P0). Run the screenshot script over ALL routes (the baseline list + /agenda-proventos, /calculadoras, /dashboard/subscriptions, /dashboard/monitoramentos-customizados, /notificacoes, /perfil, /carteira/[id] subpages, /radar-dividendos/petr4, /acao/petr4/relatorios, /checkout mocked) with --auth both --viewports small,mobile,desktop --theme both. Inspect every dark screenshot and fix:
- white/light leaks (bg-white, bg-gray-50, bg-*-50 sections);
- illegible text (text-gray-*, text-black);
- invisible borders;
- invisible charts (hardcoded stroke/fill hex; switch to var(--chart-*) / currentColor);
- images/logos without a dark variant;
- toasts, tooltips, popovers and skeletons;
- markdown (dark:prose-invert);
- Recharts tooltips/axes;
- Stripe elements (appearance theme from the resolved theme).
Remove the remaining legacy dark: classes in files you touch. Also fix light-mode regressions you notice.

2) Leftovers (P0). Run bash scripts/check-compliance.sh and bash scripts/check-ui.sh --all; fix the remaining hits in live UI files (copy + tokens). Emoji in UI must reach 0.

3) Enable (P0). Once every route passes, set THEME_DEFAULT = 'system' and THEME_TOGGLE_ENABLED = true in src/lib/theme.ts (keep FORCED_LIGHT_PREFIXES ['/admin', '/oferta']). Verify the toggle in the header, mobile drawer, avatar menu and /perfil, persisted across reloads, with no flash of the wrong theme (hard reload with a system dark preference).

4) Final QA (P0). Measure and report a table against the global acceptance criteria:
- home height at 1440/390 and screens at 360;
- sticky chrome <= 56 px;
- overflow at 320/360/390 on all routes, including screening results and the carteira detail;
- Geist loaded;
- bg-gradient-to count vs baseline (> 90% reduction);
- emoji = 0;
- no automatic interruption in the first 30 s on any route;
- the 4 answers above the fold on /acao, /fii, /etf and /bdr at 360x740 and 1440x900;
- tap targets >= 44 px on key routes (docs/melhorias-2026-09/tools/mobile-audit.mjs);
- inputs >= 16 px.
Fix what fails when it is within UI files.

ACCEPTANCE:
- Every route passes dark and light visual review with no leaks.
- The toggle is enabled with the system default and no FOUC.
- The metrics table is all green, or remaining exceptions are documented with a reason.

## TEST PLAN
(1) The full screenshot matrix (both themes); attach the paths per route.
(2) Emulate prefers-color-scheme dark with no stored preference -> the site renders dark on first paint (screenshot at DOMContentLoaded).
(3) Toggle Claro/Escuro/Sistema from the header (desktop) and the drawer (mobile); reload -> it persists.
(4) /admin and /oferta stay light even with the dark preference.
(5) Run docs/melhorias-2026-09/tools/mobile-audit.mjs at 360x740 for sticky height, overflow and tap targets on key routes.
(6) bash scripts/check-ui.sh --all and scripts/check-compliance.sh outputs.
(7) npx tsc --noEmit and yarn test.
