# Spec: Data Ingestion

## Purpose
Define all external data fetching pipelines: BRAPI for quotes and fundamentals, Fundamentus scraper for stocks and FIIs, Yahoo Finance for BDRs, historical price fetching, company profile updates, and data quality validation including sentinel value handling and encoding normalization.

## Requirements

### Requirement: BRAPI Market Data Fetch
The system SHALL fetch stock quotes and fundamentals from BRAPI (brapi.dev).
Quotes SHALL be refreshed approximately every 1 hour during market hours.
Fundamentals (LPA, VPA, ROE, etc.) SHALL be refreshed daily via scheduled scripts.

#### Scenario: Daily fundamentals update
- **WHEN** the daily cron job runs
- **THEN** financial_data records for all active companies are updated via BRAPI's fundamentals endpoint

#### Scenario: API rate limit handling
- **WHEN** BRAPI returns a 429 rate limit response
- **THEN** the fetcher backs off with exponential delay and retries, logging the incident

---

### Requirement: Fundamentus Scraper (Stocks)
The system SHALL scrape Fundamentus (fundamentus.com.br) for supplemental fundamental data
(scripts/fetch-data-ward.ts and related scripts).
Fundamentus data SHALL be used as fallback when BRAPI does not have data for a company.

#### Scenario: Fundamentus data fallback
- **WHEN** BRAPI does not have fundamental data for a small-cap company
- **THEN** Fundamentus scraped data is used as the source of truth for that company

---

### Requirement: Fundamentus FII Scraper (scripts/fetch-data-fundamentus-fii.ts)
The system SHALL scrape Fundamentus for FII data including:
DY, P/VPA, yield 3m/6m/12m, DY médio, patrimônio, cotas emitidas, vacancy (física and financeira), cap rate, property count, and FII segment.

#### Scenario: FII data refresh
- **WHEN** the FII fetch script runs (triggered by /api/cron/fetch-fii)
- **THEN** all active FiiData records in the database are updated with fresh Fundamentus data

---

### Requirement: Ward Data Source
The system SHALL fetch supplemental financial data from the Ward data source
(scripts/fetch-data-ward.ts and /api/fetch-ward-data).
Ward provides additional fundamental fields not available in BRAPI or Fundamentus.

#### Scenario: Ward data fetch
- **WHEN** the Ward fetch job runs
- **THEN** company records are enriched with Ward-sourced fields for the companies covered

---

### Requirement: Yahoo Finance BDR Data
The system SHALL fetch BDR data from Yahoo Finance using the underlying international ticker,
then map it to the BDR ticker with BRL currency conversion.

#### Scenario: BDR data mapping
- **WHEN** the BDR update job runs for MSFT34
- **THEN** Microsoft's (MSFT) financials from Yahoo Finance are fetched, USD values converted to BRL, and stored as BDR-linked records

#### Scenario: Currency conversion
- **WHEN** storing BDR financial data
- **THEN** USD values are converted to BRL using the closing exchange rate for the data date

---

### Requirement: Historical Price Fetching via BRAPI (fetch-historical-prices-brapi.ts)
The system SHALL fetch and store historical daily prices for all tracked assets
via BRAPI's historical prices endpoint, covering at least 10 years where available.

#### Scenario: Historical price backfill on new stock
- **WHEN** a new company ticker is added to the database
- **THEN** up to 10 years of historical daily prices are fetched and stored

#### Scenario: Incremental daily update
- **WHEN** the daily historical price job runs
- **THEN** only dates missing from the historical_prices table are fetched, not the full history

---

### Requirement: Company Profile Updates (update-company-profiles.ts)
The system SHALL periodically update company profiles with logo URLs, descriptions,
employee counts, city, state, website, and full name from BRAPI or supplemental sources.

#### Scenario: Logo URL refresh
- **WHEN** the company profile update script runs
- **THEN** logo_url is updated for companies that have a new or changed URL

#### Scenario: Dry-run mode
- **WHEN** the script is run with --dry-run flag
- **THEN** changes are logged but no database writes occur

---

### Requirement: Data Quality Validation
The system SHALL validate ingested data before persisting to the database.
Sentinel values (e.g., P/L = 99999 used by BRAPI for N/A) SHALL be converted to NULL.
Suspicious values SHALL be flagged or rejected.

#### Scenario: Sentinel P/L replaced with NULL
- **WHEN** ingested P/L value is 99999
- **THEN** the value is stored as NULL rather than the sentinel number

#### Scenario: Negative market cap rejected
- **WHEN** ingested market cap is negative
- **THEN** the record is skipped and the anomaly is logged

---

### Requirement: Encoding Normalization
The system SHALL normalize character encoding when scraping Portuguese-language sources
to prevent mojibake in company names, sector names, and descriptions.

#### Scenario: Encoding normalized before persist
- **WHEN** Fundamentus returns accented characters with wrong encoding
- **THEN** the system normalizes to UTF-8 before persisting the record
