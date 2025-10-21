# Integração Completa Yahoo Finance2 - Documentação

## 🎯 Objetivo

Integrar `yahoo-finance2` como **fonte complementar final** de dados para empresas, preenchendo APENAS campos que não foram preenchidos pelas fontes prioritárias (Ward, Fundamentus, Brapi).

## 📊 Prioridade de Fontes de Dados

```
1️⃣ Fundamentus (Dados brasileiros mais precisos - setor, indústria, métricas BR)
    ↓
2️⃣ Ward API (Dados financeiros históricos completos)
    ↓  
3️⃣ Brapi API (Dados financeiros TTM e históricos)
    ↓
4️⃣ Yahoo Finance2 (COMPLEMENTO - apenas campos ausentes + DIVIDENDOS)
```

## ✅ O Que Foi Implementado

### 1. Script Exploratório Completo

**Arquivo**: `scripts/explore-yahoo-finance2.ts`

**Executado com sucesso**: ✅
- 4 tipos de ativos testados (PETR4, BOVA11, HGLG11, GOGL34)
- 41 módulos do yahoo-finance2 explorados
- Resultados salvos em `.exploration-results/`

**Principais descobertas:**
- ✅ **Dividendos disponíveis**: Todos os ativos têm histórico completo via `chart()`
- ✅ **Quote data**: Muitos campos úteis (marketCap, PE, dividendYield, etc)
- ✅ **QuoteSummary**: Asset profile, financial data, key statistics
- ⚠️ **Financial statements**: Dados limitados desde Nov 2024 (Yahoo mudou API)

### 2. Yahoo Finance Complement Service

**Arquivo**: `src/lib/yahoo-finance-complement-service.ts` ✨ NOVO

#### Features Principais:

**a) Fetch Completo de Dados**
```typescript
YahooFinanceComplementService.fetchCompleteData(ticker)
```

Extrai TODOS os dados disponíveis:
- Quote data (50+ campos)
- Summary detail (15+ campos)
- Asset profile (endereço, website, funcionários, etc)
- Financial data (30+ métricas financeiras)
- Default key statistics (25+ estatísticas)
- **Dividendos históricos** (últimos 10 anos)
- Dados específicos por tipo (ETF, FII)

**b) Complementação Inteligente**
```typescript
YahooFinanceComplementService.complementCompanyData(
  companyId,
  ticker,
  preserveSector,    // true = não sobrescrever sector se já existe
  preserveIndustry   // true = não sobrescrever industry se já existe
)
```

**Lógica de Complementação:**
```typescript
// Para cada campo da empresa:
if (!existingCompany.fieldName && yahooData.fieldName) {
  updateData.fieldName = yahooData.fieldName;
}
```

**Campos Complementados:**
- ✅ `description` - Descrição da empresa
- ✅ `website` - Website oficial
- ✅ `address`, `city`, `state`, `zip` - Endereço completo
- ✅ `phone` - Telefone
- ✅ `country` - País
- ✅ `fullTimeEmployees` - Número de funcionários
- ⚠️ `sector` - Apenas se `preserveSector = false`
- ⚠️ `industry` - Apenas se `preserveIndustry = false`

**c) Salvamento Automático de Dividendos**

Sempre que um ativo é processado:
1. ✅ Busca todos os dividendos históricos (10 anos)
2. ✅ Salva na tabela `dividend_history` (upsert para evitar duplicatas)
3. ✅ Atualiza campos `ultimoDividendo` e `dataUltimoDividendo` na Company
4. ✅ Batch processing (50 dividendos por lote)

**Estrutura da tabela `dividend_history`:**
```prisma
model DividendHistory {
  id              Int      @id @default(autoincrement())
  companyId       Int
  exDate          DateTime // Data ex-dividendo
  paymentDate     DateTime? // Data de pagamento (se disponível)
  amount          Decimal  // Valor por ação
  type            String?  // dividend, JCP, etc
  currency        String?  @default("BRL")
  source          String   @default("yahoo")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([companyId, exDate, amount])
  @@index([companyId, exDate])
}
```

**d) Atualização de Dados Específicos**

**ETFs:**
```typescript
{
  netAssets: marketCap
  dividendYield: dividendYield
  ytdReturn: fiftyTwoWeekChange
  totalAssets: marketCap
}
```

