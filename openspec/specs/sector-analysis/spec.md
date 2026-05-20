# Spec: Sector Analysis

## Purpose
Define the sector analysis feature (/analise-setorial) covering 25+ B3 sectors with intra-sector company comparison, sector leader identification, aggregate metrics, auto-scroll navigation, and paywall enforcement. PREMIUM-only.

## Requirements

### Requirement: Sector Overview Page (/analise-setorial)
The system SHALL provide a sector analysis page covering 25+ B3 sectors.
This feature MUST be PREMIUM-only.
The page SHALL show the top companies per sector ranked by a configurable metric,
with aggregate sector metrics (median P/L, median P/VP, median DY, median ROE).

#### Scenario: Sector list loads
- **WHEN** a PREMIUM user opens /analise-setorial
- **THEN** all available B3 sectors are listed with their top company and aggregate metrics

#### Scenario: Free user is blocked
- **WHEN** a FREE user navigates to /analise-setorial
- **THEN** a paywall is shown with upgrade call-to-action

---

### Requirement: Intra-Sector Company Comparison
The system SHALL allow users to compare companies within the same sector side by side,
using the same indicator set as the stock comparator.

#### Scenario: Sector drill-down
- **WHEN** user clicks on "Energia Elétrica" sector
- **THEN** a comparison table shows all companies in that sector with their key metrics

---

### Requirement: Sector Leader Identification
The system SHALL identify and highlight the sector leader for each key metric
(highest ROE, lowest P/L, best DY, highest ROIC, lowest debt).

#### Scenario: Sector ROE leader highlighted
- **WHEN** viewing the "Bancos" sector
- **THEN** the bank with the highest ROE is highlighted as sector leader for that metric

---

### Requirement: Aggregate Sector Metrics
The system SHALL compute median P/L, median P/VP, median DY, and median ROE for each sector
and display them as benchmark reference values.

#### Scenario: Sector median as benchmark
- **WHEN** user views the "Utilities" sector
- **THEN** median P/L and median DY for the entire sector are shown alongside individual company values

---

### Requirement: Sector Macro Context
The system SHALL provide a macro update section per sector (via AI or curated content)
describing macroeconomic factors affecting each sector (e.g., Selic impact on Utilities, commodity prices for Mining).

#### Scenario: Macro update displayed
- **WHEN** user views the "Mineração" sector
- **THEN** a macro context card shows current commodity price trends and their impact on the sector

---

### Requirement: Auto-scroll Navigation
The sector analysis page SHALL include an anchor navigation menu that auto-scrolls
to the selected sector when clicked.

#### Scenario: Jump to sector via navigation
- **WHEN** user clicks "Varejo" in the sector navigation menu
- **THEN** the page scrolls smoothly to the Varejo section with a highlight effect

---

### Requirement: Sector SSR with Paywall
The sector analysis page SHALL use Server-Side Rendering (SSR).
PREMIUM status SHALL be checked server-side to prevent content leaking before the paywall renders.

#### Scenario: SSR paywall for non-premium
- **WHEN** the server renders /analise-setorial for a FREE user
- **THEN** the paywall HTML is returned directly; no sector data is included in the server response
