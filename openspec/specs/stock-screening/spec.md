# Spec: Stock Screening

## Purpose
Define the advanced stock screener (/screening-acoes) with multi-criteria filtering across Valuation, Rentabilidade, Crescimento, Dividendos, Endividamento, Liquidez, and Market Cap categories. Includes AI-assisted filter generation via Gemini, named presets, BDR support, and sortable results. PREMIUM-only.

## Requirements

### Requirement: Multi-criteria Screener (/screening-acoes)
The system SHALL provide an advanced stock screener with customizable filters across categories:
Valuation (P/L, P/VP, EV/EBITDA, PSR), Rentabilidade (ROE, ROIC, ROA, Margem Líquida, Margem EBITDA),
Crescimento (CAGR Receita 5 anos, CAGR Lucros 5 anos), Dividendos (DY, Payout),
Endividamento (Dívida Líquida/PL, Dívida/EBITDA), Liquidez Corrente, Market Cap.
This feature MUST be PREMIUM-only.

#### Scenario: Multi-filter screening
- **WHEN** user sets P/L < 15 AND ROE > 12% AND DY > 5%
- **THEN** only stocks meeting ALL three criteria are returned

#### Scenario: No results match
- **WHEN** filter criteria are too restrictive and no stocks qualify
- **THEN** "Nenhuma ação encontrada para os filtros selecionados" is shown with a suggestion to relax filters

---

### Requirement: Named Screening Presets
The system SHALL provide named preset strategies (defined in screening-presets.ts) that pre-configure filters for common approaches (e.g., Graham Quality, Small Cap Growth, High Yield).
Users SHALL be able to apply a preset and then customize individual filters.

#### Scenario: Preset applied and customized
- **WHEN** user selects the "High Yield" preset
- **THEN** DY, P/L, and Net Margin filters are pre-filled; user can then adjust values

---

### Requirement: Valuation Filters
The screener SHALL support min/max range inputs for: P/L, P/VP, EV/EBITDA, PSR.

#### Scenario: P/L range filter
- **WHEN** user sets P/L between 5 and 15
- **THEN** only stocks with P/L in [5, 15] appear in results

---

### Requirement: Quality Filters
The screener SHALL support minimum thresholds for: ROE, ROIC, ROA, Margem Líquida, Margem EBITDA.

#### Scenario: ROE minimum filter
- **WHEN** user sets ROE ≥ 15%
- **THEN** stocks with ROE below 15% are excluded

---

### Requirement: Growth Filters
The screener SHALL support CAGR min/max filters for revenue and earnings over 5 years.

#### Scenario: CAGR earnings filter
- **WHEN** user sets CAGR Lucros 5 anos ≥ 10%
- **THEN** only companies with 5-year earnings CAGR ≥ 10% are shown

---

### Requirement: Company Size Filter
The screener SHALL support filtering by size: Small Cap (< R$2B), Mid Cap (R$2B–R$10B), Large Cap (> R$10B).

#### Scenario: Small Cap filter
- **WHEN** user selects "Small Cap"
- **THEN** only companies with market cap below R$2 billion appear

---

### Requirement: BDR Support in Screener
The screener SHALL allow filtering to show only stocks, only BDRs, or stocks and BDRs combined.

#### Scenario: BDR-only screening
- **WHEN** user selects "Apenas BDRs"
- **THEN** only BDR tickers appear in results

---

### Requirement: AI-Assisted Screener (POST /api/screening-ai)
The system SHALL allow users to type a natural language investment thesis
that Gemini translates into screener filter configurations.
This feature MUST be PREMIUM-only.

#### Scenario: Natural language to filters
- **WHEN** user types "empresas de tecnologia lucrativas com baixo endividamento"
- **THEN** AI suggests: Setor=Tecnologia, ROE>10%, Dívida Líquida/PL<0.5, Margem Líquida>5%

#### Scenario: AI-generated filters are editable
- **WHEN** AI fills in the filter form
- **THEN** user can manually adjust any filter before running the screener

---

### Requirement: Saved Screening Presets (Slugs)
The system SHALL support shareable screener URLs via slug (/screening-acoes/[slug])
so users can save and share specific filter configurations.

#### Scenario: Shareable screener URL
- **WHEN** user applies filters and copies the URL
- **THEN** the URL /screening-acoes/value-quality-2024 reopens the same filter configuration

---

### Requirement: Sortable Results
Results SHALL show each stock's ticker, name, sector, and all active filter field values.
Results SHALL be sortable by any column header.

#### Scenario: Sort by ROE
- **WHEN** user clicks the ROE column header
- **THEN** results sort by ROE descending; clicking again sorts ascending