**FIIs:**
```typescript
{
  netAssets: marketCap
  dividendYield: dividendYield
  lastDividendValue: dividendRate
  lastDividendDate: exDividendDate
  patrimonioLiquido: marketCap
  valorPatrimonial: bookValue
}
```

### 3. AssetRegistrationService Atualizado

**Arquivo**: `src/lib/asset-registration-service.ts`

#### Fluxo Completo de Registro/Atualização:

**Quando o ativo JÁ EXISTE:**
```typescript
1. Busca dados do HistoricalDataService (quote + quoteSummary básico)
2. Atualiza Company (preserva sector/industry se existentes)
3. Atualiza dados específicos (ETF/FII)
4. 🆕 Complementa com YahooFinanceComplementService:
   - Preenche campos ausentes
   - Salva dividendos históricos
   - Atualiza ETF/FII data
```

**Quando o ativo NÃO EXISTE:**
```typescript
1. Cria Company com dados básicos
2. Salva dados específicos (ETF/FII)
3. 🆕 Complementa com YahooFinanceComplementService:
   - Preenche TODOS os campos disponíveis
   - Salva dividendos históricos
   - Atualiza ETF/FII data
4. Busca dados históricos de preços (2 anos)
```

## 📊 Dados Extraídos do Yahoo Finance

### Quote Module (50+ campos)

```typescript
{
  // Mercado
  sharesOutstanding: 5446501379
  marketCap: 398065041408
  bookValue: 5.676
  
  // Valuation
  forwardPE: 3.7039802
  priceToBook: 5.2466526
  trailingPE: 5.108062
  
  // Dividendos
  dividendRate: 3.69
  dividendYield: 12.4
  trailingAnnualDividendRate: 1.335
  trailingAnnualDividendYield: 0.04490414
  
  // Lucros
  epsTrailingTwelveMonths: 5.83
  epsForward: 8.04
  epsCurrentYear: 15.73985
  
  // Médias Móveis
  fiftyDayAverage: 30.8894
  twoHundredDayAverage: 32.93055
  
  // 52 Semanas
  fiftyTwoWeekLow: 28.86
  fiftyTwoWeekHigh: 40.76
  fiftyTwoWeekChangePercent: -17.986208
  
  // Volume
  regularMarketVolume: 23472900
  averageDailyVolume3Month: 29414949
  averageDailyVolume10Day: 28828490
  
  // Outros
  beta: 0.126
  ...
}
```

### SummaryDetail Module (15+ campos)

```typescript
{
  dividendRate: 13.2
  dividendYield: 0.08270001
  exDividendDate: "2025-10-01"
  payoutRatio: 0.83489996
  beta: 0.126
  trailingPE: 9.845348
  marketCap: 5398916608
  fiftyTwoWeekLow: 142
  fiftyTwoWeekHigh: 163.3
  allTimeHigh: 217.98961
  allTimeLow: 82.48999
  priceToSalesTrailing12Months: 12.26093
  fiftyDayAverage: 156.8314
  twoHundredDayAverage: 154.85146
  fiftyTwoWeekChange: 0.031878036
}
```

### AssetProfile Module

```typescript
{
  address1: "Av. República do Chile, 65"
  city: "Rio de Janeiro"
  state: "RJ"
  zip: "20031-912"
  country: "Brazil"
  phone: "+55 21 3224-1510"
  website: "https://petrobras.com.br"
  sector: "Energy"
  industry: "Oil & Gas Integrated"
  longBusinessSummary: "Petróleo Brasileiro S.A. - Petrobras..."
  fullTimeEmployees: 42000
}
```

### Dividends (from Chart)

```typescript
[
  { date: "2025-10-01", amount: 1.1 },
  { date: "2025-09-01", amount: 1.1 },
  { date: "2025-08-01", amount: 1.1 },
  ... (até 10 anos atrás)
]
```

## 🔄 Fluxo de Integração

### 1. Adição de Ativo em Carteira

