# BATCH w1-asset-indicators-ai (wave 1): Asset indicators grid (with 7y average), financial statements table, AI report prose and reports pages

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/components/financial-indicators.tsx
- src/components/comprehensive-financial-view.tsx
- src/components/asset/indicator-grid.tsx
- src/components/asset/indicator-history-drawer.tsx
- src/components/ai-analysis-dual.tsx
- src/components/ai-report-feedback.tsx
- src/components/markdown-renderer.tsx
- src/app/acao/[ticker]/relatorios/**
- src/app/bdr/[ticker]/relatorios/**

## TASKS
BEFORE STARTING, read docs/melhorias-2026-09/backlog-rules.md (global rules: production-DB safety, ownership, design system, compliance copy, titles/SEO, mobile, dark mode, validation commands, final report) and follow it strictly. Critical, repeated here: never run yarn/npm build, prisma db push/migrate/reset, psql or scripts/* against .env (it is the PRODUCTION database); any DB command must inline DATABASE_URL=postgresql://postgres:local@localhost:55432/pja DIRECT_URL=postgresql://postgres:local@localhost:55432/pja; the dev server on :3100 is already running (never start another on 3100 or kill it); never call payment, e-mail or Gemini/AI endpoints; no git commit; edit only your ownedPaths.

Spec: ux-ui.md 5.2 items 4, 6 and 7; mobile.md 3.7. These components are rendered by /acao, /bdr and /fii (pages owned by other batches). Keep the exported component names and props backward compatible; add new optional props only.

1) Indicators (P0). Merge the 'Indicadores de Valuation/Rentabilidade/...' cards and the repeated 7-year averages in 'Dados Financeiros Detalhados' into ONE grouped grid (asset/indicator-grid.tsx), rendered by financial-indicators.tsx.
- Groups: Valuation, Rentabilidade, Endividamento, Crescimento, Mercado.
- Each cell: label, current value, 'média 7a' in muted, delta vs average (positive/negative only when 'higher is better' is known for that indicator; otherwise neutral), InfoHint with the explanation.
- Clicking or tapping a cell opens indicator-history-drawer.tsx (Sheet bottom on mobile, right on desktop) with the yearly history chart (chart-1 line, average dashed chart-2, tooltip in pt-BR).
- Layout: 2 columns on mobile, 4 on desktop, hairline separators, no card per indicator, no decorative icons.
- Remove the empty card '<Empresa> / Dados anuais'.
- Fix formatting: line ~218 'R$ ${(value/1e9).toFixed(2)}B' -> formatBRLCompact; percentages via formatPct (check units); multiples via formatMultiple.
- The 'i' buttons (lines ~330-336, 20x20, missing type) become InfoHint (type=button, 44 px target).

2) Financial statements (P1). comprehensive-financial-view.tsx keeps only the annual statements ('Demonstrações'): DataTable with a sticky first column (w-[140px], wrapping labels), year columns right-aligned tabular-nums, compact pt-BR values, an edge shadow when it scrolls. Drop the duplicated averages now shown in the grid.

3) AI report (P1).
- markdown-renderer.tsx: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none' with a components mapping (h1 -> text-xl, h2 -> text-lg, h3 -> text-base font-semibold), tables wrapped in a horizontal scroller, brand links. It is also used by ben-chat-sidebar, blog posts, share pages, indices and quick-ranker: keep the props and verify there are no regressions.
- ai-analysis-dual.tsx: label 'Gerado por IA em <data>'; replace '📊 Avaliação da Comunidade'/'💬' with lucide ThumbsUp/ThumbsDown and plain labels. Locked state (anonymous/free): the first 3 real lines blurred plus ONE CTA, with no mid-sentence cut.
- ai-report-feedback: tokens, lucide icons.
- NEVER trigger report generation.

4) Reports pages (P2). /acao/[ticker]/relatorios and /bdr/[ticker]/relatorios (+ [reportId]): PageHeader, list as DataTable (data · título · tipo), detail page as prose with a 68ch max width, <img> -> next/image (fixes 3 eslint warnings), strip title suffixes.

ACCEPTANCE:
- The indicators section is <= 1,200 px tall at 360 px on premium /acao/petr4.
- No decimal points, 'B' suffix, 'N/A' or bare 'R$' in these sections.
- The AI report H1 is <= 24 px and <= 2 lines at 390 px.
- Markdown is readable in dark.
- /fii/hglg11 and /bdr/aapl34 still render these components without errors.

## TEST PLAN
Routes: /acao/petr4, /acao/itub4, /bdr/aapl34, /fii/hglg11, /acao/petr4/relatorios (+ first report detail), /bdr/aapl34/relatorios, /blog/como-calcular-preco-justo-metodo-graham and /indices/ipj-value (markdown regression). Modes: anonymous/free/premium; small/mobile/desktop; light/dark.
Measure:
(1) Height of the indicators section element at 360 px (<= 1200).
(2) document.body.innerText in these sections has no /\d+\.\d+%|\dB\b|N\/A/.
(3) Tap an indicator -> the drawer opens with a chart; Esc closes it.
(4) The statements table scrolls horizontally with the first column fixed and the page scrollWidth stays == innerWidth.
(5) AI H1 computed font-size <= 24px at 390.
(6) Anonymous AI block shows the blurred preview + 1 CTA.
(7) The network log has no request to AI generation endpoints.
