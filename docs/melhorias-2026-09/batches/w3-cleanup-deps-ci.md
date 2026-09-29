# BATCH w3-cleanup-deps-ci (wave 4 — runs after the wave-3 batches w3-onde-aportar and w3-screening-filters): Cleanup: delete verified dead code, remove unused dependencies, lint errors, CI quality workflow (no build)

## OWNED PATHS (edit only these; importing from anywhere is fine)
- package.json
- yarn.lock
- eslint.config.mjs
- .github/workflows/quality.yml
- scripts/check-ui.sh
- scripts/check-ui.allowlist
- scripts/check-compliance.sh
- DELETE-ONLY: src/components/ai-analysis.tsx, src/components/asset-type-hub-wrapper.tsx, src/components/asset-type-hub.tsx, src/components/hub-metadata.tsx, src/components/seo-content-hub.tsx, src/components/auth-modal.tsx, src/components/blur-card.tsx, src/components/checkout-form.tsx, src/components/card-payment.tsx, src/components/pix-payment.tsx, src/components/generate-backtest-modal.tsx, src/components/mobile-wizard-wrapper.tsx, src/components/overall-score-card.tsx, src/components/portfolio-ai-cta.tsx, src/components/portfolio-negative-cash-alert.tsx, src/components/portfolio-transaction-ai-cta.tsx, src/components/ranking-history.tsx, src/components/seo-structured-data.tsx, src/components/stock-comparison-selector.tsx, src/components/subscription-manager.tsx, src/components/tools-dropdown.tsx, src/components/trial-banner.tsx, src/components/trial-notification.tsx, src/components/ui/form.tsx, src/components/admin-ticket-details-dialog-backup.tsx, src/lib/admin-auth.ts, src/lib/ben-quick-actions.ts, src/lib/dashboard-tips.ts, src/lib/security-middleware.ts, src/lib/simple-premium-check.ts, src/lib/stripe-client.ts, src/components/oportunidades-dropdown.tsx, src/components/analise-estrategia-dropdown.tsx, src/components/carteiras-dropdown.tsx, src/components/ben-proactive-popup.tsx, src/app/test-markdown, src/app/early-adopter, src/contexts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: simplificacao.md sections 3, 4 and 7. This batch runs in parallel with w3-dark-mode-final-qa, which edits live UI files. Do NOT edit live files: only delete the listed files and edit package/config/scripts.

1) Dead code (P1). For EACH file in the delete list: re-verify zero importers right before deleting (grep for the module name in src/, scripts/ and prisma/, and/or run the import-graph script docs/melhorias-2026-09/tools/import-graph.mjs). Delete only the files still unreferenced. Several were made dead by waves 0-1 (old dropdowns, ben-proactive-popup); skip and report any that are still referenced. Delete the empty dirs src/app/test-markdown, src/app/early-adopter and src/contexts only if they are empty.

2) Dependencies (P1). Verify 0 imports, then 'yarn remove @next-auth/prisma-adapter @hookform/resolvers react-hook-form rehype-highlight framer-motion'. Move @types/nodemailer to devDependencies. Keep react-is (recharts peer). Remove the dead 'debug:api' script. Run 'yarn install' (postinstall prisma generate is safe). The dev server must keep working.

3) Lint (P1). npx eslint src: 0 errors (w2-ui-institutional-auth fixed features-portfolio; fix any remaining errors ONLY in deleted/config files, and report others). Warnings are out of scope: the unused-imports sweep is deferred to a separate PR after merge.

4) CI (P1). .github/workflows/quality.yml on pull_request:
- node 20 + yarn install --frozen-lockfile with PRISMA_SKIP_POSTINSTALL_GENERATE unset (prisma generate needs no DB);
- npx tsc --noEmit, npx eslint src, yarn test, bash scripts/check-ui.sh (changed files vs the base branch), bash scripts/check-compliance.sh.
- NEVER run yarn build or anything that uses DATABASE_URL.
- Tighten check-ui.sh allowlist entries that are no longer needed.

5) Metrics. Run bash scripts/check-ui.sh --all and compare with the wave-0 baseline counts (the goal is > 90% fewer bg-gradient-to, 0 emoji in UI). Report the numbers.

ACCEPTANCE:
- tsc is clean and eslint has 0 errors.
- yarn install and the dev server work; the 40 baseline routes return 200.
- The removed deps are absent from package.json.
- The workflow file is valid YAML and never calls build.

## TEST PLAN
(1) After each deletion group: npx tsc --noEmit.
(2) yarn install; curl -s -o /dev/null -w '%{http_code}' for the baseline routes (all 200).
(3) npx eslint src (0 errors).
(4) yarn test (all unit tests from waves 0-2 green).
(5) bash scripts/check-ui.sh --all and bash scripts/check-compliance.sh outputs in the report.
(6) The ranking wizard still animates between steps after removing framer-motion (/ranking).
