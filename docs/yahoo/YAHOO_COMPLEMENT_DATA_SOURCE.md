# Yahoo Finance - Complementação de Dados e DataSource

## 🎯 Objetivo

Garantir que o Yahoo Finance atua como fonte **COMPLEMENTAR** de dados, preenchendo apenas campos ausentes e registrando sua contribuição no campo `dataSource`.

## 📋 Princípios

### 1. Complementação Não Invasiva

✅ **CORRETO**: Preencher apenas campos vazios (`null` ou `undefined`)
❌ **ERRADO**: Sobrescrever dados existentes de outras fontes

```typescript
// ✅ Lógica implementada
if (!existingCompany.website && yahooData.assetProfile?.website) {
  updateData.website = yahooData.assetProfile.website;
  fieldsComplemented++;
}
```

### 2. Rastreabilidade com dataSource

Sempre que o Yahoo Finance complementa dados, o campo `dataSource` é atualizado:

**Formato**: `{fonte_original}+yahoo`

**Exemplos**:
- `brapi` → `brapi+yahoo`
- `ward` → `ward+yahoo`
- `fundamentus+ward` → `fundamentus+ward+yahoo`
- `unknown` → `unknown+yahoo`

**Implementação**:
```typescript
let newDataSource = existingFinancialData.dataSource || 'unknown';
if (!newDataSource.includes('yahoo')) {
  newDataSource += '+yahoo';
}
updateData.dataSource = newDataSource;
```

### 3. Preservação de Dados Estratégicos

Alguns campos são **preservados por padrão**, mesmo se vazios, porque fontes prioritárias são mais precisas:

| Campo | Razão |
|-------|-------|
| `sector` | Ward/Fundamentus têm setores específicos da B3 |
| `industry` | Ward/Fundamentus têm classificações mais precisas para BR |

**Exceção**: Para novos ativos sem dados de outras fontes, `sector` e `industry` podem ser preenchidos.

## 📊 Campos Complementados

### Tabela `Company`

| Campo | Fonte Yahoo | Quando Complementa |
|-------|-------------|-------------------|
| `description` | `assetProfile.longBusinessSummary` | Se vazio |
| `website` | `assetProfile.website` | Se vazio |
| `address` | `assetProfile.address1` | Se vazio |
| `city` | `assetProfile.city` | Se vazio |
| `state` | `assetProfile.state` | Se vazio |
| `zip` | `assetProfile.zip` | Se vazio |
| `phone` | `assetProfile.phone` | Se vazio |
| `country` | `assetProfile.country` | Se vazio |
| `fullTimeEmployees` | `assetProfile.fullTimeEmployees` | Se vazio |
| `sector` | `assetProfile.sector` | ⚠️ Apenas se `preserveSector = false` |
| `industry` | `assetProfile.industry` | ⚠️ Apenas se `preserveIndustry = false` |

**⚠️ Nota**: `dataSource` não existe na tabela `Company`, apenas em `FinancialData`.

### Tabela `FinancialData` (ano corrente)

#### Market Data (from `quote`)

| Campo | Fonte Yahoo | Quando Complementa |
|-------|-------------|-------------------|
| `marketCap` | `quote.marketCap` | Se vazio |
| `sharesOutstanding` | `quote.sharesOutstanding` | Se vazio |
| `forwardPE` | `quote.forwardPE` | Se vazio |
| `pl` | `quote.trailingPE` | Se vazio |
| `pvp` | `quote.priceToBook` | Se vazio |
| `trailingEps` | `quote.epsTrailingTwelveMonths` | Se vazio |
| `dividendYield12m` | `quote.dividendYield` | Se vazio |

#### Financial Data (from `financialData` module)

