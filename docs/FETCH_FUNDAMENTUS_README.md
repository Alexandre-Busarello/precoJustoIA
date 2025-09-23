# 📊 Fetch Data Fundamentus

Script para extração de dados fundamentalistas do site Fundamentus através de API local.

## 🎯 Objetivo

Extrair dados fundamentalistas confiáveis do Fundamentus e integrá-los com os dados existentes (Ward + Brapi), priorizando a qualidade e precisão dos indicadores financeiros.

## 🏗️ Arquitetura

### Fontes de Dados
- **API Local**: `http://localhost:8000/stock/{TICKER}`
- **Prioridade**: Fundamentus > Ward > Brapi
- **Merge**: `fundamentus+ward+brapi`

### Dados Extraídos

#### 📈 Indicadores de Valuation
- P/L (Price/Earnings)
- P/VP (Price/Book Value) 
- P/EBIT
- PSR (Price/Sales Ratio)
- P/Ativos
- P/Capital de Giro
- Dividend Yield
- EV/EBITDA
- EV/EBIT

#### 💰 Indicadores de Rentabilidade
- ROE (Return on Equity)
- ROIC (Return on Invested Capital)
- Margem Bruta
- Margem EBIT
- Margem Líquida
- Giro de Ativos
- Crescimento de Receitas (5 anos)

#### 🏦 Indicadores de Endividamento
- Liquidez Corrente
- Dívida Líquida/PL
- Dívida Líquida/EBITDA
- PL/Ativos

#### 📊 Dados do Balanço
- Ativo Total
- Ativo Circulante
- Disponibilidades (Caixa)
- Dívida Bruta
- Dívida Líquida
- Patrimônio Líquido

#### 📈 Dados da DRE (12 meses)
- Receita Líquida
- EBIT
- Lucro Líquido

#### 🎢 Oscilações de Preço (Nova Tabela)
- Variação do dia
- Variação do mês
- Variação 30 dias
- Variação 12 meses
- Variações anuais (2020-2025)
- Mínimo/Máximo 52 semanas
- Volume negociado por dia

#### 📊 Dados Trimestrais (Nova Tabela)
- **3 Meses**: Receita, EBIT, Lucro Líquido
- **12 Meses**: Receita, EBIT, Lucro Líquido (para comparação)
- Permite análise de sazonalidade e tendências

#### 📈 Métricas de Crescimento (Calculadas)
- **CAGR Lucros 5 Anos**: Baseado nos dados históricos do banco
- **Crescimento de Lucros**: Variação ano anterior vs atual
- **Cálculo Inteligente**: Usa apenas lucros positivos para CAGR
- **Fonte**: Dados da tabela `financial_data` (últimos 5 anos)

## 🚀 Como Usar

### Pré-requisitos

1. **API Local do Fundamentus rodando**:
   ```bash
   # A API deve estar disponível em http://localhost:8000
   curl http://localhost:8000/stock/PETR4
   ```

2. **Banco de dados atualizado**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Execução

#### Tickers Específicos
```bash
# Processar tickers específicos
node scripts/run-fetch-fundamentus.js PETR4 VALE3 ITUB4

# Ou diretamente com tsx
npx tsx scripts/fetch-data-fundamentus.ts WEGE3 MGLU3
```

#### Todos os Tickers do Banco
```bash
# Processar amostra (primeiros 10 tickers)
node scripts/run-fetch-fundamentus.js

# Sem argumentos = busca todos os tickers disponíveis no banco
```

## 📋 Estrutura do Banco

### Tabela: `financial_data`
- **Merge inteligente**: Preserva dados únicos de outras fontes
- **Prioridade**: Fundamentus sobrescreve Ward/Brapi
- **Campo `dataSource`**: `"fundamentus+ward+brapi"`

### Nova Tabela: `price_oscillations`
```sql
CREATE TABLE price_oscillations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  extraction_date DATE NOT NULL,
  variation_day DECIMAL(15,6),
  variation_month DECIMAL(15,6),
  variation_30_days DECIMAL(15,6),
  variation_12_months DECIMAL(15,6),
  variation_2025 DECIMAL(15,6),
  variation_2024 DECIMAL(15,6),
  -- ... outras variações
  min_52_weeks DECIMAL(10,4),
  max_52_weeks DECIMAL(10,4),
  traded_volume_per_day DECIMAL(20,2),
  UNIQUE(company_id, extraction_date)
);
```

