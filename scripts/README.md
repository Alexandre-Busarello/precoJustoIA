# Scripts de Extração de Dados

Este diretório contém scripts para extrair e processar dados financeiros de diferentes fontes.

## Scripts Disponíveis

### 📊 Fetch Data Fundamentus
**Arquivo**: `fetch-data-fundamentus.ts`  
**Executor**: `run-fetch-fundamentus.js`  
**Descrição**: Extrai dados fundamentalistas do site Fundamentus via API local

```bash
# Testar API do Fundamentus
node scripts/test-fundamentus-api.js

# Processar tickers específicos
node scripts/run-fetch-fundamentus.js WEGE3 PETR4 VALE3

# Processar amostra de tickers do banco
node scripts/run-fetch-fundamentus.js
```

**Características**:
- ✅ Dados mais confiáveis que Brapi para mercado brasileiro
- ✅ Merge inteligente: `fundamentus+ward+brapi`
- ✅ Nova tabela `price_oscillations` para variações de preço
- ✅ Processamento paralelo (3 empresas simultâneas)
- ✅ API local (mais rápida e estável)

### 1. `fetch-data.ts` - Dados da Brapi API
Script original que busca dados da Brapi API (dados atuais/recentes).

**Uso:**
```bash
# Buscar dados de todas as empresas
npx tsx scripts/fetch-data.ts

# Buscar dados de empresas específicas
npx tsx scripts/fetch-data.ts PETR4 VALE3 ITUB4
```

**Características:**
- Busca dados atuais (ano corrente)
- Uma linha por empresa por ano
- Calcula `earningsYield` automaticamente
- Fonte: Brapi API (gratuita para algumas ações)

### 2. `fetch-data-ward.ts` - Dados Históricos da Ward API
Novo script que busca dados históricos completos da Ward API.

**Uso:**
```bash
# Buscar dados históricos com complemento da Brapi (padrão)
npx tsx scripts/fetch-data-ward.ts ITUB4 PETR4

# Buscar dados apenas da Ward (sem complemento)
npx tsx scripts/fetch-data-ward.ts ITUB4 PETR4 --no-brapi

# Auto-discovery com complemento da Brapi (356 empresas)
npx tsx scripts/fetch-data-ward.ts

# Auto-discovery apenas Ward
npx tsx scripts/fetch-data-ward.ts --no-brapi

# Configurar token JWT (opcional, já tem um padrão)
export WARD_JWT_TOKEN="seu_token_aqui"
npx tsx scripts/fetch-data-ward.ts ITUB4
```

**⚡ Funcionalidades Avançadas:**
- **Auto-descoberta:** Busca automaticamente **todos os 356 tickers** disponíveis na Ward API
- **Criação automática:** Empresas faltantes são criadas usando dados básicos da Brapi (gratuito)
- **Integração híbrida:** Ward (histórico) + Brapi (indicadores complementares)
- **Complemento inteligente:** Dados da Ward têm prioridade, Brapi complementa campos faltantes
- **Progresso em tempo real:** Logs a cada 10 empresas processadas

**Características:**
- **Ward API:** Dados históricos, P/L, ROE, ROIC, Payout, CAGR, etc.
- **Brapi API:** Market Cap, dados do balanço, fluxo de caixa, PSR, Forward P/E
- **Mesclagem:** Ano atual recebe dados de ambas as APIs (dataSource: 'ward+brapi')
- **Anos anteriores:** Apenas Ward API (dataSource: 'ward')
- **Opção --no-brapi:** Desabilita complemento da Brapi se necessário
- Converte automaticamente percentuais para decimais
- Trata valores -9999 como null

### 3. `update-quotes.ts` - Atualização Rápida de Cotações
Script otimizado para atualizar apenas as cotações diárias.

**Uso:**
```bash
# Atualizar cotações de todas as empresas (plano gratuito)
npx tsx scripts/update-quotes.ts 1

# Atualizar cotações em lotes maiores (plano pago)
npx tsx scripts/update-quotes.ts 10
```

**Características:**
- **Rápido:** Apenas cotações, sem dados fundamentalistas
- **Inteligente:** Calcula variação percentual automaticamente
- **Eficiente:** Processa apenas empresas já cadastradas no banco
- **Visual:** Mostra 📈 (alta), 📉 (baixa), ➡️ (estável)
- **Seguro:** Rate limiting automático para evitar bloqueios

### 4. Scripts de Migração

#### `migrate-price-variation-reports.ts` - Migração de Relatórios de Variação de Preço
Script para preencher campos `windowDays` e `conclusion` em relatórios existentes e remover duplicatas.