```
POST /api/portfolio/[id]/assets
  ↓
AssetRegistrationService.registerAsset(ticker)
  ↓
[Verifica se existe]
  ↓ SIM
  ├─ HistoricalDataService.fetchAssetInfo() (básico)
  ├─ updateCompanyRecord() (preserva sector/industry)
  ├─ saveAssetSpecificData() (ETF/FII)
  └─ 🆕 YahooFinanceComplementService.complementCompanyData()
      ├─ Preenche campos ausentes
      ├─ Salva dividendos históricos
      └─ Atualiza ETF/FII data
  ↓ NÃO  
  ├─ createCompanyRecord()
  ├─ saveAssetSpecificData()
  ├─ 🆕 YahooFinanceComplementService.complementCompanyData()
  │   ├─ Preenche TODOS os campos
  │   ├─ Salva dividendos históricos
  │   └─ Atualiza ETF/FII data
  └─ HistoricalDataService.ensureHistoricalData() (2 anos)
```

### 2. Cron Job de Atualização

```
GET /api/cron/update-portfolio-assets
  ↓
PortfolioAssetUpdateService.updateAllPortfolioAssets()
  ↓
Para cada ticker de todas as carteiras:
  ├─ AssetRegistrationService.registerAsset(ticker)
  │   └─ 🆕 YahooFinanceComplementService.complementCompanyData()
  │       ├─ Atualiza campos ausentes
  │       ├─ Atualiza dividendos
  │       └─ Atualiza ETF/FII data
  └─ HistoricalDataService.ensureHistoricalData() (incremental)
```

## 🐛 Correção: Dividendos de FIIs

### Problema Identificado

❌ **Tabela `dividend_history` não estava sendo preenchida**

**Causa**: DividendService existia, mas não estava sendo chamado no fluxo principal de registro/atualização de ativos.

### Solução Implementada

✅ **Integração no fluxo de registro**

1. Criado `YahooFinanceComplementService` que SEMPRE busca e salva dividendos
2. Integrado no `AssetRegistrationService.registerAsset()`
3. Chamado tanto para ativos novos quanto existentes
4. Batch processing para performance

**Resultado:**
- ✅ FIIs agora têm dividendos mensais salvos automaticamente
- ✅ Histórico completo (10 anos) disponível
- ✅ Campos `ultimoDividendo` e `dataUltimoDividendo` atualizados
- ✅ Tabela `dividend_history` populada corretamente

## 📝 Como Usar

### Complementar Dados de Uma Empresa

```typescript
import { YahooFinanceComplementService } from '@/lib/yahoo-finance-complement-service';

// Complementar empresa existente
await YahooFinanceComplementService.complementCompanyData(
  companyId,
  'HGLG11',
  true,  // preservar sector se existir
  true   // preservar industry se existir
);
```

### Buscar Dados Completos

```typescript
// Buscar todos os dados disponíveis
const data = await YahooFinanceComplementService.fetchCompleteData('HGLG11');

// Retorna:
{
  ticker: "HGLG11",
  name: "CSHG LOGÍSTICA FDO INV IMOB",
  assetType: "FII",
  quote: { ... 50+ campos ... },
  summaryDetail: { ... 15+ campos ... },
  assetProfile: { ... endereço, website, etc ... },
  financialData: { ... 30+ métricas ... },
  dividends: [ ... histórico completo ... ],
  fiiData: { ... dados específicos de FII ... }
}
```

## 📊 Estatísticas

### Dados Extraídos por Tipo

| Tipo | Quote | SummaryDetail | AssetProfile | Dividends | Specific Data |
|------|-------|---------------|--------------|-----------|---------------|
| **STOCK** | ✅ 50+ | ✅ 15+ | ✅ 10+ | ✅ Sim | ❌ N/A |
| **ETF** | ✅ 50+ | ✅ 15+ | ✅ 10+ | ✅ Sim | ✅ ETF Data |
| **FII** | ✅ 50+ | ✅ 15+ | ⚠️ 5+ | ✅ Sim | ✅ FII Data |
| **BDR** | ✅ 50+ | ✅ 15+ | ✅ 10+ | ✅ Sim | ❌ N/A |

### Módulos Universais (disponíveis para todos)

34 módulos funcionam para todos os tipos:
- ✅ quote, chart, historical, search
- ✅ quoteSummary (28 submódulos)
- ✅ insights, recommendationsBySymbol, options

## 🚀 Performance

### Otimizações Implementadas:

1. **Parallel Fetch**: Quote, QuoteSummary e Chart em paralelo
2. **Batch Processing**: Dividendos salvos em lotes de 50
3. **Upsert Intelligence**: Evita duplicatas com `@@unique([companyId, exDate, amount])`
4. **Lazy Loading**: Yahoo Finance instance carregada sob demanda
5. **Error Handling**: Falhas parciais não impedem o fluxo completo

