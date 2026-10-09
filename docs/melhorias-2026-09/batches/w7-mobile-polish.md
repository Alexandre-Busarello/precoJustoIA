# BATCH w7-mobile-polish (wave 7, parallel with w7-backtest-flow and w7-ux-coherence): nothing covers content, one upsell per screen, readable history

Read docs/melhorias-2026-09/backlog-rules.md first, plus the findings table in docs/melhorias-2026-09/reports/auditoria-onda7.md (IDs C-xx). No Prisma schema change. Do not change gating (what is locked stays locked); only how it is presented.

## OWNED PATHS
- src/components/ben-chat-fab.tsx
- src/components/portfolio-holdings-table.tsx
- src/app/etf/[ticker]/page.tsx (header actions row only)
- src/components/compact-score.tsx, src/components/asset/valuation-table.tsx (locked/upsell block only), src/components/ai-analysis-dual.tsx, src/components/market-sentiment-section.tsx, src/components/technical-analysis-link.tsx
- src/components/ranking-history-section.tsx (+ a pure helper in src/lib/ranking-history-label.ts with tests in src/lib/__tests__/ranking-history-label.test.ts)

## TASKS
1. **The Ben button never covers content (P0, C-07).** At 390 px the floating Ben button sits on top of:
   - "Backtest do ranking" on /ranking;
   - the "Upside/Margem" value of the 2nd card on /screening-acoes;
   - the Graham margin cell on /acao/petr4 and /bdr/aapl34 (open since w5);
   - the "Commodities" title on /comparador;
   - the "Equilíbrio" segment on /onde-aportar.
   At 1440 it covers the last column of the carteira holdings table.
   Fix it in the FAB itself, without editing pages:
   - (a) hide it (fade/slide, `prefers-reduced-motion` aware) while the user scrolls down, and show it again on scroll up or after 1,2 s idle;
   - (b) honour any element marked `data-ben-fab-avoid` (keep the existing contract) plus `table`, `[role=grid]` and the focused element: when the button's rect intersects one of them, move it up above the bottom nav's safe area, or collapse it to a 44 px edge tab;
   - (c) desktop ≥ xl: place it in the right gutter outside `max-w-7xl` content when there is room.
   Keep the w5 rules (44 px, safe-area, no overlap with the bottom nav).
2. **Carteira holdings table at 1440 (P1, C-08).** The "Alocação · meta" column is cut and the table scrolls horizontally on desktop (`/carteira/<id>`). Make it fit at ≥ 1280 by merging "Retorno" and "Retorno c/ div." into one cell with 2 lines, and tightening column widths. Keep DataTable's sticky first column for mobile.
3. **ETF header actions (P2, C-09).** At 390 px the third action ("Comparar ETFs") is clipped in a scroll row with no affordance. Wrap the actions to 2 lines, or show at most 2 plus an overflow menu (44 px targets).
4. **One upsell per screen (P1, C-10).** A free user on /acao/petr4 sees 5 primary blue upsell buttons:
   - "Desbloquear o score";
   - "Desbloquear modelos Premium";
   - "Desbloquear relatório completo";
   - "Ver análise completa no Premium";
   - "Desbloquear análise técnica".
   Keep **one** primary CTA, the one in the header (owned by strategic-analysis-client; leave it). Turn the other locked blocks into a quiet inline line: lock icon + "Disponível no Premium" + text link "Ver planos" (`/planos`), using `variant="link"` or `outline` at most. The same rule applies to the anon variants ("Criar conta grátis"): one primary, the rest links.
5. **Gated sentiment leaks the answer (P2, C-11).** In `market-sentiment-section.tsx`, the "Tom predominante" is blurred for free users, but the visible preview of the summary says "Sentimento predominantemente positivo…". For non-premium users, start the preview after the first sentence, or show a neutral generic line ("Resumo de vídeos e análises públicas sobre PETR4.").
6. **Ranking history you can tell apart (P1, C-13).** The dashboard "Histórico de rankings" lists 5 identical rows ("Screening de ações · Parâmetros personalizados · 25 ativos · há 3 horas"). Build the title from the saved params:
   - the 2 most restrictive filters, e.g. "P/L ≤ 10 · DY ≥ 6%";
   - or else the model name + top tickers ("CMIG4, BBAS3 e mais 23").
   Collapse identical consecutive entries (same params, same day) into one row with "×3". Pure helper + unit tests.

## ACCEPTANCE
- At 390 px, scrolling /ranking, /screening-acoes, /acao/petr4, /bdr/aapl34, /comparador and /onde-aportar: the Ben button never intersects an interactive element or a table cell at rest. Use docs/melhorias-2026-09/tools/mobile-audit.mjs, or a rect-intersection script, and report the counts before and after.
- /carteira/<id> at 1440: no horizontal scroll in the holdings table (`scrollWidth <= clientWidth`).
- /acao/petr4 as free and as anon: exactly 1 primary-variant button related to upgrade (count `[data-variant=default]`/class check in the report).
- The dashboard history shows distinguishable titles, and duplicates are collapsed.
- tsc, eslint, check-ui and check-compliance are clean. Unit tests pass with `timeout 300`.

## TEST PLAN
- Unit: ranking history label builder (screening params, model presets, missing params) and duplicate collapsing.
- Playwright rect check for the FAB on the six routes (mobile 390 + small 360, light + dark).
- Screenshots: `--routes /dashboard,/acao/petr4,/bdr/aapl34,/etf/bova11,/ranking,/screening-acoes,/onde-aportar,/comparador,/carteira/<id> --auth all --viewports small,mobile,desktop --theme both`.
