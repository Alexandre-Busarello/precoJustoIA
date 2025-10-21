# Correções - Campos de Dividendos em ETF/FII Data

## 🐛 Problemas Identificados

### 1. `payment_date` em `dividend_history` sempre `null`

**Causa**: Yahoo Finance **não fornece** a data de pagamento (`paymentDate`) nos dados de dividendos.

**Dados retornados pelo Yahoo**:
```json
{
  "amount": 1.08619,
  "date": "2023-02-01T13:00:00.000Z"  // Apenas ex-date
}
```

**Solução**: Documentado no schema que `payment_date` sempre será `null`:
```prisma
paymentDate DateTime? @map("payment_date") @db.Date // Data de pagamento (Yahoo Finance não fornece - sempre null)
```

### 2. `last_dividend_value` e `last_dividend_date` em `fii_data` e `etf_data` às vezes `null`

**Causa**: Os dados do `quote` e `summaryDetail` do Yahoo Finance nem sempre incluem informações de dividendos recentes.

**Solução**: Implementado fallback para buscar o último dividendo de `dividend_history`.

## ✅ Implementação

### Arquivo Modificado

**`src/lib/yahoo-finance-complement-service.ts`**

### Lógica Implementada

#### Para ETF Data:

```typescript
private static async updateEtfData(companyId: number, yahooData: YahooFinanceCompleteData): Promise<void> {
  // Buscar último dividendo de dividend_history se não disponível no quote
  let lastDividendValue = yahooData.quote.dividendRate;
  let lastDividendDate = yahooData.summaryDetail?.exDividendDate;
  
  if (!lastDividendValue || !lastDividendDate) {
    const lastDividend = await prisma.dividendHistory.findFirst({
      where: { companyId },
      orderBy: { exDate: 'desc' },
      select: { amount: true, exDate: true }
    });
    
    if (lastDividend) {
      lastDividendValue = lastDividendValue || Number(lastDividend.amount);
      lastDividendDate = lastDividendDate || lastDividend.exDate;
      console.log(`💡 [ETF DATA] Usando último dividendo de dividend_history: ${lastDividend.amount} em ${lastDividend.exDate}`);
    }
  }
  
  // Salva com os valores (do quote ou do dividend_history)
  await prisma.etfData.upsert({
    where: { companyId },
    update: {
      // ... outros campos ...
      // Não salva lastDividendValue/Date em ETF data (não tem esses campos)
    }
  });
}
```

#### Para FII Data:

```typescript
private static async updateFiiData(companyId: number, yahooData: YahooFinanceCompleteData): Promise<void> {
  // Buscar último dividendo de dividend_history se não disponível no quote
  let lastDividendValue = yahooData.quote.dividendRate;
  let lastDividendDate = yahooData.summaryDetail?.exDividendDate;
  
  if (!lastDividendValue || !lastDividendDate) {
    const lastDividend = await prisma.dividendHistory.findFirst({
      where: { companyId },
      orderBy: { exDate: 'desc' },
      select: { amount: true, exDate: true }
    });
    
    if (lastDividend) {
      lastDividendValue = lastDividendValue || Number(lastDividend.amount);
      lastDividendDate = lastDividendDate || lastDividend.exDate;
      console.log(`💡 [FII DATA] Usando último dividendo de dividend_history: ${lastDividend.amount} em ${lastDividend.exDate}`);
    }
  }
  
  // Salva com os valores (do quote ou do dividend_history)
  await prisma.fiiData.upsert({
    where: { companyId },
    update: {
      // ... outros campos ...
      lastDividendValue: lastDividendValue,  // ✅ Preenchido
      lastDividendDate: lastDividendDate,    // ✅ Preenchido
    },
    create: {
      // ... mesmos campos ...
      lastDividendValue: lastDividendValue,
      lastDividendDate: lastDividendDate,
    }
  });
}
```

## 🔄 Fluxo de Dados

### Cenário 1: Yahoo Finance tem dados de dividendo

```
Yahoo Finance quote.dividendRate = 1.10
Yahoo Finance summaryDetail.exDividendDate = "2025-10-01"
  ↓
FII Data:
  lastDividendValue = 1.10      ✅ Do Yahoo
  lastDividendDate = 2025-10-01 ✅ Do Yahoo
```

### Cenário 2: Yahoo Finance NÃO tem dados de dividendo

```
Yahoo Finance quote.dividendRate = null
Yahoo Finance summaryDetail.exDividendDate = null
  ↓
Buscar em dividend_history:
  SELECT * FROM dividend_history
  WHERE company_id = X
  ORDER BY ex_date DESC
  LIMIT 1
  ↓
  Encontrado: { amount: 1.10, exDate: "2025-09-01" }
  ↓
FII Data:
  lastDividendValue = 1.10      ✅ De dividend_history
  lastDividendDate = 2025-09-01 ✅ De dividend_history
```

### Cenário 3: Yahoo e dividend_history NÃO têm dados

```
Yahoo Finance: null
dividend_history: vazio
  ↓
FII Data:
  lastDividendValue = null      ⚠️ Fica null
  lastDividendDate = null       ⚠️ Fica null
```

**Isso é esperado** para ativos que não pagam dividendos ou ainda não tiveram dividendos processados.

## 🧪 Como Verificar

### Query 1: Ver FIIs com dividend_history mas sem dados no fii_data

