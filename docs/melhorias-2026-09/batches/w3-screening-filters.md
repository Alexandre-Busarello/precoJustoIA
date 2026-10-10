# BATCH w3-screening-filters (wave 3 — runs in parallel with w3-onde-aportar, disjoint files): screening aligned with the new models and "Onde aportar"

Owner decision (2026-09-29): add four filters to the screening so it uses the same criteria as "Onde aportar".

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/components/screening/**
- src/components/screening-configurator.tsx
- src/components/fii-screening-configurator.tsx
- src/components/screening-results-blur.tsx
- src/lib/screening-presets.ts
- src/lib/strategies/screening-strategy.ts
- src/lib/strategies/fii-screening-strategy.ts
- src/app/screening-acoes/**
- src/app/screening-fiis/**
- src/app/api/rank-builder/route.ts (screening path ONLY — do not change the ranking paths)
- src/lib/__tests__/screening*.test.ts

## CONTEXT YOU MUST READ FIRST
- docs/melhorias-2026-09/backlog-rules.md (global rules).
- What waves 1–2 already did to the screening (git log -- src/components/screening src/lib/strategies/screening-strategy.ts): two-panel live UI, presets with descriptive names, default liquidity filter in the backend.
- src/lib/finance/signals.ts (wave 1: priceVsSma, drawdownFrom52wHigh, fundamentalsIntact, dipWithIntactFundamentals), src/lib/finance/* (dividends TTM), the Bazin and Peter Lynch strategies (wave 2), the liquidity helper and LIQUIDITY_DEFAULTS.
- reports/mercado-financeiro.md §3.5, §7 (F1 Bazin, F2 liquidity, F3 Lynch).

## TASKS
1) Visible liquidity control (P0). Filter group "Liquidez": default "≥ R$ 1 mi/dia" (stocks) / "≥ R$ 500 mil/dia" (FIIs), options R$ 500 mil / 2 mi / 10 mi, and a switch "Incluir ativos com baixa liquidez" (off). Result table shows "Volume médio (21d)" column; illiquid rows (when included) get the "Baixa liquidez" badge from wave 2.
2) Bazin filter (P0). "Desconto vs. preço-teto Bazin ≥ X%" (marginOfSafety = 1 − P/teto, default target yield 6%, editable) + column "Preço-teto (Bazin)". Uses the wave-2 Bazin computation (import it; do not re-implement).
3) Peter Lynch filter (P0). "PEG ≤ X" (default 1,0) with the wave-2 definition (P/L ÷ crescimento de LPA em %, g = min(CAGR LPA 5a, 25%); cyclicals/negative growth → not applicable, shown as "—"). Column "PEG".
4) DY TTM (P0). Replace/relabel the DY filter to use the real trailing-12-month dividends from DividendHistory (sumTTM / preço), label "DY 12m (proventos reais, bruto)". Keep the old param name working for saved URLs/presets.
5) "Queda com fundamentos intactos" (P0). Filter switch + preset (new slug 'queda-com-fundamentos-intactos', descriptive name "Queda com fundamentos intactos"; existing slugs unchanged) using dipWithIntactFundamentals: price below the 200-day moving average OR ≥ 20% below the 52-week high, AND fundamentals intact over the last 4 quarters. Results show why: "−12% vs. MM200 · −24% da máx. 52s · lucro TTM +4% · ROE estável". Only stocks with enough history; others excluded with a count ("38 sem dados suficientes").
6) Performance: computing SMA/drawdown/quarters for the whole universe must be batched (one query per data type) and cached per trading day in the existing cache service; screening response p95 < 2 s on the local DB.
7) Compliance copy: filters/presets describe criteria, never "compra"/"oportunidade imperdível". Note near results: "Filtros quantitativos sobre dados públicos. Não é recomendação de investimento."
8) SEO: the new preset slug gets metadata (title without brand suffix, description) and appears in the screening sitemap if presets are listed there.

## ACCEPTANCE
- All four filters work together with the existing ones, live-updating (desktop) and inside the mobile filter sheet; counts correct; URLs shareable (query params) and old preset URLs still 200.
- Unit tests for the screening-side filter composition (liquidity default, Bazin discount, PEG n/a handling, DY TTM, dip-with-intact-fundamentals) pass with yarn test.
- tsc clean, eslint clean on changed files, check-ui passes; no horizontal scroll at 320/360; dark legible.

## TEST PLAN
- /screening-acoes: default shows only liquid stocks; toggle "Incluir baixa liquidez" → count increases and badges appear; Bazin ≥ 20% → column values consistent with /acao/<ticker> Bazin card for 2 tickers; PEG ≤ 1 → cyclicals show "—" and are excluded; DY 12m matches the sum of the last 12 months of dividends of one seeded ticker (verify by hand from the local DB); "Queda com fundamentos intactos" preset URL returns 200 and lists only assets matching both conditions, with the "why" line.
- /screening-fiis: liquidity + DY 12m.
- Screenshots mobile + desktop, light + dark, anon + premium; plan gating unchanged.

## Carry-over from wave 2 and the owner adjustments (added before launching wave 3)
- Peter Lynch is now a relative PEG indicator without a price target (fairValue null) and it is NOT applicable to banks/insurers, cyclical commodities, loss-making companies or non-positive growth — show "—" and exclude when the PEG filter is on.
- Bazin excludes extraordinary dividends by default; Barsi's perennial sectors use sector + industry classification (petroleum is out). Reuse the strategies; do not re-implement.
- `src/app/api/rank-builder/route.ts` now requires Premium for dividendYield and lowPE and accepts a `preview` flag (do not save history when true) — keep both behaviors intact when touching the screening path.
- Run every test with `timeout 300`; unit tests must not import Prisma/DB modules.
