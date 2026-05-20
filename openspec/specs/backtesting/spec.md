# Spec: Backtesting

## Purpose
Define the historical portfolio backtesting system (/backtest) including simulation configuration with monthly contributions, benchmark comparison, performance metrics (CAGR, Sharpe, drawdown), dividend reinvestment, rebalancing strategies, saved configurations, and bidirectional portfolio integration. PREMIUM-only.

## Requirements

### Requirement: Historical Portfolio Simulation (/backtest)
The system SHALL allow users to simulate a portfolio strategy using historical daily prices (BacktestConfig).
Configuration SHALL include: start date, end date, initial capital (R$), monthly contribution, stocks with target allocation weights, and rebalance frequency.
Results are stored in BacktestResult; monthly ledger in BacktestTransaction.

#### Scenario: Backtest run with monthly contributions
- **WHEN** user inputs R$10,000 initial capital, R$500/month contribution, PETR4=50%/VALE3=50%, start=2020-01-01, end=2024-12-31
- **THEN** the system simulates monthly rebalancing + contributions and shows final value, CAGR, Sharpe, and max drawdown in BacktestResult

#### Scenario: Ticker data validation before run
- **WHEN** user adds a ticker to the backtest
- **THEN** POST /api/backtest/validate checks that historical price data exists for the requested date range and returns warnings for gaps

#### Scenario: Date range validation
- **WHEN** user sets start date after end date
- **THEN** an error "Data inicial deve ser anterior à data final" is shown and the run is blocked

---

### Requirement: Benchmark Comparison
The system SHALL compare backtest results against benchmarks: IBOVESPA, CDI, IPCA, S&P 500.

#### Scenario: Benchmark overlay on chart
- **WHEN** a backtest is completed
- **THEN** the performance chart shows the portfolio alongside IBOVESPA and CDI rebased to the same starting capital

---

### Requirement: Performance Metrics
The system SHALL compute and store in BacktestResult:
- Final value and total return (%)
- CAGR
- Maximum Drawdown (%)
- Sharpe Ratio
- Annualized Volatility
- Best and worst single-period returns
- Per-asset performance breakdown

#### Scenario: CAGR calculation
- **WHEN** initial capital R$10,000 grows to R$18,000 over 5 years (excluding contributions)
- **THEN** CAGR = (18000/10000)^(1/5) - 1 = 12.47%

#### Scenario: Per-asset breakdown available
- **WHEN** user views backtest results
- **THEN** each asset shows its individual return contribution to the total portfolio

---

### Requirement: Dividend Reinvestment
The system SHALL offer an option to reinvest dividends during the backtest period.
When enabled, dividend cash flows are reinvested at the closing price on the ex-date.

#### Scenario: Dividend reinvestment enabled
- **WHEN** user enables "Reinvestir Dividendos" and the backtest period includes dividend payments
- **THEN** final value is higher than without reinvestment and the report shows "Total Dividendos Reinvestidos"

---

### Requirement: Rebalancing Strategies
The system SHALL support rebalancing frequencies: Never, Monthly, Quarterly, Annually.
BacktestTransaction records the rebalancing actions at each period boundary.

#### Scenario: Annual rebalancing
- **WHEN** user selects "Anual" rebalancing with PETR4=60%/VALE3=40%
- **THEN** at each year boundary, weights are reset to 60/40 using prevailing prices and the trades are logged in BacktestTransaction

---

### Requirement: Saved Backtest Configurations
The system SHALL allow users to save (BacktestConfig), list (GET /api/backtest/configs), update, and delete backtest configurations.
Results can be retrieved via GET /api/backtest/configs/[id]/results.

#### Scenario: Saving a backtest configuration
- **WHEN** user clicks "Salvar Configuração"
- **THEN** a BacktestConfig with its associated BacktestAsset records is persisted under the user's account

#### Scenario: Retrieving previous results
- **WHEN** user selects a saved backtest from the list
- **THEN** previously computed BacktestResult data is loaded without re-running the simulation

---

### Requirement: Backtest-to-Portfolio Conversion
The system SHALL allow converting a backtest configuration into a live portfolio.

#### Scenario: Create portfolio from backtest
- **WHEN** user clicks "Criar Carteira a partir deste Backtest"
- **THEN** a new PortfolioConfig is created using the backtest's assets and target weights

---

### Requirement: Interactive Results Chart
The system SHALL display results with an interactive time-series chart
showing portfolio value and benchmark evolution over the selected period.

#### Scenario: Chart tooltip
- **WHEN** user hovers over a point on the chart
- **THEN** a tooltip shows: date, portfolio value, benchmark value, period return, and cumulative return from start
