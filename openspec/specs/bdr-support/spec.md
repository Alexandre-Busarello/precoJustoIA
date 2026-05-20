# Spec: BDR Support

## Purpose
Define BDR (Brazilian Depositary Receipt) support including individual pages (/bdr/[ticker]), Yahoo Finance data sourcing with BRL conversion, screener and ranking integration, historical fundamentals via timeseries snapshots, and stale data warnings.

## Requirements

### Requirement: BDR Individual Page (/bdr/[ticker])
The system SHALL provide dedicated analysis pages for BDRs.
BDR pages SHALL show: underlying company name, BDR price (BRL), currency (USD/EUR),
P/L, DY, market cap, and a link to the underlying international company.
BDR tickers are identified by suffix: 34 (US stocks), 35, 32, 33.

#### Scenario: BDR page routing
- **WHEN** user navigates to /bdr/AAPL34
- **THEN** Apple Inc. fundamentals are displayed adapted to the BDR context with BRL-denominated price

#### Scenario: Non-BDR ticker redirected
- **WHEN** user navigates to /bdr/PETR4
- **THEN** the system redirects to /acao/PETR4 since PETR4 is a stock, not a BDR

---

### Requirement: BDR Data from Yahoo Finance
BDR fundamental data SHALL be fetched from Yahoo Finance using the underlying company's international ticker (e.g., AAPL for AAPL34), mapped to the BDR ticker.
USD/EUR values SHALL be converted to BRL using the closing FX rate for the data date.

#### Scenario: BDR data mapping for MSFT34
- **WHEN** the BDR update job runs
- **THEN** Microsoft's (MSFT) financials from Yahoo Finance are fetched, converted to BRL, and stored under MSFT34

#### Scenario: FX conversion applied
- **WHEN** a BDR with USD fundamentals is stored
- **THEN** market cap and per-share values are denominated in BRL using the FX rate at data date

---

### Requirement: BDR Timeseries Fundamentals
The system SHALL store historical fundamental snapshots for BDRs
(BDR_fundamentals_timeseries) to support trend analysis and historical P/L charts.

#### Scenario: Historical P/L chart for BDR
- **WHEN** user views the historical P/L section on /bdr/AAPL34
- **THEN** the chart shows Apple's quarterly reported P/L values over available history

---

### Requirement: BDR in Stock Screener
The stock screener SHALL support filtering to show only stocks, only BDRs, or both.
BDRs use the same fundamental filter categories as stocks.

#### Scenario: BDR-only screening
- **WHEN** user selects "Apenas BDRs" in the screener
- **THEN** only BDR tickers appear in results

#### Scenario: Mixed screening
- **WHEN** user selects "Ações e BDRs"
- **THEN** both B3 stocks and BDRs appear side by side in screener results

---

### Requirement: BDR Data Quality Handling
The system SHALL handle cases where BDR underlying data is unavailable or delayed.
Data older than 7 days SHALL be visually flagged.

#### Scenario: Stale data warning shown
- **WHEN** BDR fundamental data is older than 7 days
- **THEN** a warning "Dados podem estar desatualizados" is shown on the BDR page

#### Scenario: Missing underlying data
- **WHEN** Yahoo Finance does not return data for a BDR's underlying ticker
- **THEN** the BDR page shows available price data and "Dados fundamentalistas indisponíveis"
