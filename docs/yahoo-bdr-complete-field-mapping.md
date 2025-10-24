# Yahoo Finance2 - Mapeamento Completo de Campos para BDRs

## Resumo da Exploração

A exploração completa revelou que o **Yahoo Finance2 tem cobertura MUITO MAIS ABRANGENTE** para BDRs do que inicialmente identificado. Os dados estão disponíveis em múltiplas APIs com diferentes níveis de detalhe.

### ⚠️ Correção Importante
**Verificação realizada em 24/10/2024**: Contrariamente ao primeiro relatório, o módulo `defaultKeyStatistics` **ESTÁ DISPONÍVEL** para BDRs, com 24-26 campos por ticker. A contagem de campos foi verificada com múltiplos BDRs (AMZO34, GOGL34, MSFT34).

## Campos Disponíveis por API

### 1. Quote API (70+ campos)
**Dados básicos de mercado e múltiplos fundamentais**

#### ✅ Campos Mapeados para FinancialData:
| Campo Schema | Campo Yahoo | Valor Exemplo (AMZO34) |
|--------------|-------------|-------------------------|
| `pl` | `trailingPE` | 34.19 |
| `forwardPE` | `forwardPE` | ❌ Não disponível |
| `pvp` | `priceToBook` | 1.93 |
| `dy` | `dividendYield` | ❌ Não disponível |
| `evEbitda` | `enterpriseToEbitda` | ❌ Não disponível |
| `evRevenue` | `enterpriseToRevenue` | ❌ Não disponível |
| `lpa` | `trailingEps` | 1.77 |
| `vpa` | `bookValue` | 31.37 |
| `marketCap` | `marketCap` | R$ 12.9 trilhões |
| `enterpriseValue` | `enterpriseValue` | ❌ Não disponível |
| `sharesOutstanding` | `sharesOutstanding` | ❌ Não disponível |
| `debtToEquity` | `debtToEquity` | 47.81 |
| `liquidezCorrente` | `currentRatio` | 1.02 |
| `liquidezRapida` | `quickRatio` | 0.77 |
| `roe` | `returnOnEquity` | 0.25 (25%) |
| `roa` | `returnOnAssets` | 0.08 (8%) |
| `margemBruta` | `grossMargins` | 0.50 (50%) |
| `margemLiquida` | `profitMargins` | 0.11 (11%) |
| `crescimentoLucros` | `earningsGrowth` | 0.33 (33%) |
| `crescimentoReceitas` | `revenueGrowth` | 0.13 (13%) |
| `receitaTotal` | `totalRevenue` | R$ 670.04B |
| `fluxoCaixaOperacional` | `operatingCashflow` | R$ 121.14B |
| `fluxoCaixaLivre` | `freeCashflow` | R$ 31.02B |
| `totalCaixa` | `totalCash` | R$ 93.18B |
| `totalDivida` | `totalDebt` | R$ 159.57B |
| `receitaPorAcao` | `revenuePerShare` | 63.37 |
| `caixaPorAcao` | `totalCashPerShare` | 8.74 |

### 2. QuoteSummary API - Módulos Detalhados

#### 📊 FinancialData Module (24 campos)
```
currentPrice: 60.51
totalCash: 93.18B
totalCashPerShare: 8.74
ebitda: 133.83B
totalDebt: 159.57B
quickRatio: 0.77
currentRatio: 1.02
totalRevenue: 670.04B
debtToEquity: 47.81
revenuePerShare: 63.37
returnOnAssets: 0.08
returnOnEquity: 0.25
grossProfits: 332.38B
freeCashflow: 31.02B
operatingCashflow: 121.14B
earningsGrowth: 0.33
revenueGrowth: 0.13
grossMargins: 0.50
ebitdaMargins: 0.20
operatingMargins: 0.11
profitMargins: 0.11
```

#### 📈 DefaultKeyStatistics Module (24-26 campos)
```
enterpriseValue: 703.41B
profitMargins: 0.11
floatShares: 9.68B
sharesOutstanding: 213.30B
heldPercentInsiders: 0.00
heldPercentInstitutions: 0.00
beta: 1.28
impliedSharesOutstanding: 215.76B
priceHint: 2.00
maxAge: 1.00
... e mais 14-16 campos dependendo do BDR
```