| Campo | Fonte Yahoo | Quando Complementa |
|-------|-------------|-------------------|
| `totalCaixa` | `financialData.totalCash` | Se vazio |
| `caixaPorAcao` | `financialData.totalCashPerShare` | Se vazio |
| `ebitda` | `financialData.ebitda` | Se vazio |
| `totalDivida` | `financialData.totalDebt` | Se vazio |
| `liquidezRapida` | `financialData.quickRatio` | Se vazio |
| `liquidezCorrente` | `financialData.currentRatio` | Se vazio |
| `receitaTotal` | `financialData.totalRevenue` | Se vazio |
| `debtToEquity` | `financialData.debtToEquity` | Se vazio |
| `receitaPorAcao` | `financialData.revenuePerShare` | Se vazio |
| `roa` | `financialData.returnOnAssets` | Se vazio |
| `roe` | `financialData.returnOnEquity` | Se vazio |
| `fluxoCaixaLivre` | `financialData.freeCashflow` | Se vazio |
| `fluxoCaixaOperacional` | `financialData.operatingCashflow` | Se vazio |
| `crescimentoLucros` | `financialData.earningsGrowth` | Se vazio |
| `crescimentoReceitas` | `financialData.revenueGrowth` | Se vazio |
| `margemBruta` | `financialData.grossMargins` | Se vazio |
| `margemEbitda` | `financialData.ebitdaMargins` | Se vazio |
| `margemLiquida` | `financialData.profitMargins` | Se vazio |

#### Key Statistics (from `defaultKeyStatistics` module)

| Campo | Fonte Yahoo | Quando Complementa |
|-------|-------------|-------------------|
| `enterpriseValue` | `defaultKeyStatistics.enterpriseValue` | Se vazio |
| `vpa` | `defaultKeyStatistics.bookValue` | Se vazio |

#### Summary Detail (from `summaryDetail` module)

| Campo | Fonte Yahoo | Quando Complementa |
|-------|-------------|-------------------|
| `payout` | `summaryDetail.payoutRatio` | Se vazio |
| `variacao52Semanas` | `summaryDetail.fiftyTwoWeekChange` | Se vazio |

**✅ DataSource sempre atualizado**: Quando qualquer campo acima é complementado, `dataSource` recebe "+yahoo".

### Tabela `DividendHistory`

**Comportamento especial**: Dividendos são **sempre salvos**, mas com `upsert` para evitar duplicatas.

| Campo | Fonte Yahoo | Comportamento |
|-------|-------------|---------------|
| `exDate` | `chart.events.dividends[].date` | Upsert |
| `amount` | `chart.events.dividends[].amount` | Upsert |
| `source` | Fixo: `'yahoo'` | Sempre |

**⚠️ Unique constraint**: `@@unique([companyId, exDate, amount])` evita duplicatas.

### Tabelas Específicas (ETF/FII)

Estas tabelas são **sempre atualizadas** (não apenas complementadas):

#### `EtfData`

| Campo | Fonte Yahoo | Comportamento |
|-------|-------------|---------------|
| `netAssets` | `quote.marketCap` | Upsert |
| `dividendYield` | `quote.dividendYield` ou `summaryDetail.dividendYield` | Upsert |
| `ytdReturn` | `summaryDetail.fiftyTwoWeekChange` | Upsert |
| `totalAssets` | `summaryDetail.marketCap` | Upsert |

#### `FiiData`

| Campo | Fonte Yahoo | Comportamento |
|-------|-------------|---------------|
| `netAssets` | `quote.marketCap` | Upsert |
| `dividendYield` | `quote.dividendYield` ou `summaryDetail.dividendYield` | Upsert |
| `lastDividendValue` | `quote.dividendRate` | Upsert |
| `lastDividendDate` | `summaryDetail.exDividendDate` | Upsert |
| `patrimonioLiquido` | `quote.marketCap` | Upsert |
| `valorPatrimonial` | `quote.bookValue` | Upsert |

**⚠️ Nota**: ETF/FII data são sempre atualizados porque o Yahoo é a principal fonte para esses tipos de ativos.

## 🔄 Fluxo de Complementação

```
YahooFinanceComplementService.complementCompanyData(companyId, ticker)
  ↓
1️⃣ Busca dados completos do Yahoo (quote + quoteSummary + chart)
  ↓
2️⃣ Busca dados existentes do banco para o companyId
  ↓
3️⃣ COMPANY: Compara campo por campo
  ├─ Campo vazio? → Complementa
  └─ Campo preenchido? → Mantém
  ↓
4️⃣ FINANCIAL DATA (ano corrente): Compara campo por campo
  ├─ Campo vazio? → Complementa
  ├─ Campo preenchido? → Mantém
  └─ Algum campo complementado? → dataSource += '+yahoo'
  ↓
5️⃣ DIVIDENDS: Upsert todos os dividendos (histórico de 10 anos)
  ↓
6️⃣ ETF/FII DATA: Upsert (sempre atualiza)
```

## 📝 Exemplos

### Exemplo 1: Empresa COM dados de Ward (completos)

