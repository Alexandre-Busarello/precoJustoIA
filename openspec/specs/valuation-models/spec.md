# Spec: Valuation Models

## Purpose
Define the eight quantitative valuation models available on the platform (Graham, Anti-Dividend Trap, Greenblatt, Fundamentalista 3+1, FCD, Gordon DDM, Low P/E, AI Predictive), their formulas, quality filters, access tier requirements, and the multi-factor scoring engine that powers rankings.

## Requirements

### Requirement: Graham Formula (Free)
The system SHALL calculate fair value using Benjamin Graham's formula: `√(22.5 × LPA × VPA)`.
Quality filters SHALL apply: ROE ≥ 10%, Liquidity ≥ 1.0, Net Margin > 0%, Debt/PL ≤ 150%.
This model MUST be available to FREE tier users.

#### Scenario: Valid stock passes Graham filters
- **WHEN** a stock has ROE=15%, LPA=3.00, VPA=20.00, Liquidity=1.5, Net Margin=8%, Debt/PL=80%
- **THEN** fair value = √(22.5 × 3 × 20) = R$36.74 and the stock appears in the ranking

#### Scenario: Stock fails quality filters
- **WHEN** a stock has ROE=5% (below 10% threshold)
- **THEN** the stock is excluded from the Graham ranking with reason "ROE insuficiente"

#### Scenario: Free user sees limited results
- **WHEN** a FREE user runs a Graham ranking
- **THEN** only the top 10 results are shown with an upgrade prompt for more

---

### Requirement: Anti-Dividend Trap (Premium)
The system SHALL identify dividend-paying stocks that sustain payouts using filters:
ROE ≥ 10%, Current Liquidity ≥ 1.2, P/L between 4-25, Net Margin ≥ 5%, Market Cap ≥ R$1B.
This model MUST be PREMIUM-only.

#### Scenario: Dividend trap stock is excluded
- **WHEN** a stock has DY=12% but Net Margin=2% (below 5%)
- **THEN** the stock is flagged and excluded from Anti-Dividend Trap results

#### Scenario: Sustainable dividend stock qualifies
- **WHEN** a stock passes all five Anti-Dividend Trap filters
- **THEN** it appears ranked by dividend yield descending

---

### Requirement: Greenblatt Magic Formula (Premium)
The system SHALL rank stocks by combining Earnings Yield and ROIC scores.
Each stock receives a rank for each metric, and the combined rank determines final position.
This model MUST be PREMIUM-only.

#### Scenario: Magic Formula composite ranking
- **WHEN** stock A has EY rank=3 and ROIC rank=7
- **THEN** stock A's Magic Formula score = 10 and it ranks behind stocks with lower combined scores

#### Scenario: Financial companies are excluded
- **WHEN** a bank or insurance company is in the dataset
- **THEN** it is excluded from the Magic Formula ranking (EV/EBIT not meaningful for financials)

---

### Requirement: Fundamentalista 3+1 (Premium)
The system SHALL apply an adaptive methodology:
- Companies WITHOUT debt: ROE + P/L vs Growth + Leverage
- Companies WITH debt: ROIC + EV/EBITDA + Leverage
- Banks/Insurers: ROE + P/L (leverage criterion not applicable)
An optional dividend bonus score SHALL be applied.
This model MUST be PREMIUM-only.

#### Scenario: Debt-free company uses correct sub-model
- **WHEN** a company has Dívida Líquida/PL < 0
- **THEN** the system applies the "sem dívida" sub-model (ROE + P/L + Growth)

#### Scenario: Indebted company uses ROIC sub-model
- **WHEN** a company has Dívida Líquida/PL > 0.3
- **THEN** the system applies ROIC + EV/EBITDA + Endividamento scoring

---

### Requirement: Discounted Cash Flow — FCD (Premium)
The system SHALL calculate intrinsic value by discounting projected free cash flows (5-10 years),
applying a WACC rate and terminal value.
Sensitivity analysis SHALL show value under different growth/discount rate scenarios.
This model MUST be PREMIUM-only.

#### Scenario: Standard DCF calculation
- **WHEN** user inputs growth rate=10%, WACC=12%, terminal growth=3%, projection period=10 years
- **THEN** the system returns NPV of projected cash flows + terminal value as intrinsic value

