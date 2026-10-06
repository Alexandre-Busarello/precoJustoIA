# BATCH w1-ranking (wave 1): Ranking (/ranking): server metadata (canonical fix), no intermediate screen, model registry, results table, drop framer-motion usage

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/ranking/**
- src/components/ranking-wizard/**
- src/components/quick-ranker.tsx
- src/components/ranking-history-section.tsx
- src/components/etf-ranker.tsx
- src/components/batch-backtest-selector.tsx
- src/components/add-to-backtest-button.tsx
- src/lib/ranking-models.ts

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.6 (ranking); simplificacao.md C2 and section 4 (framer-motion); mobile.md 3.11 (sticky CTA). Do not run the 'ai' ranking model (it calls Gemini). The backup files page-old.tsx, page-backup.tsx and page-new.tsx in src/app/ranking are dead; delete them (verify with grep that nothing imports them).

1) Canonical/metadata fix (P0). /ranking is 'use client' with next/head, so it publishes the home title and canonical. Move the client UI to src/app/ranking/ranking-client.tsx ('use client'). page.tsx becomes a server component exporting metadata: title 'Rankings de ações da B3 por estratégia', a pt-BR description, alternates.canonical '/ranking', openGraph. Remove next/head.

2) No intermediate screen (P0).
- /ranking opens directly on the Graham ranking (free model) with the results visible.
- Model selector at the top (Select or underline Tabs), built from a new typed registry src/lib/ranking-models.ts [{ key, label, plan, assetType: 'stock'|'fii'|'etf'|'bdr', description, isAi? }], using pt-BR names ('Número de Graham', 'Anti-armadilha de dividendos', 'P/L baixo com qualidade', 'Fórmula Mágica', 'Fluxo de caixa descontado', 'Gordon', 'Fundamentalista 3+1', 'Barsi', FII and ETF models). Render the registry generically: wave 2 adds 'bazin' and 'lynch' entries and the matching API support without touching the UI.
- Parameters in a collapsible panel.
- Results in a DataTable (Ticker · Empresa · Preço · Preço justo · Margem de segurança (marginOfSafety) · Score) with a sticky ticker column on mobile.
- 'Histórico' becomes a tab (ranking-history-section restyled; it is also rendered by the dashboard, so keep its props).
- Remove the gradient title strip, the icon tiles and the 'O que você quer fazer?' destination step (step-destination).
- Plan limits stay as they are (free: Graham top 10).

3) Mobile (P1). The primary action 'Gerar ranking' sits in a sticky bottom bar (h-12, safe-area padding, above the bottom nav) while configuring.

4) framer-motion (P1). Rewrite the ranking-wizard.tsx transitions with CSS/tw-animate-css classes and remove every framer-motion import from owned files (the package removal happens in wave 3).

5) Copy and add-ons (P1).
- Remove 'Ranking inteligente', 'melhores' and any 'Compra'; add the one-line disclaimer + /metodologia link under the results.
- quick-ranker (3,851 lines): restyle, tokens, lib/format, no emoji. Split it into smaller files inside src/components/ranking-wizard/ if that helps.
- etf-ranker, batch-backtest-selector, add-to-backtest-button: tokens.

ACCEPTANCE:
- curl -s localhost:3100/ranking shows <title>Rankings de ações da B3 por estratégia | Preço Justo AI</title> and rel=canonical https://precojusto.ai/ranking.
- A useful result is visible with 0 clicks for anonymous and free users.
- No framer-motion imports in owned files.
- Mobile CTA always visible; no overflow at 320; dark legible.

## TEST PLAN
Routes: /ranking (anonymous, free, premium), the /ranking history tab, and /dashboard (ranking-history-section regression). Viewports 320/small/mobile/desktop; light/dark.
Check:
(1) curl the title and canonical (shell: curl -s http://localhost:3100/ranking | grep -Eo '<title>[^<]*|rel="canonical"[^>]*').
(2) On first load the results table has rows without any click.
(3) Switch the model to Gordon / FCD as premium; results render (local DB compute only; never select AI).
(4) Sticky CTA visible at 360 while scrolling the params panel.
(5) grep -r framer-motion src/components/ranking-wizard src/components/quick-ranker.tsx returns 0.
(6) scrollWidth == innerWidth at 320.
