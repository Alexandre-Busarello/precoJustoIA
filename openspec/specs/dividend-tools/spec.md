# Spec: Dividend Tools

## Purpose
Define the dividend-focused tools including the Dividend Radar (/radar-dividendos) with 12-month projections, sustainability scoring and anti-trap filtering, per-ticker dividend analysis pages, historical DY averages, and dividend yield average history tracking.

## Requirements

### Requirement: Dividend Radar (/radar-dividendos)
The system SHALL provide a radar showing the best dividend-paying stocks,
ranked by projected DY for the next 12 months.
Basic access (top 10, trailing DY only) is FREE; full projections and calendar are PREMIUM.

#### Scenario: Free user dividend radar
- **WHEN** a FREE user opens /radar-dividendos
- **THEN** the top 10 dividend stocks by trailing DY are shown with basic info and a premium upgrade prompt

#### Scenario: Premium full radar
- **WHEN** a PREMIUM user opens /radar-dividendos
- **THEN** unlimited results are shown with projected 12-month DY, payout history, and sustainability score

---

### Requirement: 12-Month Dividend Projection
The system SHALL project expected dividends for the next 12 months per stock
based on historical payout patterns and current fundamentals.
This feature MUST be PREMIUM-only.

#### Scenario: Monthly projection calendar
- **WHEN** a PREMIUM user views /radar-dividendos/TAEE11
- **THEN** a calendar shows expected dividend payment months for the next 12 months with estimated amounts per share

---

### Requirement: Dividend Sustainability Score
The system SHALL calculate a sustainability score for each dividend payer
evaluating: payout ratio, earnings coverage, debt level, and earnings growth trend.
This feature MUST be PREMIUM-only.

#### Scenario: High sustainability score
- **WHEN** a company has payout ratio < 60%, low debt, and consistent earnings growth
- **THEN** it receives a high sustainability rating (A or B)

#### Scenario: Dividend trap warning flagged
- **WHEN** payout ratio > 100% or trailing DY is abnormally high relative to historical average
- **THEN** the stock is flagged with "⚠️ Possível Dividend Trap"

---

### Requirement: Individual Dividend Analysis (/radar-dividendos/[ticker])
The system SHALL provide a per-ticker dividend analysis page showing:
- Historical DY chart (5-10 years via dividend_yield_average history)
- Payment calendar with confirmed and projected dates
- Dividend growth rate (CAGR)
- Payout ratio trend
- Sustainability score breakdown

#### Scenario: Historical dividend chart
- **WHEN** user opens /radar-dividendos/ITUB4
- **THEN** a bar chart shows DY per year for the last available history

---

### Requirement: Anti-Dividend Trap Filter
The dividend radar SHALL offer a filter to exclude potential dividend traps
using the same five criteria as the Anti-Dividend Trap valuation model:
ROE ≥ 10%, LC ≥ 1.2, P/L between 4-25, Net Margin ≥ 5%, Market Cap ≥ R$1B.

#### Scenario: Anti-trap filter applied
- **WHEN** user enables "Excluir Dividend Traps"
- **THEN** stocks with Net Margin < 5% or LC < 1.2 are removed from the radar

---

### Requirement: Dividend Yield Average History (GET /api/dividend-yield-average)
The system SHALL maintain historical average DY records per stock to provide context
on whether the current DY is above or below historical norms.

#### Scenario: DY vs historical average
- **WHEN** a stock's current DY is significantly above its 5-year average
- **THEN** a visual indicator shows "DY acima da média histórica" with the delta percentage