**Antes**:
```json
{
  "company": {
    "ticker": "PETR4",
    "name": "Petrobras",
    "sector": "Petróleo e Gás",  // Ward
    "industry": "Petróleo, Gás e Biocombustíveis",  // Ward
    "website": "https://petrobras.com.br",  // Ward
    "description": null,  // Vazio!
    "fullTimeEmployees": null  // Vazio!
  },
  "financialData": {
    "year": 2025,
    "marketCap": 500000000000,  // Brapi
    "roe": 0.25,  // Ward
    "roa": null,  // Vazio!
    "dataSource": "ward+brapi"
  }
}
```

**Após Yahoo Complement**:
```json
{
  "company": {
    "ticker": "PETR4",
    "name": "Petrobras",
    "sector": "Petróleo e Gás",  // ✅ PRESERVADO (Ward)
    "industry": "Petróleo, Gás e Biocombustíveis",  // ✅ PRESERVADO (Ward)
    "website": "https://petrobras.com.br",  // ✅ PRESERVADO (Ward)
    "description": "Petróleo Brasileiro S.A. - Petrobras...",  // ✅ COMPLEMENTADO (Yahoo)
    "fullTimeEmployees": 42000  // ✅ COMPLEMENTADO (Yahoo)
  },
  "financialData": {
    "year": 2025,
    "marketCap": 500000000000,  // ✅ PRESERVADO (Brapi)
    "roe": 0.25,  // ✅ PRESERVADO (Ward)
    "roa": 0.12,  // ✅ COMPLEMENTADO (Yahoo)
    "dataSource": "ward+brapi+yahoo"  // ✅ ATUALIZADO
  }
}
```

**Resultado**: 3 campos complementados, 5 preservados, `dataSource` atualizado.

### Exemplo 2: FII SEM dados de outras fontes (novo)

**Antes**:
```json
{
  "company": {
    "ticker": "HGLG11",
    "name": null,
    "sector": null,
    "industry": null,
    "website": null,
    "description": null
  },
  "financialData": null  // Não existe
}
```

**Após Yahoo Complement**:
```json
{
  "company": {
    "ticker": "HGLG11",
    "name": "CSHG LOGÍSTICA FDO INV IMOB",  // ✅ Yahoo
    "sector": "Real Estate",  // ✅ Yahoo (permitido porque estava vazio)
    "industry": "Real Estate - Development",  // ✅ Yahoo (permitido)
    "website": "https://cshg.com.br",  // ✅ Yahoo
    "description": "O CSHG Logística FII investe..."  // ✅ Yahoo
  },
  "fiiData": {
    "dividendYield": 0.0827,  // ✅ Yahoo
    "lastDividendValue": 1.1,  // ✅ Yahoo
    "patrimonioLiquido": 5398916608  // ✅ Yahoo
  },
  "dividendHistory": [
    { "exDate": "2025-10-01", "amount": 1.1, "source": "yahoo" },  // ✅ Yahoo
    { "exDate": "2025-09-01", "amount": 1.1, "source": "yahoo" },  // ✅ Yahoo
    // ... +118 dividendos mensais
  ]
}
```

**Resultado**: Tudo preenchido pelo Yahoo (não havia dados de outras fontes).

### Exemplo 3: ETF parcialmente preenchido

**Antes**:
```json
{
  "company": {
    "ticker": "BOVA11",
    "name": "iShares Ibovespa Fundo de Índice",  // Brapi
    "website": null,
    "description": null,
    "sector": null
  },
  "financialData": {
    "year": 2025,
    "marketCap": 15000000000,  // Brapi
    "dividendYield12m": null,
    "dataSource": "brapi"
  },
  "etfData": null
}
```

**Após Yahoo Complement**:
```json
{
  "company": {
    "ticker": "BOVA11",
    "name": "iShares Ibovespa Fundo de Índice",  // ✅ PRESERVADO (Brapi)
    "website": "https://ishares.com.br",  // ✅ COMPLEMENTADO (Yahoo)
    "description": "O iShares Ibovespa FI busca...",  // ✅ COMPLEMENTADO (Yahoo)
    "sector": null  // ⚠️ NÃO PREENCHIDO (ETFs não têm sector)
  },
  "financialData": {
    "year": 2025,
    "marketCap": 15000000000,  // ✅ PRESERVADO (Brapi)
    "dividendYield12m": 0.0521,  // ✅ COMPLEMENTADO (Yahoo)
    "dataSource": "brapi+yahoo"  // ✅ ATUALIZADO
  },
  "etfData": {
    "netAssets": 15000000000,  // ✅ CRIADO (Yahoo)
    "dividendYield": 0.0521,  // ✅ CRIADO (Yahoo)
    "totalAssets": 15000000000  // ✅ CRIADO (Yahoo)
  }
}
```

