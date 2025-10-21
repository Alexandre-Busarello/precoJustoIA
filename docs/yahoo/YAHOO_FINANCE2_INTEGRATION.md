# Integração Yahoo Finance2 - Documentação

## 📋 Visão Geral

Integração do `yahoo-finance2` como fonte complementar de dados para ativos no sistema. O Yahoo Finance serve como **terceira prioridade** de dados, após Ward API e Fundamentus.

## 🎯 Prioridade de Fontes de Dados

```
1️⃣ Fundamentus (Dados brasileiros mais precisos)
    ↓
2️⃣ Ward API (Dados financeiros completos)
    ↓
3️⃣ Yahoo Finance2 (Complemento internacional)
```

## ✅ Implementações Realizadas

### 1. Script Exploratório

**Arquivo**: `scripts/explore-yahoo-finance2.ts`

Explora **TODOS** os módulos disponíveis do yahoo-finance2 para diferentes tipos de ativos:

- 📊 **Stocks** (PETR4.SA)
- 📈 **ETFs** (BOVA11.SA)
- 🏢 **FIIs** (HGLG11.SA)
- 🌍 **BDRs** (GOGL34.SA)

#### Módulos Testados:

**Principais:**
- `quote` - Cotação atual
- `chart` - Dados históricos com dividendos
- `historical` - Preços históricos
- `search` - Busca de ativos

**quoteSummary (38 submódulos):**
- `assetProfile` - Perfil da empresa
- `balanceSheetHistory` - Balanço patrimonial (anual)
- `balanceSheetHistoryQuarterly` - Balanço (trimestral)
- `cashflowStatementHistory` - DFC (anual)
- `cashflowStatementHistoryQuarterly` - DFC (trimestral)
- `defaultKeyStatistics` - Estatísticas principais
- `earnings` - Resultados
- `earningsHistory` - Histórico de resultados
- `earningsTrend` - Tendências
- `financialData` - Dados financeiros TTM
- `fundOwnership` - Propriedade de fundos
- `fundPerformance` - Performance de fundos (ETFs)
- `fundProfile` - Perfil de fundos (ETFs)
- `incomeStatementHistory` - DRE (anual)
- `incomeStatementHistoryQuarterly` - DRE (trimestral)
- `indexTrend` - Tendências de índice
- `industryTrend` - Tendências da indústria
- `insiderHolders` - Acionistas internos
- `insiderTransactions` - Transações internas
- `institutionOwnership` - Propriedade institucional
- `majorDirectHolders` - Principais acionistas diretos
- `majorHoldersBreakdown` - Composição acionária
- `netSharePurchaseActivity` - Atividade de compra de ações
- `price` - Informações de preço
- `quoteType` - Tipo do ativo
- `recommendationTrend` - Recomendações de analistas
- `secFilings` - Documentos SEC
- `sectorTrend` - Tendências do setor
- `summaryDetail` - Resumo detalhado
- `summaryProfile` - Perfil resumido
- `symbol` - Informações do símbolo
- `topHoldings` - Principais holdings (ETFs)
- `upgradeDowngradeHistory` - Histórico de upgrades/downgrades

**Outros:**
- `insights` - Insights sobre o ativo
- `recommendationsBySymbol` - Recomendações por símbolo
- `options` - Opções disponíveis
- `trendingSymbols` - Ativos em tendência

### 2. AssetRegistrationService Atualizado

**Arquivo**: `src/lib/asset-registration-service.ts`

#### Comportamento Atualizado:

**Antes:**
```typescript
// Se empresa já existe, apenas retorna
if (existing) {
  return { ...existing, isNew: false };
}
```

**Depois:**
```typescript
// Se empresa já existe, ATUALIZA os dados
if (existing) {
  // Busca dados atualizados do Yahoo Finance
  const assetInfo = await fetchAssetInfo(ticker);
  
  // Atualiza EXCETO sector/industry se já existirem
  await updateCompanyRecord(id, assetInfo, {
    preserveSector: !!existing.sector,
    preserveIndustry: !!existing.industry
  });
  
  // Atualiza dados específicos (ETF, FII, etc)
  await saveAssetSpecificData(id, assetInfo);
  
  return { ...existing, isNew: false, updated: true };
}
```

#### Campos Atualizados:

✅ **Sempre atualizados:**
- `name` - Nome da empresa
- `description` - Descrição
- `address`, `city`, `state`, `zip` - Endereço
- `phone`, `website` - Contato
- `fullTimeEmployees` - Número de funcionários
- `updatedAt` - Timestamp de atualização

