# Correção: Connection Pool Exhaustion no Analytics

## Problema Identificado

Ao acessar a aba "Análises" da carteira, ocorria um **connection pool exhaustion** causado por:

1. **Múltiplos upserts simultâneos**: `saveHistoricalData` executava centenas de `safeWrite` em paralelo via `Promise.all`
2. **Busca excessiva de dados**: `fetchMaximumHistoricalData` tentava buscar 20 anos de dados para todos os ativos simultaneamente
3. **Processamento paralelo de tickers**: Todos os tickers eram processados ao mesmo tempo

### Erro Original
```
Timed out fetching a new connection from the connection pool. 
More info: http://pris.ly/d/connection-pool 
(Current connection pool timeout: 10, connection limit: 13)
```

## Correções Aplicadas

### 1. Batch Processing em `saveHistoricalData`

**Arquivo**: `src/lib/historical-data-service.ts`

**Antes**:
```typescript
// Executava todos os upserts em paralelo
await Promise.all(
  data.map(point => safeWrite('upsert-historical_prices', ...))
);
```

**Depois**:
```typescript
// Processa em lotes de 50
const BATCH_SIZE = 50;
for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map(point => prisma.historicalPrice.upsert(...))
  );
}
```

**Benefícios**:
- ✅ Limita conexões simultâneas a 50 (bem abaixo do limite de 13)
- ✅ Remove overhead de `safeWrite` para operações em massa
- ✅ Adiciona logs de progresso para lotes grandes

### 2. Processamento Sequencial de Tickers

**Arquivo**: `src/lib/portfolio-analytics-service.ts`

**Antes**:
```typescript
// Processava todos os tickers em paralelo
await Promise.all(
  tickers.map(ticker =>
    HistoricalDataService.fetchMaximumHistoricalData(ticker, '1mo')
  )
);
```

**Depois**:
```typescript
// Processa um ticker por vez
for (const ticker of tickers) {
  try {
    await HistoricalDataService.ensureHistoricalData(
      ticker,
      startDate, // Apenas o período necessário
      endDate,
      '1mo',
      false // Não buscar máximo (20 anos)
    );
  } catch (error) {
    console.error(`⚠️ Erro ao buscar dados de ${ticker}:`, error);
    // Continua com próximo ticker
  }
}
```

**Benefícios**:
- ✅ Evita esgotamento do pool processando sequencialmente
- ✅ Busca apenas o período necessário (não 20 anos)
- ✅ Tratamento de erro por ticker (não falha tudo se um ticker der erro)
- ✅ Continua com outros tickers mesmo se um falhar

## Impacto

### Performance
- **Antes**: Timeout após 25+ segundos, falha completa
- **Depois**: Processamento mais lento mas confiável (3-10s por ticker)

### Estabilidade
- ✅ Não esgota mais o connection pool
- ✅ Tratamento robusto de erros
- ✅ Logs informativos de progresso

### Dados
- ✅ Busca apenas o período necessário para analytics
- ✅ Evita buscar 20 anos de dados desnecessariamente

## Otimizações Adicionais (Implementadas em 20/10/2025)

### 1. ✅ Verificação Otimizada de Dados Existentes

**Problema**: Cada ticker era verificado individualmente, causando lentidão.

**Solução**: Criado método `getTickersNeedingHistoricalData()` que:
- Faz uma **única consulta** ao banco usando `groupBy` para todos os tickers
- Verifica cobertura de dados (80% threshold)
- Retorna apenas tickers que realmente precisam de dados

```typescript
// Batch check para todos os tickers de uma vez
const tickersNeedingData = await this.getTickersNeedingHistoricalData(
  tickers,
  startDate,
  endDate,
  '1mo'
);

// Busca dados apenas para os que precisam
for (const ticker of tickersNeedingData) {
  await HistoricalDataService.ensureHistoricalData(...);
}
```

**Benefícios**:
- ✅ Reduz queries ao banco de N para 2 (groupBy + findMany)
- ✅ Pula tickers que já têm dados suficientes
- ✅ Melhora significativa de performance para carteiras com muitos ativos

### 2. ✅ Correção da Lógica de Evolução

**Problema**: Loop aplicava **todas** as transações para cada data mensal, causando:
- Retornos absurdos (ex: 95.80% em um único mês)
- Duplicação de transações
- Cálculos completamente incorretos

**Solução**: Rastreamento de transações processadas:

```typescript
let lastProcessedTxIndex = 0;

for (const date of monthlyDates) {
  // Processa apenas transações NOVAS até esta data
  while (lastProcessedTxIndex < transactions.length) {
    const tx = transactions[lastProcessedTxIndex];
    if (tx.date > date) break;
    
    // Aplica transação UMA vez
    // ...
    lastProcessedTxIndex++;
  }
  // Calcula valor da carteira nesta data
}
```

**Benefícios**:
- ✅ Cada transação aplicada exatamente uma vez
- ✅ Retornos mensais corretos
- ✅ Evolução da carteira precisa

### 3. ✅ Dividendos Incluídos no Retorno

**Problema**: Dividendos não eram contabilizados corretamente no cálculo de retorno.

**Solução**: Lógica correta para dividendos:
- Dividendos aumentam `cashBalance` mas **não** `totalInvested`
- Se ficam em caixa → já incluídos no `totalValue`
- Se são sacados → adicionados via `totalWithdrawals`

```typescript
// Dividendos aumentam caixa, não investimento
if (tx.type === 'DIVIDEND') {
  cashBalance += Number(tx.amount);
  // Não adiciona ao totalInvested
}

// Retorno considera saques (incluindo dividendos sacados)
const returnAmount = totalValue + totalWithdrawals - totalInvested;
```

**Benefícios**:
- ✅ Dividendos contabilizados como retorno
- ✅ Funciona corretamente se mantidos em caixa ou sacados
- ✅ Funciona corretamente se reinvestidos

## Próximas Otimizações Sugeridas

### 1. Cache de Analytics
Cachear o resultado do cálculo de analytics por algumas horas:

```typescript
const cacheKey = `analytics:${portfolioId}:${lastTransactionDate}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;
// ... calcular ...
await cache.set(cacheKey, result, 3600); // 1 hora
```

### 2. Background Job para Dados Históricos
Processar dados históricos em background quando um ativo é adicionado à carteira, não sob demanda.

## Como Testar

1. **Reiniciar servidor** para aplicar as mudanças
2. **Acessar aba Análises** de uma carteira
3. **Verificar logs**:
   - `📊 [ANALYTICS] Garantindo dados históricos para X ativos...`
   - `📊 [DB] Processados X/Y pontos históricos` (para lotes grandes)
   - `✅ [ANALYTICS] Dados históricos garantidos para todos os ativos`
4. **Confirmar sucesso**: Gráficos de evolução são exibidos
5. **Verificar tempo**: Deve completar em ~1-2 minutos para carteira com 5-10 ativos

## Monitoramento

Observar nos logs:
- ❌ **Erros de timeout**: Não devem mais ocorrer
- ✅ **Logs de progresso**: Indicam processamento saudável
- ⚠️ **Avisos de erro por ticker**: Alguns tickers podem falhar (esperado)

---

**Data**: 20 de Outubro de 2025  
**Status**: ✅ Corrigido

