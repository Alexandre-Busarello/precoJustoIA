# Spec: Stock Comparison

## Purpose
Define the stock comparator (/comparador) that allows side-by-side comparison of up to 6 stocks with tiered indicator access (FREE gets 6 basic, PREMIUM gets 25+), 7-year historical averages, medal rankings, preconfigured popular comparisons, shareable URL state, and smart search by ticker or name.

## Requirements

### Requirement: Side-by-Side Comparison (/comparador)
The system SHALL allow users to compare up to 6 stocks simultaneously.
FREE users SHALL see 6 basic indicators; PREMIUM users SHALL see 25+ indicators.

#### Scenario: Adding stocks to comparison
- **WHEN** user types a ticker in the search box
- **THEN** the stock is added as a column in the comparison table with its data

#### Scenario: Maximum 6 stocks enforced
- **WHEN** user tries to add a 7th stock
- **THEN** an error "Máximo de 6 ações para comparação" is shown

---

### Requirement: Basic Indicators (Free)
The system SHALL show these 6 indicators to FREE users:
P/L, P/VP, ROE, Dividend Yield, Valor de Mercado, Receita Líquida.
Premium indicators SHALL be visible but blurred/locked with an upgrade prompt.

#### Scenario: Free user sees basic comparison
- **WHEN** a FREE user opens the comparador with 2 stocks
- **THEN** the 6 basic indicators are visible and all premium indicator cells are blurred with a lock icon

---

### Requirement: Premium Indicators (25+)
The system SHALL show PREMIUM users the extended indicator set including:
Margem Líquida, ROIC, ROA, EV/EBITDA, Dívida Líquida/PL, CAGR Lucros 5 anos, CAGR Receita 5 anos,
Payout, Liquidez Corrente, and 7-year historical averages for key metrics.

#### Scenario: 7-year historical average shown
- **WHEN** a PREMIUM user views the comparison
- **THEN** each metric shows the current value alongside the company's 7-year average

---

### Requirement: Medal Rankings
The system SHALL highlight the best-performing stock per metric with medal icons.
Gold = best, Silver = second, Bronze = third.
This feature MUST be PREMIUM-only.

#### Scenario: Medal assignment
- **WHEN** 3+ stocks are compared and stock A has the highest ROE
- **THEN** a gold medal appears next to stock A's ROE value; silver and bronze for second and third

---

### Requirement: Preconfigured Popular Comparisons
The system SHALL offer preconfigured comparison links for popular stock groups
(e.g., Bancos: ITUB4/BBDC4/BBAS3, Petróleo: PETR4/PRIO3, Varejo: MGLU3/LREN3).
These SHALL be publicly accessible without login.

#### Scenario: Popular comparison pre-loaded
- **WHEN** user clicks "Comparar Bancos"
- **THEN** the comparador opens pre-loaded with ITUB4, BBDC4, BBAS3

---

### Requirement: URL-based Comparison State (/compara-acoes/[...tickers])
The comparison state SHALL be reflected in the URL for sharing and bookmarking.

#### Scenario: Shareable URL
- **WHEN** user has PETR4, PRIO3 in the comparador
- **THEN** the URL is /compara-acoes/PETR4,PRIO3 and can be shared or bookmarked

#### Scenario: URL-loaded comparison
- **WHEN** user opens /compara-acoes/ITUB4,BBDC4,BBAS3
- **THEN** the comparison loads immediately with those three stocks pre-populated

---

### Requirement: Smart Search in Comparador
The search input SHALL support searching by ticker OR company name with autocomplete suggestions.

#### Scenario: Search by company name
- **WHEN** user types "Petrobras"
- **THEN** PETR3 and PETR4 appear as suggestions in the dropdown

#### Scenario: Search by ticker prefix
- **WHEN** user types "VALE"
- **THEN** VALE3 appears as a suggestion
