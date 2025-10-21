# Yahoo Finance - Módulos Financeiros Históricos

## 🔍 Avaliação Completa

Avaliação dos módulos financeiros históricos disponíveis no `yahoo-finance2` para complementação de dados.

## 📊 Módulos Avaliados

### 1. `balanceSheetHistory` (Balanço Patrimonial - Anual)

**Status**: ⚠️ **DADOS MUITO LIMITADOS** (desde Nov 2024)

**Exemplo de Dados Disponíveis (PETR4.SA)**:
```json
{
  "maxAge": 1,
  "endDate": "2024-12-31"
  // ❌ Nenhum campo de dados efetivo disponível
}
```

**Conclusão**: Não é útil para complementação. Usar **Ward API** para balanços históricos.

---

### 2. `balanceSheetHistoryQuarterly` (Balanço Patrimonial - Trimestral)

**Status**: ⚠️ **DADOS MUITO LIMITADOS** (desde Nov 2024)

**Conclusão**: Mesma situação do anual. Não é útil.

---

### 3. `incomeStatementHistory` (DRE - Anual)

**Status**: ⚠️ **DADOS PARCIAIS**

**Exemplo de Dados Disponíveis (PETR4.SA, 2024)**:
```json
{
  "endDate": "2024-12-31",
  "totalRevenue": 527918258400,    // ✅ Disponível
  "netIncome": 43473447200,        // ✅ Disponível
  "costOfRevenue": 0,              // ❌ Zero
  "grossProfit": 0,                // ❌ Zero
  "ebit": 0,                       // ❌ Zero
  "operatingIncome": null,         // ❌ Null
  "interestExpense": null,         // ❌ Null
  "incomeTaxExpense": 0            // ❌ Zero
}
```

**Campos Úteis**: Apenas `totalRevenue` e `netIncome`

**Conclusão**: 
- ✅ Pode complementar `receitaTotal` e `lucroLiquido` em `FinancialData`
- ❌ Não substitui Ward API para DRE completa

---

### 4. `incomeStatementHistoryQuarterly` (DRE - Trimestral)

**Status**: ⚠️ **DADOS PARCIAIS**

**Conclusão**: Mesma situação do anual. Apenas receita e lucro líquido.

---

### 5. `cashflowStatementHistory` (Fluxo de Caixa - Anual)

**Status**: ❌ **DADOS INSUFICIENTES**

**Exemplo de Dados Disponíveis (PETR4.SA, 2024)**:
```json
{
  "endDate": "2024-12-31",
  "netIncome": 43473447200  // ✅ Disponível (repetido da DRE)
  // ❌ Nenhum campo de fluxo de caixa específico
}
```

**Conclusão**: Não adiciona informações novas além da DRE.

---

### 6. `cashflowStatementHistoryQuarterly` (Fluxo de Caixa - Trimestral)

**Status**: ❌ **DADOS INSUFICIENTES**

**Conclusão**: Mesma situação do anual.

---

### 7. `defaultKeyStatistics` (Estatísticas Chave)

**Status**: ✅ **ÚTIL** (já implementado)

**Exemplo de Dados Disponíveis**:
```json
{
  "enterpriseValue": 398065041408,     // ✅ Útil
  "forwardPE": 3.7039802,              // ✅ Útil
  "profitMargins": 0.08234,            // ✅ Útil
  "bookValue": 5.676,                  // ✅ Útil
  "priceToBook": 5.2466526,            // ✅ Útil
  "sharesOutstanding": 5446501379,     // ✅ Útil
  "heldPercentInstitutions": 0.23,     // ✅ Útil
  "heldPercentInsiders": 0.01,         // ✅ Útil
  "shortRatio": 1.5,                   // ✅ Útil
  "pegRatio": 0.5,                     // ✅ Útil
  "lastDividendValue": 3.69,           // ✅ Útil
  "lastDividendDate": "2025-08-15",    // ✅ Útil
  "enterpriseToRevenue": 0.75,         // ✅ Útil
  "enterpriseToEbitda": 3.2            // ✅ Útil
}
```

**Conclusão**: 
- ✅ **JÁ IMPLEMENTADO** em `YahooFinanceComplementService`
- ✅ Complementa `enterpriseValue`, `vpa` e outros campos

---

## 📋 Resumo da Avaliação

| Módulo | Status | Utilidade | Ação |
|--------|--------|-----------|------|
| `balanceSheetHistory` | ❌ Vazio | Nenhuma | Não implementar |
| `balanceSheetHistoryQuarterly` | ❌ Vazio | Nenhuma | Não implementar |
| `incomeStatementHistory` | ⚠️ Parcial | Baixa | Considerar apenas para revenue/netIncome |
| `incomeStatementHistoryQuarterly` | ⚠️ Parcial | Baixa | Não prioritário |
| `cashflowStatementHistory` | ❌ Insuficiente | Nenhuma | Não implementar |
| `cashflowStatementHistoryQuarterly` | ❌ Insuficiente | Nenhuma | Não implementar |
| `defaultKeyStatistics` | ✅ Bom | Alta | ✅ **Já implementado** |

## 🎯 Recomendações

### 1. **Não implementar** módulos de balanço e fluxo de caixa

**Razão**: 
- Dados praticamente vazios desde Nov 2024
- Ward API tem dados completos e históricos
- Fundamentus tem dados mais precisos para empresas brasileiras

### 2. **Considerar** implementar `incomeStatementHistory` (opcional)

**Cenário de uso**: Complementar `receitaTotal` e `lucroLiquido` quando ausentes de Ward/Brapi.

