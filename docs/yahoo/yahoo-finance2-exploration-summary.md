# Yahoo Finance2 Exploration Summary

## Overview

This document summarizes the exploration of the `yahoo-finance2` library for extracting fundamental financial data from Brazilian stocks (B3). The exploration was conducted to evaluate whether this library can serve as an additional data source for our financial analysis platform.

## Key Findings

### ✅ What Works

1. **Quote API**: Fully functional for Brazilian stocks
   - Returns current market data, basic ratios, and key metrics
   - Fields available: price, marketCap, P/E, P/B, dividend yield, etc.
   - Success rate: 100% for tested Brazilian stocks

2. **QuoteSummary API**: Functional with limitations
   - Returns multiple modules of financial data
   - Available modules: financialData, defaultKeyStatistics, summaryDetail
   - Historical data modules available but with limited data since Nov 2024
   - Success rate: 100% for tested Brazilian stocks

3. **FundamentalsTimeSeries API**: Functional but with validation issues
   - Contains actual financial data but fails schema validation
   - Data is accessible through error handling
   - Contains comprehensive balance sheet, income statement, and cash flow data
   - Success rate: 100% for data extraction (with validation bypass)

### ❌ Current Limitations

1. **Schema Validation Issues**: The library's validation fails for Brazilian stocks due to additional fields not expected in the schema
2. **Historical Data Limitation**: Yahoo changed their API in November 2024, reducing historical data availability in quoteSummary modules
3. **Data Format**: Some data comes in Yahoo's format with `.raw` and `.fmt` properties
4. **Library Version**: The installed version (3.10.0) has known validation issues

## Tested Brazilian Stocks

The following stocks were successfully tested:
- **PETR4.SA** (Petrobras) - Oil & Gas
- **VALE3.SA** (Vale) - Mining
- **ITUB4.SA** (Itaú) - Banking
- **BBDC4.SA** (Bradesco) - Banking
- **ABEV3.SA** (Ambev) - Beverages
- **WEGE3.SA** (WEG) - Industrial Equipment
- **MGLU3.SA** (Magazine Luiza) - Retail

## Available Data Fields

### From Quote API
- `regularMarketPrice` - Current stock price
- `marketCap` - Market capitalization
- `trailingPE` - Trailing P/E ratio
- `forwardPE` - Forward P/E ratio
- `priceToBook` - P/B ratio
- `dividendYield` - Dividend yield
- `trailingEps` - Trailing EPS
- `bookValue` - Book value per share
- `sharesOutstanding` - Shares outstanding
- `enterpriseValue` - Enterprise value
- `enterpriseToRevenue` - EV/Revenue
- `enterpriseToEbitda` - EV/EBITDA
- `totalCash` - Total cash
- `totalDebt` - Total debt
- `totalRevenue` - Total revenue
- `debtToEquity` - Debt to equity ratio
- `currentRatio` - Current ratio
- `returnOnAssets` - ROA
- `returnOnEquity` - ROE
- `operatingCashflow` - Operating cash flow
- `freeCashflow` - Free cash flow

### From FundamentalsTimeSeries API (via validation bypass)
- **Balance Sheet**: totalAssets, totalCurrentAssets, cash, totalStockholderEquity, totalCurrentLiabilities, longTermDebt, inventory, netReceivables
- **Income Statement**: totalRevenue, netIncome, operatingIncome, grossProfit, costOfRevenue, ebit, basicEPS, dilutedEPS
- **Cash Flow**: operatingCashFlow, investingCashFlow, financingCashFlow, freeCashFlow, capitalExpenditures

## Mapping to Our Prisma Schema

### FinancialData Model
| Our Field | Yahoo Field | Source API | Notes |
|-----------|-------------|------------|-------|
| `pl` | `trailingPE` | quote | Direct mapping |
| `forwardPE` | `forwardPE` | quote | Direct mapping |
| `pvp` | `priceToBook` | quote | Direct mapping |
| `dy` | `dividendYield` | quote | Direct mapping |
| `evEbitda` | `enterpriseToEbitda` | quote | Direct mapping |
| `evRevenue` | `enterpriseToRevenue` | quote | Direct mapping |
| `lpa` | `trailingEps` | quote | Direct mapping |
| `vpa` | `bookValue` | quote | Direct mapping |
| `marketCap` | `marketCap` | quote | Direct mapping |
| `enterpriseValue` | `enterpriseValue` | quote | Direct mapping |
| `sharesOutstanding` | `sharesOutstanding` | quote | Direct mapping |
| `debtToEquity` | `debtToEquity` | quote | Direct mapping |
| `liquidezCorrente` | `currentRatio` | quote | Direct mapping |
| `roe` | `returnOnEquity` | quote | Direct mapping |
| `roa` | `returnOnAssets` | quote | Direct mapping |
| `receitaTotal` | `totalRevenue` | quote/fundamentals | Direct mapping |
| `lucroLiquido` | `netIncome` | fundamentals | From fundamentalsTimeSeries |
| `fluxoCaixaOperacional` | `operatingCashFlow` | quote/fundamentals | Direct mapping |
| `fluxoCaixaLivre` | `freeCashFlow` | quote/fundamentals | Direct mapping |
| `totalCaixa` | `totalCash` | quote | Direct mapping |
| `totalDivida` | `totalDebt` | quote | Direct mapping |

