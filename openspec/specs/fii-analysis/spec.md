# Spec: FII Analysis

## Purpose
Define the FII (Fundo de Investimento Imobiliário) analysis features including individual pages, FII-specific screener, ranking with fii-listing-valuation scoring, Fundamentus data sourcing (FiiData model), segment classification, and strict separation from stock data.

## Requirements

### Requirement: FII Individual Page (/fii/[ticker])
The system SHALL provide a dedicated analysis page for each FII.
The page SHALL show FiiData fields: DY, P/VPA, type of FII (Tijolo/Papel/Híbrido/FOF/Desenvolvimento),
patrimônio líquido, number of properties, vacancy rate (física and financeira),
cap rate, yield 3m/6m/12m, and dividend history chart.

#### Scenario: FII page loads with complete data
- **WHEN** user navigates to /fii/MXRF11
- **THEN** the page shows MXRF11's FiiData fields including DY, P/VPA, vacancy, and a dividend history bar chart

#### Scenario: FII not found
- **WHEN** user navigates to /fii/INVALID
- **THEN** a 404 page is shown

---

### Requirement: FII Data from Fundamentus (FiiData Model)
FII data SHALL be sourced primarily from Fundamentus scraping, stored in the FiiData model.
Data SHALL include: net assets (patrimônio), dividend yield metrics (yield 3m, 6m, 12m, DY médio),
P/VPA, quota count (cotas emitidas), vacancy rates (física and financeira), cap rate, and property count.
The FII fetch cron (/api/cron/fetch-fii) SHALL update all FiiData records daily.

#### Scenario: FII data refresh cron
- **WHEN** /api/cron/fetch-fii runs
- **THEN** all active FII records in FiiData are updated with fresh Fundamentus scraped values

#### Scenario: Encoding normalization
- **WHEN** Fundamentus returns text with wrong encoding (mojibake)
- **THEN** the scraper normalizes to UTF-8 before persisting

---

### Requirement: FII Segment Classification
The system SHALL classify each FII into a segment: Tijolo, Papel (CRI), Híbrido, FOF (Fund of Funds), Desenvolvimento.
The segment SHALL be used as a filter in the FII screener and displayed on the FII page.

#### Scenario: Segment filter in screener
- **WHEN** user selects "Fundo de Tijolo" in the FII screener
- **THEN** only FIIs with segment=Tijolo appear in results

---

### Requirement: FII Screening (/screening-fiis)
The system SHALL provide a screener for FIIs with FII-specific filters:
DY minimum, P/VPA range, FII segment, maximum vacancy rate, minimum patrimônio.
This feature MUST be PREMIUM-only.

#### Scenario: Low vacancy filter
- **WHEN** user sets vacancy máxima = 10%
- **THEN** only FIIs with vacancy rate ≤ 10% appear

#### Scenario: Minimum patrimônio filter
- **WHEN** user sets patrimônio mínimo = R$500M
- **THEN** only large FIIs above the threshold appear

---

### Requirement: FII Ranking with Specialized Scoring
The system SHALL rank FIIs using fii-listing-valuation scoring,
which weights DY, P/VPA, cap rate, vacancy, and patrimônio into a composite score.
The ranking SHALL be separate from stock rankings.

#### Scenario: FII DY ranking
- **WHEN** user selects "Ranking FIIs por DY"
- **THEN** all active FIIs are ranked by trailing 12-month DY descending using fii-listing-valuation

---

### Requirement: FII Separation from Stock Data
The system SHALL keep FII data strictly separate from stock data.
FIIs SHALL NOT appear in stock rankings, stock screeners, or valuation model results.
Stocks SHALL NOT appear in FII rankings or FII screeners.

#### Scenario: Stock screener excludes FIIs
- **WHEN** user runs the stock screener
- **THEN** no FII tickers (ending in 11, 12) appear in results

#### Scenario: FII screener excludes stocks
- **WHEN** user runs the FII screener
- **THEN** no stock tickers appear in results

---

### Requirement: FII Individual Analysis with AI
The system SHALL provide AI-generated analysis for individual FIIs using Google Gemini,
covering: segment positioning, yield sustainability, vacancy trend, and macroeconomic context (Selic impact).

#### Scenario: FII AI analysis generated
- **WHEN** PREMIUM user clicks "Análise IA" on a FII page
- **THEN** Gemini generates a structured analysis of the FII considering yield sustainability and sector context