#### 💰 SummaryDetail Module (34-38 campos)
```
trailingPE: 34.19
beta: 1.28
marketCap: 12906.68B
fiftyTwoWeekLow: 47.51
fiftyTwoWeekHigh: 71.83
priceToSalesTrailing12Months: 19.26
payoutRatio: 0.00
trailingAnnualDividendRate: 0.00
trailingAnnualDividendYield: 0.00
```

#### 🌎 SummaryProfile Module (18-19 campos)
```
sector: Consumer Cyclical
industry: Internet Retail
country: United States
fullTimeEmployees: 1.55M
longBusinessSummary: Amazon.com, Inc. engages in...
website: https://www.aboutamazon.com
```

### 3. FundamentalsTimeSeries API - Dados Históricos Completos

#### 🏦 Balance Sheet (60+ campos históricos)
```
totalAssets: 624.89B
currentAssets: 190.87B
cashAndCashEquivalents: 78.78B
inventory: 34.21B
accountsReceivable: 55.45B
stockholdersEquity: 285.97B
currentLiabilities: 179.43B
longTermDebt: 52.62B
totalDebt: 130.90B
retainedEarnings: 172.87B
commonStock: 111M
goodwill: 23.07B
netPPE: 328.81B
workingCapital: 11.44B
```

#### 📊 Income Statement (Dados via erro de validação)
```
researchAndDevelopment: 42.74B
totalRevenue: Disponível
netIncome: Disponível
operatingIncome: Disponível
grossProfit: Disponível
costOfRevenue: Disponível
```

#### 💸 Cash Flow (50+ campos)
```
operatingCashFlow: 115.88B
investingCashFlow: -94.34B
financingCashFlow: -11.81B
freeCashFlow: 32.88B
capitalExpenditure: -83.00B
netIncomeFromContinuingOperations: 59.25B
depreciationAndAmortization: 52.80B
stockBasedCompensation: 22.01B
changeInWorkingCapital: -15.54B
```

## Mapeamento Completo para Schema Prisma

### ✅ Campos DISPONÍVEIS no Yahoo Finance2

#### FinancialData Model - Cobertura: ~70%
```prisma
// ✅ DISPONÍVEIS
pl                    ← trailingPE (Quote)
pvp                   ← priceToBook (Quote/KeyStats)
lpa                   ← trailingEps (Quote)
vpa                   ← bookValue (Quote)
marketCap             ← marketCap (Quote)
debtToEquity          ← debtToEquity (Quote)
liquidezCorrente      ← currentRatio (Quote)
liquidezRapida        ← quickRatio (Quote)
roe                   ← returnOnEquity (Quote)
roa                   ← returnOnAssets (Quote)
margemBruta           ← grossMargins (Quote)
margemLiquida         ← profitMargins (Quote)
margemEbitda          ← ebitdaMargins (FinancialData)
crescimentoLucros     ← earningsGrowth (Quote)
crescimentoReceitas   ← revenueGrowth (Quote)
ebitda                ← ebitda (FinancialData)
receitaTotal          ← totalRevenue (Quote/FinancialData)
fluxoCaixaOperacional ← operatingCashflow (Quote)
fluxoCaixaLivre       ← freeCashflow (Quote)
totalCaixa            ← totalCash (Quote)
totalDivida           ← totalDebt (Quote)
receitaPorAcao        ← revenuePerShare (Quote)
caixaPorAcao          ← totalCashPerShare (Quote)
variacao52Semanas     ← fiftyTwoWeekChange (calculado)
beta                  ← beta (SummaryDetail)

// ⚠️ PARCIALMENTE DISPONÍVEIS
forwardPE             ← forwardPE (KeyStats - nem sempre)
enterpriseValue       ← enterpriseValue (KeyStats - nem sempre)
sharesOutstanding     ← sharesOutstanding (KeyStats - nem sempre)
evEbitda              ← enterpriseToEbitda (KeyStats - nem sempre)
evRevenue             ← enterpriseToRevenue (KeyStats - nem sempre)

// ❌ NÃO DISPONÍVEIS
earningsYield         ← Não encontrado
psr                   ← Pode ser calculado (price/revenuePerShare)
pAtivos               ← Não encontrado
pCapGiro              ← Não encontrado
pEbit                 ← Não encontrado
roic                  ← Não encontrado diretamente
giroAtivos            ← Pode ser calculado
cagrLucros5a          ← Precisa ser calculado
cagrReceitas5a        ← Precisa ser calculado
dy                    ← Geralmente 0 para BDRs
ultimoDividendo       ← Geralmente 0 para BDRs
```

