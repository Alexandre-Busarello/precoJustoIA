# Spec: Portfolio Management

## Purpose
Define the portfolio management system (/carteira) including multiple portfolios, transaction recording with status workflow, performance metrics (Sharpe, drawdown, volatility), allocation visualization, rebalancing suggestions, AI-powered recommendations, and portfolio-backtest integration. PREMIUM-only; FREE users are limited to 1 portfolio.

## Requirements

### Requirement: Multiple Portfolios (/carteira)
The system SHALL allow users to create and manage portfolios.
FREE users SHALL be limited to 1 portfolio; PREMIUM users SHALL have unlimited portfolios.
Each portfolio stores: name, description, monthly contribution target, rebalance frequency, and asset allocation targets (PortfolioConfig + PortfolioConfigAsset).

#### Scenario: Creating a portfolio
- **WHEN** PREMIUM user clicks "Nova Carteira" and fills in name and target allocations
- **THEN** a PortfolioConfig record is created with associated PortfolioConfigAsset records and the portfolio appears in the user's list

#### Scenario: Free user limit enforced
- **WHEN** a FREE user already has 1 portfolio and tries to create another
- **THEN** an upgrade prompt is shown; the creation is blocked

---

### Requirement: Transaction Recording with Status Workflow
Users SHALL record buy, sell, dividend, and rebalance transactions.
Each transaction SHALL store: ticker, type, quantity, price, date, fees, and cash balance impact.
Transactions SHALL follow a status workflow: PENDING → CONFIRMED → EXECUTED.

#### Scenario: Recording a buy transaction
- **WHEN** user records a buy of 100 shares of PETR4 at R$38.50 on 2024-01-15
- **THEN** a PortfolioTransaction is created with status=PENDING, and the portfolio reflects 100 shares of PETR4 at average cost R$38.50 once confirmed

#### Scenario: Transaction deduplication
- **WHEN** the same transaction is submitted twice within a short window
- **THEN** only one transaction is recorded

#### Scenario: Dividend transaction auto-reconciliation
- **WHEN** a dividend is received on a held stock
- **THEN** a DIVIDEND transaction is created and cash balance increases accordingly

---

### Requirement: Portfolio Performance Metrics
The system SHALL calculate and display via PortfolioMetrics:
- Total invested value and current market value
- Absolute and percentage return
- Daily variation
- Volatility (annualized)
- Sharpe Ratio
- Maximum Drawdown
- Dividend income received
- Sector and industry allocation snapshots

#### Scenario: Return calculation
- **WHEN** user invested R$10,000 and portfolio is currently worth R$12,500
- **THEN** the portfolio shows +R$2,500 (+25.00%) total return

#### Scenario: Sharpe Ratio shown
- **WHEN** user views portfolio metrics
- **THEN** Sharpe Ratio is computed using annualized returns and a risk-free rate (CDI)

---

### Requirement: Auto-refresh Portfolio Metrics
Portfolio metrics SHALL auto-refresh during market hours to reflect current prices.

#### Scenario: Real-time update during market hours
- **WHEN** a PREMIUM user has the portfolio page open during market hours
- **THEN** current values and returns update automatically without manual refresh

---

### Requirement: Rebalancing Suggestions
The system SHALL detect drift between current allocation and target allocation per asset.
When drift exceeds a configured threshold, the system SHALL suggest rebalancing transactions.

#### Scenario: Rebalancing suggestion triggered
- **WHEN** target allocation for VALE3 is 20% but current is 28%
- **THEN** the system shows a suggestion to sell X shares of VALE3 to restore target weight

---

### Requirement: AI Portfolio Recommendations
The system SHALL provide AI-powered portfolio analysis and transaction recommendations via:
- POST /api/portfolio/ai-assistant — qualitative portfolio analysis
- POST /api/portfolio/transaction-ai — AI-suggested buy/sell transactions

#### Scenario: AI transaction suggestion
- **WHEN** PREMIUM user clicks "Sugestão IA" in the portfolio
- **THEN** Gemini analyzes the portfolio composition and current fundamentals and suggests specific transactions with rationale

---

### Requirement: Portfolio-to-Backtest and Backtest-to-Portfolio Conversion
The system SHALL allow converting a portfolio into a backtest configuration and vice versa.
POST /api/portfolio/from-backtest SHALL import a BacktestConfig's assets and weights into a new portfolio.

#### Scenario: Convert portfolio to backtest
- **WHEN** user clicks "Testar estratégia no histórico" from a portfolio
- **THEN** a BacktestConfig is created pre-populated with the portfolio's current assets and weights

#### Scenario: Convert backtest to portfolio
- **WHEN** user finds a promising backtest result and clicks "Criar Carteira a partir deste Backtest"
- **THEN** POST /api/portfolio/from-backtest creates a new portfolio using the backtest's asset allocation

---

### Requirement: Portfolio Allocation Chart
The system SHALL display a visual allocation chart (pie/donut) broken down by sector and by individual stock.

#### Scenario: Allocation chart loaded
- **WHEN** user views their portfolio
- **THEN** a chart shows percentage allocation by sector and top individual holdings

---

### Requirement: Portfolio Dashboard Summary
The system SHALL provide a GET /api/portfolio/dashboard endpoint aggregating key metrics
across all user portfolios for display on the main dashboard.

#### Scenario: Dashboard portfolio widget
- **WHEN** user opens their dashboard
- **THEN** a summary card shows total invested, total current value, and overall return across all portfolios
