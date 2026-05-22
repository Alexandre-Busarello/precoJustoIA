## MODIFIED Requirements

### Requirement: Full Ranking Page (/ranking)
The system SHALL provide a dedicated ranking page with asset-type selection (Ações | FIIs | ETFs).
When "Ações" is selected, the system SHALL show all existing stock models and presets.
When "FIIs" is selected, the system SHALL show FII-specific presets and fii-ranking-strategy.
When "ETFs" is selected, the system SHALL show ETF-specific presets using etf-ranking-strategy.
FREE users SHALL access top 10 results for all asset types; PREMIUM users SHALL have no result count limit.

#### Scenario: Named preset applied (Ações)
- **WHEN** user selects a named stock preset (e.g., "Value Quality") with "Ações" selected
- **THEN** the preset's configured stock filters and model are applied automatically

#### Scenario: ETF tab selected
- **WHEN** user clicks "ETFs" in the asset type selector
- **THEN** ETF-specific presets replace the stock/FII presets and a ranking is generated using etf-ranking-strategy

#### Scenario: Sector filter applied (Ações only)
- **WHEN** user selects "Financeiro" as sector filter with "Ações" active
- **THEN** only financial sector companies appear in the ranking

#### Scenario: Market cap size filter (Ações only)
- **WHEN** user selects "Small Cap" with "Ações" active
- **THEN** only companies meeting the small cap threshold appear