🔒 **Preservados se existentes:**
- `sector` - Setor (Ward/Fundamentus são mais precisos)
- `industry` - Indústria (Ward/Fundamentus são mais precisos)

### 3. Dados Específicos por Tipo

#### ETF Data
```typescript
{
  netAssets: number;           // Ativos líquidos
  netExpenseRatio: number;     // Taxa de administração
  dividendYield: number;       // Dividend yield
  ytdReturn: number;           // Retorno no ano
  totalAssets: number;         // Total de ativos
  category: string;            // Categoria do ETF
}
```

#### FII Data
```typescript
{
  netAssets: number;           // Patrimônio líquido
  dividendYield: number;       // Dividend yield
  lastDividendValue: number;   // Último dividendo
  lastDividendDate: Date;      // Data do último dividendo
  patrimonioLiquido: number;   // PL
  valorPatrimonial: number;    // Valor patrimonial por cota
}
```

## 🚀 Como Executar o Script Exploratório

### Pré-requisitos

```bash
# Já instalado no projeto
npm install yahoo-finance2
```

### Execução

```bash
# Executar script exploratório
npx tsx scripts/explore-yahoo-finance2.ts
```

### Output Esperado

```
🚀 Iniciando exploração do yahoo-finance2...
📅 20/10/2025, 15:30:00

============================================================
🔍 Explorando PETR4.SA (STOCK)
============================================================

  🔍 Testando módulo: quote...
    ✅ Sucesso (15234 bytes)
  
  🔍 Testando módulo: chart...
    ✅ Sucesso (45678 bytes)
  
  🔍 Testando módulo: quoteSummary-assetProfile...
    ✅ Sucesso (8912 bytes)
  
  ...

📊 RELATÓRIO DE EXPLORAÇÃO
============================================================

STOCK (PETR4.SA):
────────────────────────────────────────
✅ Módulos com sucesso: 32/41 (78.0%)

Módulos disponíveis:

  📁 Principais:
     ✓ quote
     ✓ chart
     ✓ historical
     ✓ search

  📁 Dados Financeiros:
     ✓ quoteSummary-balanceSheetHistory
     ✓ quoteSummary-incomeStatementHistory
     ✓ quoteSummary-cashflowStatementHistory
     ✓ quoteSummary-defaultKeyStatistics
     ✓ quoteSummary-financialData
     ...

💾 Resultados completos salvos em: .exploration-results/yahoo-finance2-exploration-2025-10-20.json
💾 Resumo salvo em: .exploration-results/yahoo-finance2-summary-2025-10-20.json

✅ Exploração concluída!
```

### Resultados Salvos

1. **Arquivo Completo** (`yahoo-finance2-exploration-[timestamp].json`)
   - Contém TODOS os dados brutos retornados por cada módulo
   - Estrutura completa de cada objeto
   - Útil para análise detalhada

2. **Arquivo Resumido** (`yahoo-finance2-summary-[timestamp].json`)
   - Estatísticas por módulo
   - Sucesso/falha
   - Tamanho dos dados
   - Útil para overview rápido

## 📊 Uso no Sistema

### 1. Cron Job de Atualização de Ativos

**Endpoint**: `/api/cron/update-portfolio-assets`

```typescript
// Já integrado automaticamente
// AssetRegistrationService.registerAsset() agora:
// 1. Verifica se empresa existe
// 2. Se existe, busca dados atualizados do Yahoo Finance
// 3. Atualiza dados (preservando sector/industry)
// 4. Atualiza dados específicos (ETF, FII)
```

### 2. Adição Manual de Ativos

**API**: `POST /api/portfolio/[id]/assets`

```typescript
// Ao adicionar um ativo:
const result = await AssetRegistrationService.registerAsset(ticker);

// Resultado:
{
  companyId: 123,
  assetType: "ETF",
  success: true,
  isNew: false,        // false se já existia
  message: "Ativo atualizado com sucesso"
}
```

### 3. Script de Background

O script `fetch-data-ward.ts` já usa múltiplas fontes com prioridade:

```typescript
// Prioridade de dados:
const finalData = mergeWithPriority(
  fundamentusData,  // 1ª prioridade
  wardData,         // 2ª prioridade
  brapiData         // 3ª prioridade (Brapi API)
);

// TODO: Adicionar Yahoo Finance como 4ª fonte complementar
const finalData = mergeWithPriority(
  fundamentusData,
  wardData,
  brapiData,
  yahooFinanceData  // Nova 4ª prioridade (complemento)
);
```