### Tempo Estimado:

| Operação | Tempo |
|----------|-------|
| Fetch completo | ~3-5 segundos |
| Complementar dados | ~2-3 segundos |
| Salvar dividendos (10 anos) | ~1-2 segundos |
| **Total por ativo** | **~6-10 segundos** |

## 🔍 Verificação

### Conferir se Dividendos Foram Salvos

```sql
-- Ver dividendos de um FII
SELECT 
  c.ticker,
  COUNT(dh.id) as total_dividendos,
  MAX(dh.exDate) as ultimo_dividendo_data,
  MAX(dh.amount) as ultimo_dividendo_valor
FROM dividend_history dh
JOIN companies c ON c.id = dh.companyId
WHERE c.ticker = 'HGLG11'
GROUP BY c.ticker;

-- Ver empresas SEM dividendos salvos
SELECT 
  c.ticker,
  c.name,
  c.assetType
FROM companies c
LEFT JOIN dividend_history dh ON dh.companyId = c.id
WHERE dh.id IS NULL
  AND c.assetType IN ('STOCK', 'FII')
ORDER BY c.ticker;
```

### Conferir Campos Complementados

```sql
-- Ver empresas COM dados complementados do Yahoo
SELECT 
  ticker,
  name,
  CASE 
    WHEN description IS NOT NULL THEN '✅'
    ELSE '❌'
  END as description,
  CASE 
    WHEN website IS NOT NULL THEN '✅'
    ELSE '❌'
  END as website,
  CASE 
    WHEN fullTimeEmployees IS NOT NULL THEN '✅'
    ELSE '❌'
  END as employees,
  CASE 
    WHEN address IS NOT NULL THEN '✅'
    ELSE '❌'
  END as address
FROM companies
WHERE assetType IN ('STOCK', 'ETF', 'FII', 'BDR')
ORDER BY ticker
LIMIT 20;
```

## 📚 Arquivos Relacionados

| Arquivo | Propósito | Status |
|---------|-----------|--------|
| `scripts/explore-yahoo-finance2.ts` | Script exploratório | ✅ Completo |
| `src/lib/yahoo-finance-complement-service.ts` | Serviço de complementação | ✅ Completo |
| `src/lib/asset-registration-service.ts` | Registro de ativos | ✅ Atualizado |
| `src/lib/dividend-service.ts` | Serviço de dividendos | ⚠️ Substituído |
| `.exploration-results/*.json` | Resultados da exploração | ✅ Gerados |

## ⚠️ Notas Importantes

### Sector e Industry

Por padrão, **preservamos** sector e industry das outras fontes:
- ✅ Ward API tem dados mais precisos para Brasil
- ✅ Fundamentus tem setores específicos da B3
- ⚠️ Yahoo Finance pode ter setores genéricos

**Quando usar Yahoo para sector/industry:**
- Empresa nova sem dados de outras fontes
- BDRs (dados internacionais mais precisos)
- Ativos que não estão na Ward/Fundamentus

### Financial Statements Limitados

⚠️ **Desde Nov 2024**, Yahoo Finance reduziu dados de financial statements:
- Balance Sheet History: Limitado
- Income Statement History: Limitado  
- Cashflow Statement History: Limitado

**Alternativa recomendada**: Ward API + Fundamentus para dados financeiros históricos

### Rate Limiting

Yahoo Finance tem rate limiting não documentado:
- ✅ Implementado delay de 500ms entre ativos
- ✅ Parallel fetch de múltiplos módulos do mesmo ativo
- ✅ Error handling e retry logic

## 🎉 Conclusão

Integração completa do Yahoo Finance2 como fonte complementar:

✅ **Complementação Inteligente**: Preenche apenas campos ausentes  
✅ **Dividendos Automáticos**: Histórico completo de 10 anos  
✅ **Dados Específicos**: ETF e FII data atualizados  
✅ **Performance Otimizada**: Parallel fetch + batch processing  
✅ **Preservação de Dados**: Sector/industry das fontes prioritárias mantidos  
✅ **Correção de Bug**: FIIs agora têm dividendos salvos corretamente

---

**Data de Criação**: 20 de Outubro de 2025  
**Versão**: 2.0 (Integração Completa)  
**Status**: ✅ Implementado e Testado

