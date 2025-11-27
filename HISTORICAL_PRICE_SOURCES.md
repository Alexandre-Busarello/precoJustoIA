# 📊 Fontes de Criação de HistoricalPrice

Este documento lista todos os processos que criam/atualizam registros na tabela `historical_prices`.

## 🔍 Processos Identificados

### 1. ✅ **UPDATE PORTFOLIO ASSETS (PRICES)**
**Cron**: `https://precojusto.ai/api/cron/update-portfolio-assets?mode=prices`  
**Horário**: Today at 2:00:03 AM (diário às 2h)

**Fluxo**:
```
/api/cron/update-portfolio-assets?mode=prices
  ↓
PortfolioAssetUpdateService.updateHistoricalPricesOnly()
  ↓
updateHistoricalPricesIncremental(companyId, ticker)
  ↓
HistoricalDataService.updateHistoricalDataIncremental(ticker, '1mo')
  ↓
prisma.historicalPrice.createMany() ou upsert
```

**O que faz**:
- Busca apenas preços históricos **incrementais** (dados novos desde a última atualização)
- Processa apenas tickers que estão em carteiras ativas
- Se não há dados: busca últimos 10 anos
- Se há dados: busca apenas desde a última data + 1 mês
- Usa Yahoo Finance como fonte

**Arquivos**:
- `src/app/api/cron/update-portfolio-assets/route.ts` (linha 56)
- `src/lib/portfolio-asset-update-service.ts` (linha 452-544)
- `src/lib/portfolio-asset-update-service.ts` (linha 263-310)
- `src/lib/historical-data-service.ts` (método `updateHistoricalDataIncremental`)

---

### 2. ✅ **PRECO JUSTO AI - FETCH WARD**
**Cron**: `https://precojusto.ai/api/cron/fetch-ward`  
**Horário**: Today at 12:00:06 PM (a cada 6 horas)

**Fluxo**:
```
/api/cron/fetch-ward
  ↓
scripts/fetch-data-ward.ts (main function)
  ↓
updateRecentHistoricalPrices(companyId, ticker)
  ↓
prisma.historicalPrice.upsert()
```

**O que faz**:
- Atualiza dados históricos **recentes** (últimos 2-3 meses)
- Usa BRAPI como fonte de dados
- Processa **todas as empresas** do banco (não apenas carteiras)
- Busca últimos 3 meses de dados mensais (`range: '3mo', interval: '1mo'`)
- Filtra para manter apenas últimos 2 meses completos

**Arquivos**:
- `src/app/api/cron/fetch-ward/route.ts`
- `scripts/fetch-data-ward.ts` (linha 2139-2278)
- `scripts/fetch-data-ward.ts` (linha 3889 - chamada)

---

### 3. ✅ **UPDATE PORTFOLIO ASSETS (FULL)**
**Cron**: `https://precojusto.ai/api/cron/update-portfolio-assets` (sem mode ou `mode=full`)  
**Horário**: Não está na lista de crons ativos (mas pode ser executado manualmente)

**Fluxo**:
```
/api/cron/update-portfolio-assets (mode=full)
  ↓
PortfolioAssetUpdateService.updateAllPortfolioAssets()
  ↓
updateHistoricalPricesIncremental() (mesmo fluxo do #1)
  ↓
prisma.historicalPrice.createMany() ou upsert
```

**O que faz**:
- Atualização completa: preços históricos + dividendos + dados gerais
- Mesma lógica incremental do processo #1
- Recomendado executar diariamente após fechamento do mercado

**Arquivos**:
- `src/app/api/cron/update-portfolio-assets/route.ts` (linha 73)
- `src/lib/portfolio-asset-update-service.ts` (método `updateAllPortfolioAssets`)

---

### 4. ✅ **BDRs**
**Cron**: `https://precojusto.ai/api/cron/update-portfolio-assets?mode=bdr`  
**Horário**: Today at 12:00:05 PM (diário ao meio-dia)

**Fluxo**:
```
/api/cron/update-portfolio-assets?mode=bdr
  ↓
PortfolioAssetUpdateService.updateBDRsOnly()
  ↓
BDRDataService.processHistoricalPrices(companyId, ticker)
  ↓
prisma.historicalPrice.upsert()
```

**O que faz**:
- Processa apenas BDRs (Brazilian Depositary Receipts)
- Busca dados históricos mensais do Yahoo Finance
- Cria/atualiza registros de preços históricos para BDRs

**Arquivos**:
- `src/app/api/cron/update-portfolio-assets/route.ts` (linha 64)
- `src/lib/portfolio-asset-update-service.ts` (método `updateBDRsOnly`)
- `src/lib/bdr-data-service.ts` (linha 3405-3500)

---

## 📋 Resumo por Cron Ativo

| Cron | Frequência | O que cria | Fonte | Escopo |
|------|------------|------------|-------|--------|
| **UPDATE PORTFOLIO ASSETS (PRICES)** | Diário 2h | Preços incrementais | Yahoo Finance | Apenas carteiras |
| **FETCH WARD** | A cada 6h | Preços recentes (2-3 meses) | BRAPI | Todas empresas |
| **BDRs** | Diário 12h | Preços históricos BDRs | Yahoo Finance | Apenas BDRs |

---

## 🔍 Como Identificar Qual Processo Criou um Registro

Infelizmente, a tabela `historical_prices` **não possui** um campo que identifica a origem do dado. Para identificar:

1. **Verificar data de criação**: `createdAt` (se existir no schema)
2. **Verificar intervalo**: Todos usam `interval: '1mo'` (mensal)
3. **Verificar padrão de datas**:
   - **FETCH WARD**: Apenas últimos 2-3 meses
   - **UPDATE PORTFOLIO ASSETS**: Dados incrementais (última data + 1 mês)
   - **BDRs**: Apenas para tickers BDR

---

## 💡 Recomendações

### Para evitar duplicação:
- ✅ **FETCH WARD** já verifica datas existentes antes de inserir (linha 2181-2216)
- ✅ **UPDATE PORTFOLIO ASSETS** usa lógica incremental (busca apenas dados novos)
- ✅ **BDRs** usa `upsert` (atualiza se existe, cria se não existe)

### Para otimização:
- ⚠️ **FETCH WARD** processa TODAS as empresas (pode ser lento)
- ✅ **UPDATE PORTFOLIO ASSETS** processa apenas carteiras (mais rápido)
- 💡 Considere executar FETCH WARD apenas para empresas sem dados históricos

---

## 🐛 Troubleshooting

### Se `historicalPrice` não está sendo criado:

1. **Verificar logs do cron**:
   ```bash
   # Verificar se o cron está executando
   # Verificar erros nos logs da Vercel
   ```

2. **Verificar se empresa existe**:
   ```sql
   SELECT * FROM companies WHERE ticker = 'PETR4';
   ```

3. **Verificar se já existe dados**:
   ```sql
   SELECT * FROM historical_prices 
   WHERE company_id = (SELECT id FROM companies WHERE ticker = 'PETR4')
   ORDER BY date DESC;
   ```

4. **Verificar APIs externas**:
   - Yahoo Finance: Pode estar bloqueando requisições
   - BRAPI: Verificar se `BRAPI_TOKEN` está configurado

---

## 📝 Notas Técnicas

- Todos os processos usam `interval: '1mo'` (dados mensais)
- Todos usam `upsert` ou verificam duplicatas antes de inserir
- FETCH WARD é o único que processa TODAS as empresas
- UPDATE PORTFOLIO ASSETS é mais eficiente (apenas carteiras)
- BDRs tem processo separado devido à complexidade de dados internacionais

