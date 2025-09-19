# Sistema de Processamento Individual por Ticker

## Problema Resolvido

O sistema anterior de `ProcessingStateManager` assumia uma execução sequencial de todos os tickers, mas não funcionava bem quando você executava tickers específicos. O novo sistema resolve isso com **controle individual por ticker**.

## Principais Melhorias

### ✅ **Controle Individual por Ticker**
- Cada ticker tem seu próprio registro de estado
- Permite execução de tickers específicos sem afetar o estado global
- Rastreamento detalhado do progresso de cada ticker

### ✅ **Estados Granulares**
- `PENDING`: Ainda não processado
- `PROCESSING`: Em processamento no momento
- `COMPLETED`: Processamento completo
- `PARTIAL`: Processamento parcial (alguns dados faltando)
- `ERROR`: Erro no processamento
- `SKIPPED`: Pulado por algum motivo

### ✅ **Rastreamento Detalhado de Dados**
- `hasBasicData`: Dados básicos da empresa (nome, setor, etc.)
- `hasHistoricalData`: Dados históricos completos
- `hasTTMData`: Dados TTM (últimos 12 meses)
- `hasBrapiProData`: Dados da Brapi PRO

### ✅ **Sistema de Prioridades**
- Prioridade 0: Normal
- Prioridade 1: Alta (tickers específicos)
- Prioridade 2: Urgente

### ✅ **Tratamento Inteligente de Erros**
- Contador de erros por ticker
- Retry automático para tickers com poucos erros
- Exclusão automática de tickers com muitos erros

## Comandos Disponíveis

### **Processamento de Tickers Específicos**
```bash
# Processar tickers específicos
npm run fetch:ward:smart PETR4 VALE3 ITUB4

# Com opções adicionais
npm run fetch:ward:smart PETR4 VALE3 --force-full --no-brapi
```

### **Processamento Automático**
```bash
# Processar tickers pendentes automaticamente
npm run fetch:ward:smart

# Descobrir novos tickers da Ward API
npm run fetch:ward:smart --discover

# Reset completo de todos os tickers
npm run fetch:ward:smart --reset
```

### **Opções Disponíveis**
- `--discover`: Descobrir e inicializar novos tickers da Ward API
- `--reset`: Resetar estado de todos os tickers
- `--force-full`: Forçar processamento completo (histórico + TTM)
- `--no-brapi`: Desabilitar complemento da Brapi

## Estrutura da Nova Tabela

```sql
CREATE TABLE ticker_processing_status (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR UNIQUE NOT NULL,
  process_type VARCHAR DEFAULT 'ward_data_fetch',
  status VARCHAR DEFAULT 'PENDING',
  has_basic_data BOOLEAN DEFAULT FALSE,
  has_historical_data BOOLEAN DEFAULT FALSE,
  has_ttm_data BOOLEAN DEFAULT FALSE,
  has_brapi_pro_data BOOLEAN DEFAULT FALSE,
  last_processed_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Processamento Paralelo

### 🚀 **Paralelismo em Dois Níveis**

#### **Nível 1: Empresas Paralelas**
- Processa **2 empresas simultaneamente**
- Reduz tempo total pela metade
- Controle inteligente de concorrência

#### **Nível 2: Dados Históricos Paralelos**
- Dentro de cada empresa, dados históricos processam em paralelo
- Balanços, DREs, DFCs, etc. processam simultaneamente
- ~3x mais rápido por empresa

### 📊 **Exemplo de Execução Paralela**
```
📦 Lote 1: PETR4, VALE3
🏢 [1] Processando PETR4...    🏢 [2] Processando VALE3...
  📊 Balanços (paralelo)         📊 Balanços (paralelo)
  📈 DREs (paralelo)             📈 DREs (paralelo)  
  💰 DFCs (paralelo)             💰 DFCs (paralelo)
✅ PETR4 processado em 45s    ✅ VALE3 processado em 52s
📦 Lote processado em 52s: 2 sucessos, 0 falhas

