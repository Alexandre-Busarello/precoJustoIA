# Scripts de Ingestão de Dados

## fetch-data.ts

Script TypeScript para buscar dados de ações brasileiras da API Brapi e armazenar no banco de dados PostgreSQL via Prisma.

### 🎯 **Funcionalidades**

- **45+ Tickers do BOVESPA** - Lista abrangente das principais ações brasileiras
- **Ações de Teste Gratuitas** - PETR4, MGLU3, VALE3, ITUB4 funcionam sem token
- **Integração Oficial Brapi API** - Módulos funcionam em ambos os planos! 
- **Módulos Completos** - `summaryProfile` e `defaultKeyStatistics` (gratuito e pago)
- **Rate Limiting Adaptativo** - Otimizado para cada tipo de plano
- **Upsert Inteligente** - Atualiza dados existentes ou cria novos registros
- **Error Handling** - Tratamento robusto de erros com continuidade do processo
- **Logging Detalhado** - Acompanhamento completo do progresso

### 📊 **Dados Coletados**

**Empresas:**
- Ticker, Nome, Setor (Energy, Consumer Cyclical, etc.), Indústria, Descrição

**Cotações Diárias:**
- Preço de fechamento por dia

**Indicadores Fundamentalistas (65 indicadores disponíveis, 62 típicos!):**

**💰 VALUATION (14 indicadores):**
- P/L, Forward P/E, P/VP, DY, EV/EBITDA, EV/EBIT, EV/Revenue, PSR, LPA, Trailing EPS, VPA

**🏦 ENDIVIDAMENTO E LIQUIDEZ (6 indicadores):**
- Liquidez Corrente, Liquidez Rápida, Debt/Equity, Dívida Líquida/PL, Passivo/Ativos

**📈 RENTABILIDADE (7 indicadores):**
- **ROE, ROA**, Margem Bruta, **Margem EBITDA**, Margem Operacional, Margem Líquida, ROIC

**📊 CRESCIMENTO (4 indicadores):**
- ~~CAGR Receitas 5a~~ (requer dados históricos), CAGR Lucros 5a, ~~Crescimento Trimestral~~ (dados não disponíveis), Crescimento Lucros, Crescimento Receitas

**💹 DADOS FINANCEIROS OPERACIONAIS (9 indicadores):**
- **EBITDA**, Receita Total, Lucro Líquido, Fluxo Caixa Operacional, **Fluxo Caixa Livre**, Total Caixa, Total Dívida, Receita por Ação, Caixa por Ação

**🏢 DADOS DA EMPRESA (6 indicadores):**
- Setor, Indústria, Website, Funcionários, Endereço completo, Logo URL

**💰 DADOS DO BALANÇO PATRIMONIAL (12 indicadores):**
- Ativo Total, Ativo Circulante, Passivo Total, Patrimônio Líquido, Caixa, Estoques, Contas a Receber, Imobilizado, Intangível, Dívida Circulante, Dívida Longo Prazo

**📈 DADOS DE DIVIDENDOS DETALHADOS (3 indicadores):**
- **Último Dividendo Pago**, **Data do Último Dividendo**, **Histórico Completo** (até 63+ dividendos históricos!)

**🔢 INDICADORES CALCULADOS (8 indicadores):**
- **P/Ativos**, **Passivo/Ativos**, **Giro de Ativos**, **ROIC**, **Dívida Líquida/PL**, **Dívida Líquida/EBITDA**, **P/Capital de Giro**, **P/EBIT**

### ✨ **Descoberta Revolucionária**

**TODOS os módulos E parâmetros funcionam no plano gratuito!** Descobrimos os segredos da API:

- ✅ `summaryProfile` - Dados da empresa (setor, indústria, descrição)
- ✅ `defaultKeyStatistics` - Alguns indicadores financeiros 
- ✅ **`financialData`** - **OS DADOS CRÍTICOS!** (ROE, ROA, Margem Bruta, EBITDA, etc.)
- ✅ **`balanceSheetHistory`** - **BALANÇO PATRIMONIAL COMPLETO!** (Ativo Total, PL, etc.)
- ✅ **`dividends=true`** - **63+ DIVIDENDOS HISTÓRICOS!** (último dividendo, datas, tipos)
- ✅ Cálculos proprietários para indicadores não disponíveis diretamente

### 🚀 **Execução**

O script agora suporta tanto plano gratuito quanto pago da Brapi:

```bash
# PLANO GRATUITO (1 ação por requisição)
npm run fetch:data:free

# PLANO PAGO (10 ações por requisição)
npm run fetch:data:paid

# Script genérico (padrão: gratuito)
npm run fetch:data

# Com token da Brapi (para plano pago)
BRAPI_TOKEN="seu-token" npm run fetch:data:paid
```

### ⚙️ **Configuração**

**Variáveis de Ambiente:**
```env
# Obrigatórias
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Opcional - para rate limiting maior
BRAPI_TOKEN="seu-token-brapi"
```

**Pré-requisitos:**
1. Banco PostgreSQL configurado (Supabase)
2. Schema Prisma aplicado (`npx prisma db push`)
3. Cliente Prisma gerado (`npx prisma generate`)

### 🔄 **Fluxo de Execução**

**Plano Gratuito:**
1. **Processamento Individual** - 1 ação por vez
2. **Busca Completa** - API Brapi `/quote/` com `fundamental=true` + módulos
3. **Módulos Funcionais** - `summaryProfile` e `defaultKeyStatistics` ✅
4. **Rate Limiting** - 2s entre requisições