**Implementação sugerida** (se necessário):
```typescript
// Em YahooFinanceComplementService.complementFinancialData()

// Buscar income statement se necessário
if (!existingFinancialData.receitaTotal || !existingFinancialData.lucroLiquido) {
  const yahooFinance = await getYahooFinance();
  const incomeStatement = await yahooFinance.quoteSummary(ticker, {
    modules: ['incomeStatementHistory']
  });
  
  const latestStatement = incomeStatement?.incomeStatementHistory?.incomeStatementHistory?.[0];
  
  if (latestStatement) {
    if (!existingFinancialData.receitaTotal && latestStatement.totalRevenue) {
      updateData.receitaTotal = latestStatement.totalRevenue;
      fieldsComplemented++;
    }
    
    if (!existingFinancialData.lucroLiquido && latestStatement.netIncome) {
      updateData.lucroLiquido = latestStatement.netIncome;
      fieldsComplemented++;
    }
  }
}
```

**⚠️ Mas não é prioritário**: Ward e Brapi já fornecem esses dados.

### 3. **Manter** uso de `defaultKeyStatistics`

**Status**: ✅ **Já implementado e funcionando**

Os dados deste módulo são úteis e já estão sendo extraídos em `fetchCompleteData()`.

## 📊 Comparação de Fontes

### Receita Total (Revenue)

| Fonte | Disponibilidade | Qualidade | Histórico |
|-------|----------------|-----------|-----------|
| **Ward API** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |
| **Brapi API** | ✅ Boa | ⭐⭐⭐⭐ | TTM |
| **Yahoo Finance** | ⚠️ Limitada | ⭐⭐⭐ | 1-2 anos (limitado) |
| **Fundamentus** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |

### Lucro Líquido (Net Income)

| Fonte | Disponibilidade | Qualidade | Histórico |
|-------|----------------|-----------|-----------|
| **Ward API** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |
| **Brapi API** | ✅ Boa | ⭐⭐⭐⭐ | TTM |
| **Yahoo Finance** | ⚠️ Limitada | ⭐⭐⭐ | 1-2 anos (limitado) |
| **Fundamentus** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |

### Balanço Patrimonial (Balance Sheet)

| Fonte | Disponibilidade | Qualidade | Histórico |
|-------|----------------|-----------|-----------|
| **Ward API** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |
| **Yahoo Finance** | ❌ Indisponível | ⭐ | N/A |
| **Fundamentus** | ✅ Boa | ⭐⭐⭐⭐ | Atual |

### Fluxo de Caixa (Cash Flow)

| Fonte | Disponibilidade | Qualidade | Histórico |
|-------|----------------|-----------|-----------|
| **Ward API** | ✅ Excelente | ⭐⭐⭐⭐⭐ | 5+ anos |
| **Yahoo Finance** | ❌ Indisponível | ⭐ | N/A |
| **Fundamentus** | ✅ Boa | ⭐⭐⭐⭐ | Atual |

## 🔄 Estado Atual da Implementação

### ✅ O Que JÁ Está Implementado

1. **Quote Data** (50+ campos)
   - Market cap, PE ratios, dividend yield, shares outstanding, etc.
   
2. **Summary Detail** (15+ campos)
   - Beta, 52-week highs/lows, payout ratio, etc.
   
3. **Financial Data** (30+ campos de `financialData` module)
   - ROE, ROA, margins, cashflow, growth rates, etc.
   
4. **Default Key Statistics** (25+ campos)
   - Enterprise value, book value, PE ratios, etc.
   
5. **Asset Profile** (10+ campos)
   - Address, website, employees, sector, industry, etc.
   
6. **Dividends** (histórico completo de 10 anos)
   - Ex-dates, amounts, via `chart()` module

### ❌ O Que NÃO Será Implementado

1. **Balance Sheet History** - Dados vazios
2. **Income Statement History** - Dados muito limitados
3. **Cashflow Statement History** - Dados insuficientes

**Razão**: Ward API e Fundamentus são superiores para demonstrações financeiras históricas.

## 🎯 Conclusão Final

**Decisão**: **NÃO implementar** os módulos financeiros históricos solicitados.

**Justificativa**:
1. ❌ Dados praticamente vazios (balance sheet)
2. ⚠️ Dados muito limitados (income statement: apenas 2 campos)
3. ❌ Dados insuficientes (cashflow)
4. ✅ Ward API já fornece dados completos e históricos
5. ✅ Fundamentus já fornece dados precisos para empresas brasileiras
6. ⚠️ Adicionar esses módulos aumentaria complexidade sem benefício real

**Alternativa**: Manter Yahoo Finance como fonte complementar para:
- ✅ Market data (quote, summary)
- ✅ Financial ratios (ROE, ROA, margins)
- ✅ Key statistics
- ✅ Dividendos históricos
- ✅ Asset profile

**Prioridade Final Confirmada**:
```
1️⃣ Fundamentus (demonstrações financeiras BR)
    ↓
2️⃣ Ward API (dados financeiros históricos completos)
    ↓
3️⃣ Brapi API (dados TTM e preços)
    ↓
4️⃣ Yahoo Finance (market data + dividendos + complementos)
```

## 📝 Exemplo de Uso Atual

```typescript
// ✅ O que o Yahoo Finance complementa atualmente:

const complemented = await YahooFinanceComplementService.complementCompanyData(
  companyId,
  'PETR4',
  true,  // preservar sector
  true   // preservar industry
);

// Campos complementados:
// - Company: description, website, address, phone, employees
// - FinancialData: ROE, ROA, margins, growth, cashflow (se vazios)
// - DividendHistory: todos os dividendos históricos (upsert)
// - ETF/FII Data: dados específicos (sempre)

// ❌ O que NÃO complementa (e não deveria):
// - Balance Sheet completo → Usar Ward API
// - Income Statement completo → Usar Ward API
// - Cashflow Statement completo → Usar Ward API
```

---

**Data de Criação**: 20 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Avaliação Completa

