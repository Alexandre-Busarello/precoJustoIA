# BATCH w1-portfolio (wave 1): Portfolio (carteira) list/detail/transactions/config/suggestions: tables, mobile cards, forms, no overflow

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/carteira/**
- src/components/portfolio-*.tsx
- src/components/create-portfolio-page.tsx
- src/components/delete-portfolio-dialog.tsx
- src/components/convert-backtest-modal.tsx
- src/components/recovery-calculator-sheet.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.5 and section 4 (tutorial banner); mobile.md 3.8 (holdings) and 3.11 (forms). Do not trigger portfolio AI assistant or transaction-AI calls.

1) List /carteira (P0).
- Full-width table (Nome · Patrimônio · Retorno · Caixa · Nº ativos · Rebalanceamento · Ações), mobile cards.
- Returns shown as text-positive/negative (not a black badge).
- 'Abrir' is the primary action; 'Ver sugestões' moves inside the portfolio.
- portfolio-tutorial-banner: replace the big blue box with a discreet link 'Importar histórico (tutorial de 5 min)' next to 'Nova carteira' and in the empty state, dismiss persisted in localStorage.

2) Detail /carteira/[id] (P0).
- Fix the page overflow (379 px at 360): title and tabs.
- Tabs: wave-0 scrollable underline tabs.
- portfolio-holdings-table (11 columns): mobile = one card per position (ticker, valor atual, retorno %, alocação, with the rest in an expandable section); desktop = DataTable with a sticky ticker column.
- Charts: portfolio chart-1, benchmark chart-2 dashed, pt-BR tooltip, dark-visible.
- portfolio-metrics-card: Stats.

3) Transactions, config, analysis, suggestions, new portfolio (P1).
- DataTable for transactions.
- Forms: inputMode='decimal' + BRL mask for money fields, inputMode='numeric' for quantities, enterKeyHint='go' on the last field.
- portfolio-smart-input textarea 16 px.
- AI assistant components: tokens, no emoji.
- portfolio-suggestions-page: 'Comprar/Vender' badges become 'Ajuste para sua alocação-alvo: comprar N / vender N' (the user's own target, which is compliant).
- Replace native alert()/confirm() in owned files with AlertDialog.
- recovery-calculator-sheet: ui/sheet tokens.
- Note: portfolio-analytics.tsx calculations change in wave 2 (w2-returns); here restyle only.

4) Strip title suffixes in all carteira pages.

ACCEPTANCE:
- scrollWidth == innerWidth at 320/360 on /carteira/[id] and all subpages.
- No emoji; returns use semantic color only.
- Money inputs open the decimal keyboard (inputmode attribute present).
- Dark legible.

## TEST PLAN
Login as premium@local.test (it has the seeded 'Carteira Dividendos'; get its id from /carteira). Routes: /carteira, /carteira/[id], /carteira/[id]/transacoes, /carteira/[id]/analise, /carteira/[id]/config, /carteira/[id]/sugestoes, /carteira/nova, /carteira/tutorial. Viewports 320, small, mobile, desktop; light/dark.
Check:
(1) scrollWidth == innerWidth everywhere.
(2) Holdings render as cards below 640 and as a table at desktop with the sticky first column.
(3) Inputs have inputmode=decimal/numeric.
(4) No window.alert/confirm is triggered by delete flows (they use a dialog; cancel without confirming).
(5) Charts visible in dark.
(6) The tutorial link, when dismissed, stays hidden after reload.