**Plano Pago:**
1. **Processamento em Lotes** - 10 ações por requisição  
2. **Mesma API** - `/quote/` com `fundamental=true` + módulos
3. **Mesmos Módulos** - `summaryProfile` e `defaultKeyStatistics`
4. **Rate Limiting** - 1s entre lotes

**Ambos:**
5. **Upsert Empresas** - Cria/atualiza dados da empresa
6. **Upsert Cotações** - Armazena preço do dia
7. **Upsert Indicadores** - Dados fundamentalistas disponíveis

### 📈 **Rate Limiting**

**Adaptado para ambos os planos:**

**Plano Gratuito (sem token):**
- 1 ação por requisição
- 2 segundos entre requisições
- ~45 requisições para todas as ações
- Tempo estimado: ~2 minutos

**Plano Pago (com token):**
- 10 ações por requisição
- 1 segundo entre lotes
- ~5 lotes para todas as ações  
- Tempo estimado: ~10 segundos

### 🎛️ **Personalização**

**Adicionar Tickers:**
```typescript
const TICKERS = [
  // ... tickers existentes
  'NOVO4', 'TESTE3'
];
```

**Ajustar Rate Limiting:**
```typescript
await this.delay(500); // Entre empresas
await this.delay(2000); // Entre lotes
```

### 📋 **Logs de Exemplo**

**Plano Gratuito:**
```
🔧 Configuração: Plano Gratuito (1 ação por requisição)
🚀 Iniciando processo de atualização de dados...
📋 Total de tickers: 45

📦 Processando lote 1 de 45 (1 ação)
🔍 Buscando cotações e fundamentos para: PETR4
✅ Empresa processada: PETR4 - Petróleo Brasileiro S.A. - Petrobras
🏭 Setor: Energy
💰 Cotação atualizada: PETR4 - R$ 31.55
📈 Fundamentos atualizados: PETR4 (P/L: 5.24, P/VP: 0.99, DY: 17.02%, PSR: 0.85)
   📊 Disponíveis: 62/66 indicadores
   📋 Dados extras: MC: R$ 414.1B, Receita: R$ 487.7B, EBITDA: R$ 208.1B
   🎯 Dados críticos: ROE: 16.5%, ROA: 5.6%, LC: 0.76, ME: 42.7%
   🎉 Antes NULL, agora OK: P/Ativos: 0.37, Pass/At: 100.0%, GA: 0.43, ROIC: 14.4%, DL/PL: 0.96
   📊 Balanço: At.Total: R$ 1124.8B, PL: R$ 367.5B, Últ.Div: R$ 0.31

📦 Processando lote 2 de 45 (1 ação)
🔍 Buscando cotações e fundamentos para: MGLU3
✅ Empresa processada: MGLU3 - Magazine Luiza S.A.
🏭 Setor: Consumer Cyclical
💰 Cotação atualizada: MGLU3 - R$ 9.86
📈 Fundamentos atualizados: MGLU3 (P/L: 17.86, P/VP: 0.52, DY: 3.89%, PSR: 0.16)
   📊 Disponíveis: 40/47 indicadores
   📋 Dados extras: MC: R$ 6.0B, Receita: R$ 38.2B, EBITDA: R$ 2.9B
   🎯 Dados críticos: ROE: 3.6%, ROA: 1.1%, LC: 1.29, ME: 7.7%
```

**Plano Pago:**
```
🔧 Configuração: Plano Pago (10 ações por requisição)
🚀 Iniciando processo de atualização de dados...
📋 Total de tickers: 45

📦 Processando lote 1 de 5 (4 ações)
🔍 Buscando cotações e fundamentos para: PETR4,MGLU3,VALE3,ITUB4
✅ Empresa processada: PETR4 - Petróleo Brasileiro S.A. - Petrobras
💰 Cotação atualizada: PETR4 - R$ 31.56
📈 Fundamentos atualizados: PETR4
✅ Empresa processada: MGLU3 - Magazine Luiza S.A.
💰 Cotação atualizada: MGLU3 - R$ 9.84
📈 Fundamentos atualizados: MGLU3
```

### ⚠️ **Notas Importantes**

- **Dados Históricos:** Script busca apenas dados atuais
- **Horário Mercado:** Melhor executar após 18h (fechamento B3)
- **Fins de Semana:** API pode retornar dados do último dia útil
- **Tokens Inválidos:** Script continua sem token, apenas com rate limiting menor

### 🔧 **Troubleshooting**

**Erro "O seu plano não permite acessar dados do módulo":**
- Use `npm run fetch:data:free` para plano gratuito
- Script adaptado automaticamente remove módulos restritos

**Erro "O seu plano permite até 1 ações por requisição":**
- Use `npm run fetch:data:free` (1 ação por vez)
- Não use `npm run fetch:data:paid` sem token válido

**Erro 401 Unauthorized:**
- Token inválido ou expirado
- Script funciona sem token nas ações gratuitas

**Erro Prisma P5010:**
- Banco não conectado ou inacessível
- Verificar `DATABASE_URL`

**Rate Limit Exceeded:**
- Aumentar delays no código
- Considerar upgrade para plano pago

### 📅 **Automação**

Para execução automática, configure um cron job:

```bash
# Executar diariamente às 19h
0 19 * * 1-5 cd /caminho/projeto && npm run fetch:data
```