### Nova Tabela: `quarterly_financials`
```sql
CREATE TABLE quarterly_financials (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  extraction_date DATE NOT NULL,
  quarterly_revenue DECIMAL(20,2),      -- 3 meses
  quarterly_ebit DECIMAL(20,2),         -- 3 meses
  quarterly_net_income DECIMAL(20,2),   -- 3 meses
  twelve_months_revenue DECIMAL(20,2),  -- 12 meses
  twelve_months_ebit DECIMAL(20,2),     -- 12 meses
  twelve_months_net_income DECIMAL(20,2), -- 12 meses
  UNIQUE(company_id, extraction_date)
);
```

## 🔄 Fluxo de Processamento

1. **Busca dados** da API local do Fundamentus
2. **Converte** para formato do banco (mapeamento de campos)
3. **Processa oscilações** na tabela `price_oscillations`
4. **Processa dados trimestrais** na tabela `quarterly_financials`
5. **Calcula métricas históricas** (CAGR e crescimento de lucros)
6. **Busca dados existentes** no `financial_data`
7. **Merge inteligente** priorizando Fundamentus + métricas calculadas
8. **Upsert** no banco com fonte `fundamentus+...`

## ⚡ Performance

- **Paralelismo**: 3 empresas simultâneas
- **Timeout**: 60s por ticker (API local)
- **Retry**: 3 tentativas com backoff
- **Lotes**: Processamento em batches

## 🎯 Qualidade dos Dados

### Vantagens do Fundamentus
- ✅ Dados mais atualizados
- ✅ Cálculos padronizados
- ✅ Fonte confiável do mercado brasileiro
- ✅ Indicadores específicos do Brasil

### Estratégia de Merge
- **Fundamentus**: Prioridade máxima para indicadores operacionais
- **Ward**: Mantido para dados históricos
- **Brapi**: Preservado para campos únicos (ex: dados internacionais)

## 📊 Monitoramento

### Logs Detalhados
```
🏢 Processando WEGE3 com dados do Fundamentus...
✅ Dados do Fundamentus obtidos para WEGE3
📊 Processando oscilações de preço para WEGE3...
✅ Oscilações de preço processadas para WEGE3
📊 Processando dados trimestrais para WEGE3...
✅ Dados trimestrais processados para WEGE3
📊 Recalculando métricas de crescimento para todos os anos...
📈 Processando 6 anos de dados financeiros
  📊 2020: CAGR Lucros: 12.5%, CAGR Receitas: 8.2%, Cresc Lucros: 15.3%, Cresc Receitas: 12.1%
  📊 2021: CAGR Lucros: 13.8%, CAGR Receitas: 9.5%, Cresc Lucros: 22.1%, Cresc Receitas: 18.7%
  📊 2024: CAGR Lucros: 15.2%, CAGR Receitas: 12.8%, Cresc Lucros: 8.5%, Cresc Receitas: 6.2%
✅ Métricas de crescimento recalculadas para todos os anos
🔄 WEGE3: Dados mesclados Fundamentus + ward+brapi
✅ WEGE3: P/L=24.3, ROE=28.90%, DY=2.20%, PSR=3.8, CAGR-L=15.2%, CAGR-R=12.8%, Cresc-L=8.5%, Cresc-R=6.2%
```

### Indicadores de Sucesso
- ✅ Taxa de sucesso por lote
- ⏱️ Tempo de processamento
- 📊 Indicadores extraídos por empresa
- 🔄 Status do merge de dados

## 🚨 Troubleshooting

### API Local Indisponível
```bash
# Verificar se a API está rodando
curl http://localhost:8000/health

# Logs do erro
❌ Erro ao processar empresa PETR4: connect ECONNREFUSED 127.0.0.1:8000
```

### Dados Inconsistentes
- Script valida campos obrigatórios
- Logs detalhados para debug
- Fallback para dados existentes

### Performance
- Ajustar `batchSize` se necessário
- Monitorar timeout da API
- Verificar concorrência do banco

## 🔧 Configuração

### Variáveis de Ambiente
```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NODE_ENV="development"
```

### Customização
- **Batch Size**: Alterar `batchSize = 3`
- **Timeout**: Ajustar `60000ms`
- **Retry**: Modificar `3 tentativas`

## 📈 Próximos Passos

1. **Integração com Estratégias**: Usar dados do Fundamentus nas análises
2. **Histórico de Oscilações**: Dashboard de variações de preço
3. **Alertas**: Notificações baseadas em indicadores
4. **API Pública**: Disponibilizar dados via endpoints

---

**Criado**: 23/09/2025  
**Versão**: 1.0.0  
**Autor**: Sistema de Análise de Ações
