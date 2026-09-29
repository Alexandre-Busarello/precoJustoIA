# BATCH w1-dashboard-alerts (wave 1): Dashboard focused on data + alerts pages (subscriptions, custom monitors) + notifications page

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/dashboard/**
- src/components/dashboard-portfolios.tsx
- src/components/dashboard-radar-section.tsx
- src/components/dashboard-ibov-banner.tsx
- src/components/dashboard-notification-banner.tsx
- src/components/email-verification-banner.tsx
- src/components/cache-indicator.tsx
- src/components/custom-monitor-form.tsx
- src/components/custom-monitors-list.tsx
- src/components/monitor-limit-banner.tsx
- src/components/subscriptions-list.tsx
- src/components/report-preferences.tsx
- src/app/notificacoes/**
- src/components/notifications-page-client.tsx
- src/components/simple-notification-modal.tsx
- src/components/page-notice.tsx
- src/components/ben-intro-card.tsx
- src/components/alerts-tabs.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.4 and section 4 (banners, upsell); simplificacao.md 5.1-5.2 (dashboard blocks).

1) Dashboard (P0).
- Header: PageHeader 'Visão geral' + today's date (formatDate).
- Row of Stats: patrimônio total, retorno total, variação do dia, ativos no radar (existing hooks/endpoints).
- Radar as DataTable (Ticker · Preço · Δ dia · Margem · Score · Status) with a 'Gerenciar' link to /radar (radar-grid is owned by w1-technical-radars; dashboard-radar-section may build its own table).
- Carteiras as a table (nome · patrimônio · retorno) + 'Nova carteira'.
- 'Rankings recentes': 5-row list via ranking-history-section (owned by w1-ranking; render only).
- 'Boas empresas para analisar' as a 5-row table.
- Static MarketTickerBar at the top (import from src/components/indices/market-ticker-bar).
Remove: '👋', the '✨ Premium' button for payers, 'Minha Conta' (moves to /perfil, done by w1-account-ben-onboarding), 'Atividade', the marketing tiles (Backtesting NOVO / Comparador GRÁTIS / Nova Análise), the duplicate ranking-history block, the WhatsApp block (keep one plain link in the account area if needed), and the 'Compra' badge.
Upsell only for free users: one subtle card. Every block gets loading (skeleton), empty and error states.
Optional if time allows: split the 859-line 'use client' page into a server shell + client islands.

2) One notice slot (P0). Create page-notice.tsx and render at most ONE banner, with priority email verification (email-verification-banner) > trial ending > campaign / IBOV banner (dashboard-notification-banner, dashboard-ibov-banner restyled as neutral inline notices).

3) Ben introduction (P1). Create ben-intro-card.tsx: inline card 'Pergunte ao Ben sobre qualquer ativo' shown once, dismissed forever via localStorage 'pja-ben-intro-dismissed' (try/catch). Replaces the proactive popup.

4) Alerts pages (P1). /dashboard/subscriptions, /dashboard/monitoramentos-customizados (+ criar, editar/[id]) and /notificacoes: PageHeader, DataTable/lists, tokens, ui/dialog modals, no emoji. Create alerts-tabs.tsx (underline tabs linking Meu radar /radar, Alertas de preço, Monitoramentos, Notificações) and render it on these pages. custom-monitor-form: read ?ticker= (and optional &type=) to prefill (the stock page 'Acompanhar' links here); money inputs inputMode='decimal'. simple-notification-modal: ui/dialog, tokens.

5) Strip title suffixes in all owned pages.

ACCEPTANCE:
- Premium dashboard: no upsell CTA and no emoji; at most one notice visible.
- No overflow at 360/320; each block has skeleton/empty/error states.
- The Ben intro card disappears permanently after dismiss.
- /dashboard/monitoramentos-customizados/criar?ticker=PETR4 is prefilled.
- Dark legible.

## TEST PLAN
Routes (premium and free logged in): /dashboard, /dashboard/subscriptions, /dashboard/monitoramentos-customizados, /dashboard/monitoramentos-customizados/criar?ticker=PETR4, /notificacoes; anonymous -> redirect to login. Viewports small/mobile/desktop; light/dark.
Check:
(1) Premium: innerText has no /Premium|Assine|Upgrade/ call-to-action and no emoji.
(2) Free: exactly one upsell card.
(3) Count the notice elements (<= 1), including forcing an unverified-email state if possible by editing the LOCAL DB only (inline env).
(4) Dismiss the Ben card, reload, and confirm it stays hidden.
(5) Throttle the network or block one API to confirm the skeleton and error states render.
(6) The form ticker field is prefilled with PETR4.
(7) scrollWidth == innerWidth at 320/360.
(8) The market ticker is static (no running CSS animation: check getAnimations().length === 0).
