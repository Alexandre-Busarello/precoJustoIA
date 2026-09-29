# BATCH w1-asset-stock (wave 1): Stock page (/acao/[ticker]): AssetHeader, valuation as a table, sticky section nav, inline follow card

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/app/acao/[ticker]/page.tsx
- src/app/acao/[ticker]/not-found.tsx
- src/app/acao/[ticker]/entendendo-score/**
- src/components/strategic-analysis-client.tsx
- src/components/asset/valuation-table.tsx
- src/components/asset/valuation-models.ts
- src/components/asset/follow-asset-card.tsx
- src/components/email-capture-modal.tsx
- src/components/header-score-wrapper.tsx
- src/components/compact-score.tsx
- src/components/asset-subscription-button.tsx
- src/components/company-flag-banner.tsx
- src/components/company-size-badge.tsx
- src/components/anon-limit-cta.tsx
- src/components/page-cache-indicator.tsx
- src/components/technical-analysis-link.tsx
- src/components/technical-analysis-traffic-light.tsx
- src/components/dividend-radar-compact.tsx
- src/components/related-companies.tsx
- src/components/market-sentiment-section.tsx
- src/components/predecessor-ticker-link.tsx

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.2 and 5.9, mobile.md 3.7. Wave-0 components to use: AssetHeader, ScoreCard, AssetSectionNav, DataTable, Stat, InfoHint, lib/format, lib/valuation-metrics. The components financial-indicators, comprehensive-financial-view and ai-analysis-dual belong to w1-asset-indicators-ai: render them, but do not edit them.

1) Above the fold, AssetHeader (P0). Replace the current hero (80 px centered logo, badges, 'Análise da Ação...', 'Sobre...', the green 'Calcule sua Renda Passiva' card, and the price shown in green) with AssetHeader:
- subtitle 'Ação · <setor>';
- price with day change;
- Preço justo of the selected model (default = best model available for the viewer's plan, Graham for anonymous/free) with a small model Select in fairValueSlot;
- Margem de segurança = marginOfSafety(price, fair);
- Score via ScoreCard compact;
- 'Atualizado em'.
Actions: 'Acompanhar' (logged in -> /dashboard/monitoramentos-customizados/criar?ticker=<TICKER>; anonymous -> scrolls to the follow card), 'Comparar' (/comparador?tickers=<TICKER>), 'Backtest'. Max 2 badges. The free/anonymous locked state uses AssetHeader.locked with one CTA. header-score-wrapper.tsx and compact-score.tsx become thin wrappers over ScoreCard so /bdr keeps compiling (bdr/[ticker]/page.tsx is owned by w1-asset-fii-etf-bdr; keep the export names and props).

2) Section navigation (P1). Add AssetSectionNav with anchors valuation, indicadores, dividendos, demonstracoes, analise-ia, tecnica. Wrap each page section in <section id=... className='scroll-mt-28'>. Container max-w-6xl, 32 px between sections.

3) Valuation table (P0).
- Create src/components/asset/valuation-models.ts, a typed registry [{ key, label, shortLabel, plan: 'free'|'premium', description, appliesTo?: 'all'|'financial'|'nonFinancial' }] with graham 'Número de Graham', fcd 'Fluxo de caixa descontado', gordon 'Gordon (dividendos)', dividendYield 'Anti-armadilha de dividendos', lowPE 'P/L baixo com qualidade', magicFormula 'Fórmula Mágica', fundamentalist 'Fundamentalista 3+1', barsi 'Barsi'.
- Create src/components/asset/valuation-table.tsx (DataTable) with columns Modelo · Preço justo · Margem de segurança · Critérios (n/m) · Status (8 px dot positive/warning/negative + text via valuationStatus). The expandable row shows the reasoning markdown, the criteria list, Potencial (upside) and model notes.
- It must render ANY registry key present in the strategies object generically, because wave 2 adds bazin, lynch and bankPvp entries to the registry without touching the table.
- For free/anonymous users, premium rows stay visible with blurred values and a lock icon, and ONE CTA sits in the table footer ('Desbloquear com 1 dia grátis' -> /register, or /checkout for a logged-in free user).
- Below the table, a one-line disclaimer: 'Estimativas de modelos quantitativos com dados públicos; não constituem recomendação de investimento.' + link 'Ver metodologia' -> /metodologia.
- Rewrite strategic-analysis-client.tsx to render this table: remove the full-row green/pink backgrounds, the centered titles that wrap onto 4 lines, the icon-only mobile tabs (lines ~542-570) and the 'N/A' and toFixed formatting. Keep its public props so /bdr keeps working.

4) Follow card (P0). Create follow-asset-card.tsx 'Acompanhar <TICKER>':
- anonymous: an e-mail field posting to the same endpoint email-capture-modal used (do not submit during tests);
- logged in: asset-subscription-button.
Placement: desktop right column next to the valuation; mobile right after the valuation. Remove the EmailCaptureModal mount from the page, or open it only from an explicit click.

5) Other components (P1).
- technical-analysis-link/traffic-light: no 'Compra'; use 'Técnica: dentro da faixa estimada' / 'acima da faixa'.
- dividend-radar-compact: confirmed = solid brand dot, projected = hollow brand dot, and move the 'Calcule sua renda passiva' link here (Dividendos section).
- related-companies: DataTable with 5 rows (Ticker · Preço · Margem · Score).
- market-sentiment-section: neutral block titled 'O que o mercado está falando', clearly separate from the score, no emoji.
- company-flag-banner: warning subtle.
- anon-limit-cta: one neutral CTA.
- company-size-badge: Badge neutral.
- page-cache-indicator: muted text-xs.
- JSON-LD text around page.tsx line 558: 'Graham/Bazin' -> 'Graham e Barsi'.
- entendendo-score page: PageHeader + readable prose.
- not-found: tokens.
- Strip title suffixes.

ACCEPTANCE:
- The 4 answers (Preço, Preço justo, Margem, Score) are visible without scrolling at 390x844 and 1440x900, and within y < 640 at 360x740.
- For premium, all models and their fair values are visible without clicking.
- No colored -50 row backgrounds; the ticker is never truncated.
- No 'N/A', no decimal point, no 'Compra'.
- No overflow at 320 px; no modal in the first 10 s; dark mode legible.
- /bdr/aapl34 still renders (shared components).

## TEST PLAN
Routes: /acao/petr4, /acao/itub4 (bank), /acao/taee11 (unit), /acao/wege3, /acao/petr4/entendendo-score, /acao/xxxx99 (not-found), /bdr/aapl34 (regression only). Modes: anonymous, free@local.test, premium@local.test; viewports 320, 360x740, 390x844, 1440x900; themes light and dark.
Check:
(1) Above-the-fold bounding boxes of the 4 Stats are inside the viewport height (Playwright boundingBox).
(2) Margin sign: pick a model row and confirm Margem = 1 - preço/preço justo (e.g. P 75 / VJ 100 -> +25,0%) and Potencial = VJ/P - 1 in the expanded row.
(3) Free user sees premium rows blurred with exactly one CTA.
(4) The sticky section nav follows scroll; each anchor jumps to its section below the header.
(5) The anonymous follow card renders with an email input (autocomplete=email) and no modal opens automatically within 10 s.
(6) No text matches /Compra|N\/A|R\$ \d+\.\d+B/ on the page (evaluate document.body.innerText).
(7) scrollWidth === innerWidth at 320/360/390.
(8) Dark: table, badges and dots are visible.
(9) Keyboard: expand a table row with Enter.