**Resultado**: 4 campos complementados, 2 preservados, ETF Data criado, `dataSource` atualizado.

## 🧪 Verificação

### Query 1: Ver empresas complementadas pelo Yahoo

```sql
SELECT 
  c.ticker,
  c.name,
  CASE WHEN c.description IS NOT NULL THEN '✅' ELSE '❌' END as description,
  CASE WHEN c.website IS NOT NULL THEN '✅' ELSE '❌' END as website,
  CASE WHEN c.fullTimeEmployees IS NOT NULL THEN '✅' ELSE '❌' END as employees,
  fd.data_source,
  fd.year
FROM companies c
LEFT JOIN financial_data fd ON fd.company_id = c.id AND fd.year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE c.asset_type IN ('STOCK', 'ETF', 'FII', 'BDR')
ORDER BY c.ticker
LIMIT 20;
```

### Query 2: Ver campos complementados pelo Yahoo em FinancialData

```sql
SELECT 
  c.ticker,
  fd.year,
  fd.data_source,
  COUNT(*) FILTER (WHERE fd.market_cap IS NOT NULL) as has_market_cap,
  COUNT(*) FILTER (WHERE fd.roe IS NOT NULL) as has_roe,
  COUNT(*) FILTER (WHERE fd.roa IS NOT NULL) as has_roa,
  COUNT(*) FILTER (WHERE fd.dividend_yield_12m IS NOT NULL) as has_dy
FROM companies c
JOIN financial_data fd ON fd.company_id = c.id
WHERE fd.data_source LIKE '%yahoo%'
GROUP BY c.ticker, fd.year, fd.data_source
ORDER BY c.ticker
LIMIT 20;
```

### Query 3: Estatísticas de complementação

```sql
-- Total de empresas com dados do Yahoo
SELECT 
  asset_type,
  COUNT(DISTINCT c.id) as total_companies,
  COUNT(DISTINCT CASE WHEN fd.data_source LIKE '%yahoo%' THEN c.id END) as with_yahoo,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN fd.data_source LIKE '%yahoo%' THEN c.id END) / 
    COUNT(DISTINCT c.id), 
    2
  ) as percentage
FROM companies c
LEFT JOIN financial_data fd ON fd.company_id = c.id AND fd.year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE c.asset_type IN ('STOCK', 'ETF', 'FII', 'BDR')
GROUP BY asset_type
ORDER BY asset_type;
```

## ⚠️ Limitações

### 1. Dados Financeiros Históricos Limitados

Desde Nov 2024, Yahoo Finance reduziu dados de:
- `balanceSheetHistory`
- `incomeStatementHistory`
- `cashflowStatementHistory`

**Solução**: Manter Ward API como fonte prioritária para dados históricos.

### 2. Apenas Ano Corrente

A complementação de `FinancialData` é feita apenas para o **ano corrente**:

```typescript
const currentYear = new Date().getFullYear();
```

**Razão**: Ward/Fundamentus/Brapi são melhores para dados históricos.

### 3. Setor e Indústria Genéricos

Yahoo Finance pode retornar setores genéricos:
- ❌ "Financial Services" em vez de "Bancos"
- ❌ "Real Estate" em vez de "Fundos Imobiliários"
- ✅ Ward/Fundamentus: Classificações B3 específicas

**Solução**: Preservar `sector` e `industry` das fontes prioritárias.

## 🎯 Conclusão

O Yahoo Finance atua como **última linha de defesa** para preencher gaps de dados, sempre:

✅ Complementando apenas campos vazios  
✅ Preservando dados de fontes prioritárias  
✅ Registrando sua contribuição no `dataSource`  
✅ Mantendo rastreabilidade completa  

**Prioridade Final**:
```
1️⃣ Fundamentus (setores B3, dados brasileiros)
    ↓
2️⃣ Ward API (dados financeiros históricos completos)
    ↓
3️⃣ Brapi API (dados TTM e preços)
    ↓
4️⃣ Yahoo Finance (complemento de gaps + dividendos)
```

---

**Data de Criação**: 20 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Implementado