#### Scenario: Sensitivity table
- **WHEN** a DCF analysis is run
- **THEN** a matrix of fair values is shown varying WACC ±2% and growth rate ±3%

---

### Requirement: Gordon DDM (Premium)
The system SHALL calculate stock value using the Gordon Growth Model: `D₁ ÷ (r - g)`.
Where D₁ is next period dividend, r is required return, g is dividend growth rate.
This model MUST be PREMIUM-only and is intended for dividend-paying companies.

#### Scenario: Standard DDM
- **WHEN** D₁=R$2.50, r=12%, g=5%
- **THEN** fair value = 2.50 ÷ (0.12 - 0.05) = R$35.71

#### Scenario: g ≥ r is invalid
- **WHEN** dividend growth rate equals or exceeds the required return rate
- **THEN** the system shows "Taxa de crescimento deve ser menor que taxa de desconto"

---

### Requirement: Low P/E Strategy (Premium)
The system SHALL filter stocks with low P/L combined with quality metrics:
P/L between 3-15, ROE ≥ 15%, ROA ≥ 5%, Current Liquidity ≥ 1.0.
This model MUST be PREMIUM-only.

#### Scenario: Stock meets all Low P/E criteria
- **WHEN** a stock has P/L=8, ROE=20%, ROA=7%, Liquidity=1.3
- **THEN** it qualifies for the Low P/E ranking

#### Scenario: Cheap but low quality excluded
- **WHEN** a stock has P/L=5 but ROE=8% (below 15%)
- **THEN** it is excluded from the Low P/E ranking

---

### Requirement: AI Predictive Analysis (Premium)
The system SHALL use Google Gemini to analyze all 7 quantitative models simultaneously,
enriched with real-time news search, financial statement analysis, and macroeconomic context.
The AI SHALL produce a predictive ranking with qualitative insights per stock.
This model MUST be PREMIUM-only.

#### Scenario: AI analysis is generated
- **WHEN** a PREMIUM user requests AI Predictive Analysis
- **THEN** Gemini processes all 7 model scores + news context and returns a ranked list with
  qualitative reasoning per stock within 30 seconds

#### Scenario: AI analysis includes macro context
- **WHEN** a stock analysis is generated
- **THEN** the report mentions relevant macroeconomic factors (Selic, inflation, sector news)

---

### Requirement: Multi-Factor Scoring Engine
The system SHALL compute composite company scores via a configurable multi-factor engine
(calculate-company-score-service) used across ranking, screening, and index composition.
Screening presets (screening-presets.ts) SHALL define the named strategies available in the UI.
FIIs SHALL use a separate FII-specific scoring model (fii-listing-valuation).

#### Scenario: Score computed for ranking
- **WHEN** the rank-builder API is called with a model and parameters
- **THEN** calculate-company-score-service scores all qualifying companies and returns them ranked

#### Scenario: FII scoring uses FII-specific model
- **WHEN** a FII ranking is requested
- **THEN** fii-listing-valuation scoring is applied (DY, P/VPA, occupancy, cap rate) instead of the stock model

---

### Requirement: Company Flags for Fundamental Issues
The system SHALL maintain a CompanyFlag model that records important fundamental alerts per company
(e.g., consecutive losses, negative equity, very high debt).
Company flags SHALL be surfaced on individual company pages and ranking results.

#### Scenario: Company flag displayed on company page
- **WHEN** a company has a CompanyFlag record for "consecutive losses"
- **THEN** a warning badge is shown on the company page and in ranking results

#### Scenario: Flag prevents certain model eligibility
- **WHEN** a company is flagged for "negative equity"
- **THEN** it is excluded from models that require positive VPA (e.g., Graham)

---

### Requirement: Configurable Model Parameters
The system SHALL allow users to adjust model parameters via sliders and input fields
(e.g., growth rate, discount rate, minimum ROE threshold).
Parameter changes SHALL trigger real-time re-ranking.

#### Scenario: Parameter slider updates ranking
- **WHEN** user moves the minimum ROE slider from 10% to 15%
- **THEN** the ranking recalculates instantly and stocks below 15% ROE are removed