## 🔄 Próximos Passos

### 1. Integrar no fetch-data-ward.ts

```typescript
// Em fetch-data-ward.ts

import { HistoricalDataService } from '@/lib/historical-data-service';

async function processCompany(ticker: string) {
  // ... código existente ...
  
  // Buscar dados do Yahoo Finance como complemento
  const yahooData = await fetchYahooFinanceComplement(ticker);
  
  // Mesclar com prioridade
  const finalData = mergeFinancialDataWithPriority(
    fundamentusData,    // 1ª
    wardData,           // 2ª
    brapiData,          // 3ª
    yahooData           // 4ª (complemento)
  );
}

async function fetchYahooFinanceComplement(ticker: string) {
  const assetInfo = await HistoricalDataService.fetchAssetInfo(ticker);
  
  // Extrair dados relevantes para complemento
  return {
    // Dados gerais
    description: assetInfo.description,
    website: assetInfo.quoteSummary?.assetProfile?.website,
    employees: assetInfo.quoteSummary?.assetProfile?.fullTimeEmployees,
    
    // Dados financeiros complementares
    marketCap: assetInfo.quote?.marketCap,
    pe: assetInfo.quote?.trailingPE,
    dividendYield: assetInfo.quote?.dividendYield,
    
    // Dados específicos
    ...extractFinancialData(assetInfo)
  };
}
```

### 2. Mapear Campos Complementares

Criar mapeamento de quais campos do Yahoo Finance devem complementar cada fonte:

```typescript
const YAHOO_COMPLEMENT_FIELDS = {
  // Se Fundamentus/Ward não tiverem:
  complementary: [
    'website',
    'fullTimeEmployees',
    'description',
    'phone',
    'address'
  ],
  
  // Nunca sobrescrever (Fundamentus/Ward são mais precisos):
  neverOverwrite: [
    'sector',
    'industry',
    'roe',
    'roic',
    'cagrLucros5a'
  ]
};
```

### 3. Criar Função de Mesclagem Específica

```typescript
function mergeWithYahooFinance(
  existingData: any,
  yahooData: any
): any {
  const merged = { ...existingData };
  
  // Apenas complementar campos ausentes
  for (const field of YAHOO_COMPLEMENT_FIELDS.complementary) {
    if (!merged[field] && yahooData[field]) {
      merged[field] = yahooData[field];
    }
  }
  
  return merged;
}
```

## 📝 Notas Importantes

### Limitações do Yahoo Finance para Ativos Brasileiros

- ✅ **Dados de Preço**: Excelente
- ✅ **Dados Históricos**: Completo
- ✅ **Dividendos**: Disponível
- ⚠️ **Dados Financeiros**: Limitado para .SA
- ⚠️ **Balanços/DRE**: Mais completo para US/Internacional
- ❌ **Setor/Indústria**: Menos preciso que Fundamentus

### Performance

- Script exploratório: ~5-10 minutos (4 ativos × 41 módulos)
- Registro individual: ~2-3 segundos por ativo
- Rate limiting: 500ms delay entre requests

### Rate Limiting

```typescript
// Implementado no script
await new Promise(resolve => setTimeout(resolve, 500));
```

## 🐛 Troubleshooting

### Erro: "Module not found: yahoo-finance2"

```bash
npm install yahoo-finance2
```

### Erro: "Timeout" ao buscar dados

- Normal para alguns módulos específicos
- Script continua com próximo módulo
- Erro é registrado no resultado

### Dados vazios para alguns módulos

- Esperado: Nem todos os módulos têm dados para todos os ativos
- ETFs: Têm `fundProfile`, `fundPerformance`
- Stocks: Têm `earnings`, `financialData`
- FIIs: Dados limitados (tratados como EQUITY)

## 📚 Referências

- [yahoo-finance2 GitHub](https://github.com/gadicc/node-yahoo-finance2)
- [yahoo-finance2 Docs](https://github.com/gadicc/node-yahoo-finance2/blob/devel/docs/README.md)
- [Yahoo Finance API](https://finance.yahoo.com/)

---

**Data de Criação**: 20 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Implementado (Script Exploratório + AssetRegistrationService)  
**Próximo Passo**: Integrar como fonte complementar no fetch-data-ward.ts