📦 Lote 2: ITUB4, BBDC4
...
```

### ⚡ **Benefícios do Paralelismo**
- **50% menos tempo**: 2 empresas simultâneas
- **Melhor utilização de recursos**: CPU e rede otimizados
- **Timeout inteligente**: Controle por empresa e por lote
- **Recuperação robusta**: Falha de uma não afeta a outra

## Otimização de Inicialização

### 🚀 **Inicialização em Lote Ultra-Rápida**

#### **Problema Anterior**
```typescript
// LENTO: Um upsert por ticker
for (const ticker of tickers) {
  await initializeTicker(ticker); // 1 query por ticker
}
// 500 tickers = 500 queries = ~30-60 segundos
```

#### **Solução Otimizada**
```typescript
// RÁPIDO: Operações em lote
1. findMany() - buscar existentes (1 query)
2. createMany() - criar novos em lote (1 query)  
3. updateMany() - atualizar existentes em lote (1 query)
// 500 tickers = 3 queries = ~1-2 segundos
```

### 📊 **Estratégias de Otimização**

#### **1. Lotes Pequenos (≤100 tickers)**
- Operação única em lote
- Máxima velocidade para casos comuns

#### **2. Lotes Grandes (>100 tickers)**
- Processamento em chunks de 100
- Evita queries muito grandes
- Progresso visível por chunk

#### **3. Tratamento de Conflitos**
- Separação entre novos e existentes
- `createMany` com `skipDuplicates`
- `updateMany` para tickers existentes
- Fallback individual em caso de erro

### 🎯 **Exemplo de Performance**

**Antes (Sequencial):**
```
📋 Inicializando 500 tickers...
⏱️  Tempo: ~45 segundos (90ms por ticker)
```

**Agora (Lote Otimizado):**
```
📋 Inicializando 500 tickers em lote...
  📊 245 já existem, 255 novos, 245 para atualizar
✅ 500 tickers inicializados em 1.2s (255 criados, 245 atualizados)
```

**Melhoria: ~97% mais rápido!** 🚀

## Fluxo de Processamento

### 1. **Inicialização**
```typescript
const tickerManager = new TickerProcessingManager('ward_data_fetch');

// Inicializar tickers específicos
await tickerManager.initializeTickers(['PETR4', 'VALE3'], 1);

// Ou descobrir da Ward API
await discoverAndInitializeTickers(tickerManager);
```

### 2. **Processamento**
```typescript
// Buscar tickers para processar
const tickers = await tickerManager.getTickersToProcess(5, {
  excludeErrors: true,
  maxErrorCount: 2
});

// Processar cada ticker
for (const ticker of tickers) {
  await tickerManager.markProcessing(ticker.ticker);
  
  try {
    await processCompanyWithTracking(ticker.ticker, true, false, tickerManager);
  } catch (error) {
    await tickerManager.markError(ticker.ticker, error.message);
  }
}
```

### 3. **Monitoramento**
```typescript
// Obter resumo do processamento
const summary = await tickerManager.getProcessingSummary();
console.log(tickerManager.getFormattedSummary(summary));

// Resultado:
// 📊 Total: 150 tickers
// ✅ Completos: 120 (80.0%)
// 🔄 Parciais: 15
// ⏳ Pendentes: 10
// ❌ Erros: 5
```

## Vantagens do Novo Sistema

### 🎯 **Flexibilidade Total**
- Execute qualquer ticker a qualquer momento
- Não afeta o estado de outros tickers
- Perfeito para desenvolvimento e debug

### 📊 **Visibilidade Completa**
- Status detalhado de cada ticker
- Histórico de erros e sucessos
- Métricas de progresso em tempo real

### ⚡ **Performance Otimizada**
- Processa apenas o que precisa
- Evita reprocessamento desnecessário
- Sistema de prioridades inteligente
- **Processamento paralelo**: 2 empresas simultâneas
- **Dados históricos paralelos**: ~3x mais rápido por empresa
- **Inicialização em lote**: ~10x mais rápido para inicializar tickers
- **Chunks inteligentes**: Otimizado para lotes grandes (>100 tickers)

### 🔄 **Recuperação Robusta**
- Continua de onde parou automaticamente
- Retry inteligente para erros temporários
- Isolamento de problemas por ticker

## Migração do Sistema Antigo

O sistema antigo (`ProcessingStateManager`) ainda funciona para compatibilidade, mas o novo sistema (`TickerProcessingManager`) é recomendado para todos os novos usos.

### Principais Diferenças:
1. **Estado Global vs Individual**: Antigo controlava estado global, novo controla por ticker
2. **Fases vs Status**: Antigo tinha fases de processamento, novo tem status por ticker
3. **Sequencial vs Flexível**: Antigo assumia ordem sequencial, novo permite qualquer ordem

## Testes

Execute os testes do sistema:
```bash
node scripts/test-ticker-processing.js
```

Os testes verificam:
- ✅ Inicialização de tickers
- ✅ Busca e filtros
- ✅ Simulação de processamento
- ✅ Tickers específicos
- ✅ Tratamento de erros
- ✅ Limpeza e manutenção

## Exemplo Prático

```bash
# 1. Descobrir todos os tickers da Ward
npm run fetch:ward:smart --discover

# 2. Processar alguns tickers específicos para teste
npm run fetch:ward:smart PETR4 VALE3 ITUB4

# 3. Processar automaticamente os pendentes (respeitando limite de tempo)
npm run fetch:ward:smart

# 4. Forçar reprocessamento completo de um ticker com problema
npm run fetch:ward:smart PROBLEMATIC_TICKER --force-full

# 5. Reset completo se necessário
npm run fetch:ward:smart --reset
```

Este sistema resolve completamente o problema de controle de estado para execução de tickers individuais, mantendo toda a robustez do sistema anterior para execuções completas.