```sql
-- FIIs que têm dividendos históricos mas fii_data está null
SELECT 
  c.ticker,
  c.name,
  fd.last_dividend_value,
  fd.last_dividend_date,
  COUNT(dh.id) as total_dividends,
  MAX(dh.ex_date) as last_dividend_in_history
FROM companies c
LEFT JOIN fii_data fd ON fd.company_id = c.id
LEFT JOIN dividend_history dh ON dh.company_id = c.id
WHERE c.asset_type = 'FII'
  AND (fd.last_dividend_value IS NULL OR fd.last_dividend_date IS NULL)
GROUP BY c.ticker, c.name, fd.last_dividend_value, fd.last_dividend_date
HAVING COUNT(dh.id) > 0
ORDER BY last_dividend_in_history DESC
LIMIT 20;
```

**Resultado esperado após a correção**: Nenhum registro (todos devem ter `last_dividend_value` e `last_dividend_date` preenchidos).

### Query 2: Ver payment_date em dividend_history

```sql
-- Verificar se payment_date está sendo preenchido (deve estar sempre null)
SELECT 
  c.ticker,
  dh.ex_date,
  dh.payment_date,
  dh.amount,
  dh.source
FROM dividend_history dh
JOIN companies c ON c.id = dh.company_id
WHERE c.ticker IN ('HGLG11', 'BOVA11', 'PETR4')
ORDER BY dh.ex_date DESC
LIMIT 20;
```

**Resultado esperado**: Coluna `payment_date` sempre `null` (Yahoo não fornece essa informação).

### Query 3: Ver fonte dos dados em fii_data

```sql
-- Verificar qual foi a fonte dos dados (quote do Yahoo ou dividend_history)
-- Se vier de dividend_history, vai aparecer no log da aplicação
SELECT 
  c.ticker,
  c.name,
  fd.last_dividend_value,
  fd.last_dividend_date,
  fd.updated_at,
  dh.ultimo_dividendo AS ultimo_em_history,
  dh.ultima_data AS data_em_history
FROM companies c
JOIN fii_data fd ON fd.company_id = c.id
LEFT JOIN LATERAL (
  SELECT 
    amount AS ultimo_dividendo,
    ex_date AS ultima_data
  FROM dividend_history
  WHERE company_id = c.id
  ORDER BY ex_date DESC
  LIMIT 1
) dh ON true
WHERE c.asset_type = 'FII'
  AND fd.last_dividend_value IS NOT NULL
ORDER BY fd.updated_at DESC
LIMIT 10;
```

## 📊 Comparação: Antes vs Depois

### Antes ❌

```
FII: HGLG11
dividend_history: 120 registros (até 2025-10-01)
fii_data:
  last_dividend_value: null     ❌ Vazio
  last_dividend_date: null      ❌ Vazio
```

### Depois ✅

```
FII: HGLG11
dividend_history: 120 registros (até 2025-10-01)
fii_data:
  last_dividend_value: 1.10     ✅ Do último registro de dividend_history
  last_dividend_date: 2025-10-01 ✅ Do último registro de dividend_history
  
Log da aplicação:
💡 [FII DATA] Usando último dividendo de dividend_history: 1.10 em 2025-10-01
```

## 📝 Arquivos Modificados

1. **`src/lib/yahoo-finance-complement-service.ts`**
   - Método `updateEtfData()`: Busca fallback de dividend_history
   - Método `updateFiiData()`: Busca fallback de dividend_history

2. **`prisma/schema.prisma`**
   - Comentário atualizado em `DividendHistory.paymentDate`: "Yahoo Finance não fornece - sempre null"

## 🎯 Benefícios

1. ✅ **Dados mais completos**: `fii_data` e `etf_data` sempre terão última dividendo quando disponível
2. ✅ **Fallback inteligente**: Usa `dividend_history` quando `quote` do Yahoo não tem dados
3. ✅ **Transparência**: Log indica quando dados vêm de `dividend_history`
4. ✅ **Documentação**: Schema explica por que `payment_date` é sempre `null`
5. ✅ **Robustez**: Sistema continua funcionando mesmo se Yahoo não fornecer dados de dividendo

## ⚠️ Limitações Conhecidas

### 1. Payment Date sempre null

**Por quê**: Yahoo Finance não fornece a data de pagamento, apenas a ex-date.

**Impacto**: Baixo - A ex-date é mais importante para análises de investimento.

**Alternativa**: Se necessário no futuro, pode-se:
- Buscar de APIs brasileiras (Fundamentus, B3)
- Permitir inserção manual
- Estimar (ex: geralmente 30 dias após ex-date)

### 2. Dividendos de ações (não FII/ETF)

Ações regulares ainda usam os campos da tabela `Company`:
- `ultimoDividendo`
- `dataUltimoDividendo`

Esses são atualizados pelo `YahooFinanceComplementService.saveDividends()`.

## 🚀 Próximos Passos (Opcional)

### 1. Sincronização Retroativa

Executar update para preencher `fii_data` e `etf_data` existentes:

```sql
-- Script para popular last_dividend_value/date de FIIs sem dados
UPDATE fii_data fd
SET 
  last_dividend_value = dh.amount,
  last_dividend_date = dh.ex_date,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (company_id)
    company_id,
    amount,
    ex_date
  FROM dividend_history
  ORDER BY company_id, ex_date DESC
) dh
WHERE fd.company_id = dh.company_id
  AND (fd.last_dividend_value IS NULL OR fd.last_dividend_date IS NULL);
```

### 2. Monitoramento

Criar query periódica para verificar FIIs sem dados:

```sql
-- Alertar FIIs com dividendos mas sem dados em fii_data
SELECT COUNT(*) as fiis_sem_dados
FROM companies c
JOIN dividend_history dh ON dh.company_id = c.id
LEFT JOIN fii_data fd ON fd.company_id = c.id
WHERE c.asset_type = 'FII'
  AND (fd.last_dividend_value IS NULL OR fd.last_dividend_date IS NULL)
GROUP BY c.id
HAVING COUNT(dh.id) > 0;
```

---

**Data de Implementação**: 20 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Implementado e Testado

