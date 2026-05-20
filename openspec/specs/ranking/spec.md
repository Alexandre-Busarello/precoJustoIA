# Spec: Ranking

## Purpose
Define the stock ranking system including the homepage Quick Ranker, the full /ranking page with screening presets, ranking history, export, and result display conventions. The rank-builder API powers all ranking computations.

## Requirements

### Requirement: Quick Ranker on Homepage
The system SHALL provide an interactive Quick Ranker on the homepage (POST /api/rank-builder)
that generates stock rankings in real time without page navigation.
FREE users SHALL access Graham model only; PREMIUM users SHALL access all 8 models.

#### Scenario: Free user Quick Ranker
- **WHEN** a FREE user opens the homepage Quick Ranker
- **THEN** only the Graham model is selectable and top 10 results are shown with an upgrade prompt

#### Scenario: Premium user Quick Ranker
- **WHEN** a PREMIUM user selects a model and clicks "Gerar Ranking"
- **THEN** all matching stocks are returned with no result count limit

---

### Requirement: Full Ranking Page (/ranking)
The system SHALL provide a dedicated ranking page with all 8 models,
named screening presets (from screening-presets.ts), and advanced filters (sector, market cap size).

#### Scenario: Named preset applied
- **WHEN** user selects a named preset (e.g., "Value Quality")
- **THEN** the preset's configured filters and model are applied automatically

#### Scenario: Sector filter applied
- **WHEN** user selects "Financeiro" as sector filter
- **THEN** only financial sector companies appear in the ranking

#### Scenario: Market cap size filter
- **WHEN** user selects "Small Cap" (< R$2B)
- **THEN** only companies meeting the small cap threshold appear

---

### Requirement: Ranking History (RankingHistory)
The system SHALL save generated rankings for authenticated users in the RankingHistory model.
FREE users MAY view the last 5 saved rankings; PREMIUM users have unlimited history with temporal comparison.

#### Scenario: Ranking auto-saved
- **WHEN** an authenticated user generates a ranking
- **THEN** a RankingHistory record is saved with timestamp, model, and parameters

#### Scenario: Temporal comparison for Premium
- **WHEN** a PREMIUM user compares a saved ranking against the current one
- **THEN** each stock shows position delta (↑3, ↓2, NEW, DROPPED)

---

### Requirement: AI Screening Integration
The ranking page SHALL integrate POST /api/screening-ai
to allow Gemini to interpret natural language and configure screener parameters.

#### Scenario: AI configures ranking filters
- **WHEN** user types a theme and clicks "Gerar com IA"
- **THEN** Gemini fills in model selection and filter parameters before the ranking runs

---

### Requirement: Ranking Export
The system SHALL allow PREMIUM users to export ranking results.

#### Scenario: CSV export
- **WHEN** a PREMIUM user clicks "Exportar" on a ranking result
- **THEN** a CSV downloads with all stock tickers, scores, metrics, and upside values

---

### Requirement: Ranking Result Display
Each ranked stock SHALL show: position, ticker, company name, sector,
fair value, current price, upside %, key model-specific metrics, DY, and any CompanyFlag warnings.
Results SHALL be sortable by any column.

#### Scenario: Upside shown in green
- **WHEN** a stock has fair value R$50 and current price R$35
- **THEN** upside is displayed as +42.9% in green

#### Scenario: Downside shown in red
- **WHEN** a stock is trading above its fair value
- **THEN** the upside % is negative and displayed in red

#### Scenario: Company flag warning shown in results
- **WHEN** a ranked stock has an active CompanyFlag
- **THEN** a warning icon appears next to the stock in the ranking list