**Uso:**
```bash
# Modo dry-run (apenas visualizar, sem fazer alterações)
npx tsx scripts/migrate-price-variation-reports.ts --dry-run

# Executar migração real
npx tsx scripts/migrate-price-variation-reports.ts
```

**Funcionalidades:**
- ✅ Preenche `windowDays` extraindo de `metadata.triggerReason.days`
- ✅ Preenche `conclusion` extraindo do conteúdo do relatório via regex
- ✅ Remove relatórios duplicados (mantém apenas o mais recente para cada empresa/dia)
- ✅ Modo dry-run para visualizar alterações antes de aplicar
- ✅ Relatório detalhado do processo

**Características:**
- Processa apenas relatórios `PRICE_VARIATION` com status `COMPLETED`
- Identifica duplicatas por empresa e data (normalizada para dia)
- Mantém sempre o relatório mais recente em caso de duplicatas
- Logs detalhados de cada etapa do processo

#### `migrate-to-year.ts` (removido)
Migra dados existentes de `reportDate` para `year`.

#### `cleanup-duplicates.ts` (removido)
Remove duplicatas mantendo apenas o registro mais recente por empresa/ano.

## Estrutura de Dados

### Mudanças no Schema
- **Antes:** `reportDate` (DateTime) - uma data específica
- **Depois:** `year` (Int) - ano dos dados (dados anualizados)
- **Novo campo:** `payout` (Decimal) - percentual de distribuição de dividendos

### Índice Único
Agora garantimos apenas **uma linha por empresa por ano**:
```prisma
@@unique([companyId, year])
```

## Fluxo Recomendado

1. **Setup inicial:** Use `fetch-data-ward.ts` para criar empresas e histórico completo
2. **Dados atuais:** Use `fetch-data.ts` para dados fundamentalistas do ano corrente
3. **Cotações diárias:** Use `update-quotes.ts` para atualização rápida de preços
4. **Manutenção:** Execute `update-quotes.ts` diariamente e os outros periodicamente

## Exemplo de Dados Extraídos

### Ward API - Fluxo Completo:
```
🔍 Buscando lista de tickers da Ward API...
✅ Lista de tickers obtida: 356 empresas encontradas
📊 Processando 356 tickers da Ward API

🏢 Processando ABEV3...
🔍 Buscando dados básicos da Brapi para ABEV3...
✅ Dados básicos obtidos da Brapi para ABEV3
✅ Empresa criada: ABEV3 - Ambev S.A.
🏭 Setor: Consumer Defensive
💰 Cotação criada: ABEV3 - R$ 12.63
```

### Ward API Response (ITUB4):
```
📊 2023: P/L=9.70, ROE=17.02%, EY=10.31%
📊 2022: P/L=7.81, ROE=17.33%, EY=12.80%
📊 2021: P/L=7.41, ROE=17.26%, EY=13.50%
...
📈 Progresso: 10/356 empresas processadas
```

### Update Quotes - Cotações Rápidas:
```
🔧 Configuração: Plano Gratuito (1 ação por requisição)
🚀 Iniciando atualização de cotações...
📋 Total de empresas: 7

💰 AALR3: R$ 6.00 ➡️ +0.00%
💰 ABEV3: R$ 12.63 📈 +0.40%
💰 ITUB4: R$ 38.00 📈 +1.66%
💰 MGLU3: R$ 10.58 📈 +7.41%

✅ Taxa de sucesso: 100.0%
```

### Campos Principais:
- **Valuation:** P/L, P/VP, EV/EBITDA, Earnings Yield
- **Rentabilidade:** ROE, ROIC, ROA, Margens
- **Crescimento:** CAGR Lucros 5a, Crescimento Receitas
- **Dividendos:** DY, Payout
- **Financeiros:** EBITDA, Receita, Lucro Líquido

## Configuração

### Variáveis de Ambiente
```bash
# Token da Ward API (opcional, já tem padrão)
WARD_JWT_TOKEN=seu_token_jwt_aqui

# Configurações do banco (já configuradas no .env)
DATABASE_URL=sua_connection_string
```

### Dependências
```bash
npm install axios prisma @prisma/client dotenv
```

## Troubleshooting

### Erro: "Token JWT expirado"
- Atualize o `WARD_JWT_TOKEN` no arquivo ou variável de ambiente
- O token padrão pode expirar periodicamente

### Erro: "Unique constraint failed"
- Execute `cleanup-duplicates.ts` para remover duplicatas
- Verifique se não há dados conflitantes

### Erro: "Campo não existe"
- Execute `npx prisma generate` após mudanças no schema
- Verifique se a migração foi aplicada com `npx prisma db push`