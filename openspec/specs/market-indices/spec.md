# Spec: Market Indices

## Purpose
Define the proprietary quantitative index engine (IPJ-VALUE, IPJ-DIV) with Base 100 NAV calculation, daily rebalancing logic, composition snapshots, per-asset performance, audit trail via IndexRebalanceLog, real-time return API, and CVM-compliant "benchmark" framing.

## Requirements

### Requirement: Proprietary Index Engine (/indices)
The system SHALL maintain proprietary quantitative indices stored in IndexDefinition.
Each index has: ticker, name, methodology description, and a config JSON for algorithm parameters.
Composition is stored in IndexComposition (assets with weights and entry price/date).
Historical NAV in IndexHistoryPoints (daily points, change %, composition snapshot).
All indices SHALL be CVM-compliant: algorithmic selection, transparent methodology, no human-driven picks.

#### Scenario: Index list page
- **WHEN** user navigates to /indices
- **THEN** all active indices are listed with their current NAV, daily change %, and a sparkline chart of recent performance

#### Scenario: Index detail page
- **WHEN** user navigates to /indices/IPJ-VALUE
- **THEN** the index shows NAV, composition table, daily return, historical chart, and methodology description

---

### Requirement: Base 100 NAV Calculation
Every index SHALL start at 100.000 points on its creation date.
Daily NAV update uses price-return methodology (no dividend reinvestment in MVP).

Formulas:
- `R_t = Σ(w_i,t-1 × r_i,t)` — weighted sum of component daily returns
- `NAV_today = NAV_yesterday × (1 + R_t)`

#### Scenario: Daily NAV update via cron
- **WHEN** POST /api/cron/update-indices runs at market close
- **THEN** each active index's NAV is recalculated, a new IndexHistoryPoints record is saved, and the composition snapshot is updated

#### Scenario: Index inception
- **WHEN** a new index is created
- **THEN** NAV is set to 100.000 and the initial IndexComposition is locked in

---

### Requirement: Real-time Return During Market Hours
The system SHALL provide GET /api/indices/[ticker]/realtime-return
that calculates the index's intraday return using live prices for current components.

#### Scenario: Real-time return request
- **WHEN** GET /api/indices/[ticker]/realtime-return is called during market hours
- **THEN** current prices for all composition assets are fetched, and the intraday NAV variation is returned

---

### Requirement: IPJ-VALUE Index Algorithm
The IPJ-VALUE index SHALL track Deep Value stocks using:
- Universe: B3 listed stocks
- Liquidity filter: Average Daily Volume > R$2,000,000
- Quality filters: ROE > 10%, Net Margin > 5%, Dívida Líquida/EBITDA < 3x
- Selection: Top 10 by highest upside (fair value vs current price via Graham or configured model)
- Weights: Equal weight (10% each)
- Rebalancing: Daily check; swap only if quality breach OR >5% upside differential vs 10th component

#### Scenario: Quality breach triggers swap
- **WHEN** a component's ROE drops below 10% on data refresh
- **THEN** the component is replaced by the next qualifying stock and a IndexRebalanceLog entry records the swap

#### Scenario: 5% upside differential prevents churn
- **WHEN** a non-component stock's upside exceeds the 10th component's upside by less than 5%
- **THEN** no swap occurs, preserving stability

---

### Requirement: Rebalancing Audit Trail (IndexRebalanceLog)
Every component change SHALL be recorded in IndexRebalanceLog with:
date, asset added, asset removed, reason (quality_breach / upside_differential), NAV at time of change.

#### Scenario: Rebalance log accessible via API
- **WHEN** GET /api/indices/[ticker]/rebalance-log is called
- **THEN** the full history of component changes is returned with reasons and dates

---

### Requirement: Per-Asset Performance Breakdown
The system SHALL provide GET /api/indices/[ticker]/asset-performance
returning each component's individual contribution to index performance over a given period.

#### Scenario: Attribution by asset
- **WHEN** user views asset performance breakdown
- **THEN** each component shows: return over period, weight, and contribution to total index return

---

### Requirement: Index Methodology Transparency
The methodology for each index SHALL be publicly readable on the index page.
The algorithm config SHALL be described in plain language.

#### Scenario: Methodology visible to all users
- **WHEN** any user (including FREE, unauthenticated) views an index page
- **THEN** the full selection criteria and rebalancing rules are shown in a "Ver Metodologia" section

---

### Requirement: Index Performance vs IBOVESPA
Each index page SHALL display a chart comparing the index against IBOVESPA
rebased to 100 from the index's inception date.

#### Scenario: Benchmark comparison chart
- **WHEN** user views IPJ-VALUE
- **THEN** a line chart shows IPJ-VALUE vs IBOVESPA (both starting at 100) since inception

---

### Requirement: Index Cache Rules
Index data SHALL be cached with the following TTLs:
- Current NAV + sparkline: 15 minutes during market hours, 24 hours after close
- Historical NAV series: 24 hours
- Composition: invalidated on rebalancing events only

#### Scenario: Post-market cache stability
- **WHEN** market closes and final NAV is computed
- **THEN** the NAV is cached for 24 hours and served without recalculation until next market day