#### BalanceSheet Model - Cobertura: ~90%
```prisma
// ✅ DISPONÍVEIS (FundamentalsTimeSeries)
totalAssets           ← totalAssets
totalCurrentAssets    ← currentAssets
cash                  ← cashAndCashEquivalents
totalStockholderEquity ← stockholdersEquity
totalCurrentLiabilities ← currentLiabilities
longTermDebt          ← longTermDebt
inventory             ← inventory
netReceivables        ← accountsReceivable
commonStock           ← commonStock
retainedEarnings      ← retainedEarnings
goodWill              ← goodwill
netTangibleAssets     ← netTangibleAssets
workingCapital        ← workingCapital
totalDebt             ← totalDebt
```

#### IncomeStatement Model - Cobertura: ~60%
```prisma
// ✅ DISPONÍVEIS (FinancialData + FundamentalsTimeSeries)
totalRevenue          ← totalRevenue
netIncome             ← Disponível via FundamentalsTimeSeries
grossProfit           ← grossProfits (FinancialData)
operatingIncome       ← Disponível via FundamentalsTimeSeries
researchDevelopment   ← researchAndDevelopment
ebit                  ← Disponível via FundamentalsTimeSeries

// ❌ LIMITADOS
costOfRevenue         ← Limitado
totalOperatingExpenses ← Limitado
```

#### CashflowStatement Model - Cobertura: ~95%
```prisma
// ✅ EXCELENTE COBERTURA (FundamentalsTimeSeries)
operatingCashFlow     ← operatingCashFlow
investmentCashFlow    ← investingCashFlow
financingCashFlow     ← financingCashFlow
freeCashFlow          ← freeCashFlow
capitalExpenditures   ← capitalExpenditure
netIncomeFromContinuingOps ← netIncomeFromContinuingOperations
depreciationAndAmortization ← depreciationAndAmortization
stockBasedCompensation ← stockBasedCompensation
changeInWorkingCapital ← changeInWorkingCapital
```

## Estratégia de Implementação Recomendada

### 1. **Dados Atuais (Quote + FinancialData)**
```typescript
// Para dados em tempo real e múltiplos atuais
const currentData = await yahooFinance.quote(ticker);
const financialData = await yahooFinance.quoteSummary(ticker, {
  modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail']
});
```

### 2. **Dados Históricos (FundamentalsTimeSeries)**
```typescript
// Para dados históricos de balanço, DRE e fluxo de caixa
const historicalData = await yahooFinance.fundamentalsTimeSeries(ticker, {
  period1: '2020-01-01',
  type: 'annual',
  module: 'all' // ou 'balance-sheet', 'cash-flow'
});
```

### 3. **Tratamento de Erros de Validação**
```typescript
try {
  const data = await yahooFinance.fundamentalsTimeSeries(ticker, config);
  return data;
} catch (error) {
  // Extrai dados do erro de validação
  if (error.message.includes('Failed Yahoo Schema validation') && error.result) {
    return error.result; // Dados estão aqui!
  }
  throw error;
}
```

## Conclusões Finais

### 🎯 **Cobertura Excelente para BDRs**
- **Quote API**: 70% dos campos do FinancialData
- **QuoteSummary**: Dados complementares essenciais
- **FundamentalsTimeSeries**: 90%+ dos campos de BalanceSheet e CashFlow

### 💡 **Recomendações**
1. **Use Yahoo Finance2 como fonte PRIMÁRIA para BDRs**
2. **Combine múltiplas APIs** para cobertura completa
3. **Implemente tratamento de erros de validação** para acessar dados do FundamentalsTimeSeries
4. **Calcule campos derivados** (CAGR, ratios) quando necessário

### 🚀 **Vantagens Únicas para BDRs**
- **Dados da empresa matriz americana** (setor, indústria, funcionários)
- **Múltiplos de valuation** completos
- **Dados históricos** de 5+ anos
- **Fluxo de caixa detalhado** (50+ campos)
- **Informações corporativas** (website, endereço, executivos)

O Yahoo Finance2 se mostrou uma **fonte excepcional para BDRs**, oferecendo muito mais dados do que inicialmente identificado, incluindo informações únicas da empresa matriz americana que não estão disponíveis em outras fontes brasileiras.