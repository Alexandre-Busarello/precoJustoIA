# BATCH w1-technical-radars (wave 1): Technical analysis pages, opportunities radar (/radar) and dividend radar (/radar-dividendos): honest encoding, no buy signals, mobile

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/components/technical-analysis-page.tsx
- src/components/technical-analysis-page-limited.tsx
- src/components/support-resistance-chart.tsx
- src/app/acao/[ticker]/analise-tecnica/**
- src/app/bdr/[ticker]/analise-tecnica/**
- src/app/etf/[ticker]/analise-tecnica/**
- src/components/radar-grid.tsx
- src/components/radar-page-content.tsx
- src/components/radar-status-indicator.tsx
- src/components/radar-strategy-badges.tsx
- src/components/radar-ticker-input.tsx
- src/app/radar/**
- src/lib/radar-service.ts
- src/components/dividend-radar-grid.tsx
- src/components/dividend-radar-controls.tsx
- src/components/dividend-radar-page-content.tsx
- src/components/dividend-radar-ticker-page-content.tsx
- src/app/radar-dividendos/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.10, 5.11 and 5.12; mobile.md 3.8 (tabs), 3.9 and 3.10; mercado-financeiro.md section 4 (compliance table).

1) Technical analysis (P0).
- technical-analysis-page.tsx line ~565: the 4 tabs overlap. Use the wave-0 Tabs (scrollable, shrink-0) with short labels if needed ('Indicadores', 'Suporte/resistência', 'Fibonacci', 'Ichimoku').
- Remove 'Compra' everywhere.
- 'Previsão de preços com IA (30 dias)' -> 'Faixa estimada (30 dias) · gerada por IA · não é recomendação'.
- Predicted min/max: neutral text (not red/green) plus a mini range bar showing the current price inside the range.
- The 'Sobrecompra' badge becomes warning.
- Null values via formatNullable (fixes 'SMA 200: R$' empty at line ~615).
- Page header: AssetHeader with price stats only.
- The limited (free) version uses the locked-preview pattern (blurred real content + 1 CTA).
- support-resistance-chart: chart tokens, dark-visible.
- The 3 analise-tecnica pages (acao/bdr/etf): container, header, title suffix.

2) Opportunities radar /radar (P0).
- radar-grid: replace the 8 red/green pills per row with '6/8' + 8 dots of 6 px (filled = passed, hollow = failed), each with an accessible name, and an InfoHint listing the strategies.
- 'Entry Compra/Atenção' -> 'Técnica: dentro da faixa' / 'acima da faixa'.
- The long colored footer legend becomes InfoHints in the column headers.
- Rows in DataTable (sticky ticker column).
- The 'Remover ticker' X (12x12) gets a 44x44 target.
- radar-strategy-badges: the Barsi method is mislabeled 'Bazin'; label it 'Barsi' (wave 2 adds the real Bazin).
- src/lib/radar-service.ts lines ~165 and ~208: 'Compra' -> 'Abaixo do valor estimado'; 'Região segura para entrada' -> 'Dentro da faixa estimada'. Update any consumer inside your files.
- radar-page-content and radar-status-indicator: tokens and neutral status dots with text.

3) Dividend radar /radar-dividendos (P0).
- dividend-radar-page-content.tsx line ~53 calls /api/user/me, which does not exist, so logged-in users see the logged-out state. Use useSession() from next-auth for isLoggedIn.
- Move the SEO paragraphs and the blue notice AFTER the tool.
- Replace the LandingHero usage with PageHeader (do not edit src/components/landing/*).
- Encoding: confirmed = solid brand dot, projected = hollow brand dot (outline), with a legend; the current month gets a bg-surface column instead of thick black borders.
- Replace the hover-only Tooltip with a div trigger (dividend-radar-grid.tsx ~244-265) by a tap-friendly interaction: tapping a month or row opens a Popover (desktop) or a bottom Sheet (mobile) with data-com, pagamento, valor por ação and tipo.
- Mobile: one compact row of 12 dots per company (about 48-64 px tall) instead of 12 cards.
- Ticker page (/radar-dividendos/[ticker]): AssetHeader (price stats) + events DataTable.

ACCEPTANCE:
- No text 'Compra' or 'Região segura' in these routes (grep the owned files + page innerText).
- No saturated pills in radar rows.
- Tabs have no overlap at 320.
- 'SMA 200: R$' is never empty.
- /radar-dividendos is <= 10 screens at 360x740 (or about <= 64 px per company row).
- Logged-in users see the 'meus ativos' filter.
- Provento details open by tap.
- Dark legible.

## TEST PLAN
Routes: /acao/petr4/analise-tecnica, /bdr/aapl34/analise-tecnica, /etf/bova11/analise-tecnica, /radar (premium; anonymous redirects), /radar-dividendos, /radar-dividendos/petr4. Modes: anonymous/free/premium; small/mobile/desktop plus 320 px; light/dark.
Check:
(1) At 320 px the tab labels do not overlap (bounding boxes of the triggers are disjoint).
(2) innerText has no /Compra|Região segura|SMA 200: R\$\s*$/m.
(3) Radar row: '6/8'-style count + 8 dots; the InfoHint opens on tap.
(4) /radar-dividendos logged in (premium): the 'meus ativos' filter is visible; the network has no 404 to /api/user/me.
(5) Mobile tap on a month -> sheet with data-com and pagamento.
(6) Page height / 740 at 360 px (report the number).
(7) Dark screenshots of all routes.