### BalanceSheet Model
| Our Field | Yahoo Field | Source API |
|-----------|-------------|------------|
| `totalAssets` | `totalAssets` | fundamentals |
| `totalCurrentAssets` | `totalCurrentAssets` | fundamentals |
| `cash` | `cash` | fundamentals |
| `totalStockholderEquity` | `totalStockholderEquity` | fundamentals |
| `totalCurrentLiabilities` | `totalCurrentLiabilities` | fundamentals |
| `longTermDebt` | `longTermDebt` | fundamentals |
| `inventory` | `inventory` | fundamentals |
| `netReceivables` | `netReceivables` | fundamentals |

### IncomeStatement Model
| Our Field | Yahoo Field | Source API |
|-----------|-------------|------------|
| `totalRevenue` | `totalRevenue` | fundamentals |
| `netIncome` | `netIncome` | fundamentals |
| `operatingIncome` | `operatingIncome` | fundamentals |
| `grossProfit` | `grossProfit` | fundamentals |
| `costOfRevenue` | `costOfRevenue` | fundamentals |
| `ebit` | `ebit` | fundamentals |
| `basicEarningsPerShare` | `basicEPS` | fundamentals |
| `dilutedEarningsPerShare` | `dilutedEPS` | fundamentals |

### CashflowStatement Model
| Our Field | Yahoo Field | Source API |
|-----------|-------------|------------|
| `operatingCashFlow` | `operatingCashFlow` | fundamentals |
| `investmentCashFlow` | `investingCashFlow` | fundamentals |
| `financingCashFlow` | `financingCashFlow` | fundamentals |
| `freeCashFlow` | `freeCashFlow` | fundamentals |
| `capitalExpenditures` | `capitalExpenditures` | fundamentals |

## Implementation Recommendations

### 1. Use Quote API for Current Data
```typescript
const quote = await yahooFinance.quote('PETR4.SA');
// Extract current ratios, market data, and basic fundamentals
```

### 2. Use FundamentalsTimeSeries with Error Handling
```typescript
try {
  const data = await yahooFinance.fundamentalsTimeSeries('PETR4.SA', {
    period1: '2020-01-01',
    type: 'annual',
    module: 'all'
  });
} catch (error) {
  // Extract data from validation error if available
  if (error.result) {
    const actualData = error.result;
    // Process the data
  }
}
```

### 3. Data Processing Pipeline
1. **Primary Source**: Continue using Brapi API as main source
2. **Secondary Source**: Use Yahoo Finance2 for additional data points
3. **Data Validation**: Cross-validate data between sources
4. **Fallback Strategy**: Use Yahoo when Brapi is unavailable

### 4. Error Handling Strategy
```typescript
// Disable validation to avoid schema issues
const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey'],
  validation: false 
});
```

## Integration Strategy

### Phase 1: Quote API Integration
- Implement Yahoo Finance2 as a secondary data source for current market data
- Use for real-time price updates and basic ratios
- Cross-validate with existing Brapi data

### Phase 2: Historical Data Integration
- Implement fundamentalsTimeSeries with proper error handling
- Extract historical balance sheet, income statement, and cash flow data
- Map to existing Prisma schema

### Phase 3: Data Quality Improvement
- Implement data reconciliation between sources
- Add data quality checks and validation
- Create fallback mechanisms for missing data

## Conclusion

The `yahoo-finance2` library is **viable as a secondary data source** for Brazilian stocks with the following considerations:

### ✅ Pros
- Comprehensive data coverage for Brazilian stocks
- Real-time market data through Quote API
- Historical fundamental data available
- Free to use (no API key required)
- Good performance and reliability

### ⚠️ Cons
- Schema validation issues require workarounds
- Data format differences need mapping
- Some historical data limitations since Nov 2024
- Requires error handling for validation failures

### 🎯 Recommendation
**Implement as a secondary data source** alongside the existing Brapi API to:
1. Improve data coverage and reliability
2. Provide fallback when primary source fails
3. Cross-validate financial data for accuracy
4. Access additional data points not available in Brapi

The implementation should focus on the Quote API first (Phase 1) as it's the most stable, then gradually integrate historical data (Phase 2) with proper error handling for validation issues.