# Melhorias de Carteira: Dividendos e Analytics

## 📋 Resumo das Implementações

Este documento detalha as melhorias implementadas no sistema de carteiras, focando em:
1. **Sistema de Dividendos Automáticos**
2. **Analytics e Comparação com Benchmarks**
3. **Correção de Dados Históricos**

---

## 🎯 1. Sistema de Dividendos Automáticos

### 1.1 Tabela de Histórico de Dividendos

**Arquivo**: `prisma/schema.prisma`

#### Model `DividendHistory`
```prisma
model DividendHistory {
  id              Int      @id @default(autoincrement())
  companyId       Int      @map("company_id")
  exDate          DateTime @map("ex_date") @db.Date
  paymentDate     DateTime? @map("payment_date") @db.Date
  amount          Decimal  @db.Decimal(15, 6)
  type            String?
  currency        String?  @default("BRL")
  source          String   @default("yahoo")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  company         Company  @relation(...)
  
  @@unique([companyId, exDate, amount])
  @@map("dividend_history")
}
```

#### Campos adicionados em `Company`
```prisma
ultimoDividendo     Decimal?  @map("ultimo_dividendo")
dataUltimoDividendo DateTime? @map("data_ultimo_dividendo")
```

### 1.2 DividendService

**Arquivo**: `src/lib/dividend-service.ts`

#### Funcionalidades Principais:

1. **`fetchAndSaveDividends(ticker, startDate?)`**
   - Busca histórico completo de dividendos do Yahoo Finance
   - Salva na tabela `dividend_history`
   - Atualiza campos `ultimoDividendo` e `dataUltimoDividendo` em `Company`
   - Retorna contagem de dividendos e último dividendo

2. **`fetchDividendsFromYahoo(ticker, startDate?)`**
   - Usa `yahooFinance.chart()` com `events: 'dividends'`
   - Extrai dividendos dos últimos 10 anos por padrão
   - Retorna array de `DividendData`

3. **`getCurrentMonthDividends(ticker)`**
   - Retorna dividendos do mês atual
   - Usado para gerar transações sugeridas

4. **`calculateDividendYield12M(ticker, currentPrice)`**
   - Calcula dividend yield anualizado dos últimos 12 meses

### 1.3 Integração com Transações Sugeridas

**Arquivo**: `src/lib/portfolio-transaction-service.ts`

#### Método Adicionado: `generateDividendSuggestions()`

**Lógica**:
1. Para cada ativo em custódia
2. Busca dividendos históricos (se não existirem)
3. Filtra dividendos do mês atual com ex-date já passada
4. Calcula valor total: `dividendoPorAção × quantidade`
5. Cria transação sugerida do tipo `DIVIDEND`

**Exemplo de Sugestão**:
```typescript
{
  date: exDate,
  type: 'DIVIDEND',
  ticker: 'PETR4',
  amount: 123.45, // Total
  quantity: 100,
  price: 1.2345, // Dividendo por ação
  reason: 'Dividendo de PETR4: R$ 1.2345/ação × 100 ações = R$ 123.45',
  cashBalanceBefore: 1000,
  cashBalanceAfter: 1123.45
}
```

### 1.4 Atualização de Cache

**Arquivo**: `src/lib/smart-query-cache.ts`

```typescript
PRISMA_MODEL_TO_TABLE: {
  'dividendHistory': 'dividend_history'
}

TABLE_DEPENDENCIES: {
  'dividend_history': ['companies', 'dividend_history']
}
```

---

## 📊 2. Analytics e Comparação com Benchmarks

### 2.1 PortfolioAnalyticsService

**Arquivo**: `src/lib/portfolio-analytics-service.ts`

#### Interfaces Principais:

```typescript
interface EvolutionPoint {
  date: string;
  value: number;           // Valor total da carteira
  invested: number;        // Total investido
  cashBalance: number;     // Saldo em caixa
  return: number;          // Retorno total (%)
  returnAmount: number;    // Retorno em reais
}

interface BenchmarkComparison {
  date: string;
  portfolio: number;   // Retorno acumulado (%)
  cdi: number;         // Retorno CDI (%)
  ibovespa: number;    // Retorno Ibovespa (%)
}

interface PortfolioAnalytics {
  evolution: EvolutionPoint[];
  benchmarkComparison: BenchmarkComparison[];
  monthlyReturns: { date: string; return: number }[];
  summary: {
    totalReturn: number;
    cdiReturn: number;
    ibovespaReturn: number;
    outperformanceCDI: number;
    outperformanceIbovespa: number;
    bestMonth: { date: string; return: number };
    worstMonth: { date: string; return: number };
    averageMonthlyReturn: number;
    volatility: number;
  };
}
```

#### Método Principal: `calculateAnalytics(portfolioId, userId)`

**Fluxo**:
1. **Busca transações confirmadas** ordenadas por data
2. **Calcula evolução mensal**:
   - Gera datas mensais desde primeira transação até hoje
   - Para cada data, aplica todas as transações até aquela data
   - Busca preços históricos dos ativos
   - Calcula valor total da carteira
3. **Compara com benchmarks**:
   - CDI: ~11.75% ao ano (taxa aproximada)
   - Ibovespa: ~8% ao ano (média histórica)
   - Usa juros compostos mensais
4. **Calcula retornos mensais**:
   - Variação percentual mês a mês
5. **Gera estatísticas resumidas**:
   - Melhor/pior mês
   - Média mensal
   - Volatilidade (desvio padrão)

### 2.2 API Endpoint

**Arquivo**: `src/app/api/portfolio/[id]/analytics/route.ts`

**Endpoint**: `GET /api/portfolio/[id]/analytics`

**Autenticação**: Requerida

**Response**:
```json
{
  "evolution": [...],
  "benchmarkComparison": [...],
  "monthlyReturns": [...],
  "summary": {
    "totalReturn": 15.5,
    "cdiReturn": 11.75,
    "ibovespaReturn": 8.0,
    "outperformanceCDI": 3.75,
    "outperformanceIbovespa": 7.5,
    "bestMonth": { "date": "2024-10-01", "return": 8.2 },
    "worstMonth": { "date": "2024-08-01", "return": -2.5 },
    "averageMonthlyReturn": 1.2,
    "volatility": 3.5
  }
}
```

### 2.3 Componente de Analytics

**Arquivo**: `src/components/portfolio-analytics.tsx`

#### Features:

1. **Cards de Resumo** (4 cards superiores):
   - Retorno Total
   - vs CDI
   - vs Ibovespa
   - Volatilidade

2. **Três Abas de Gráficos**:

   **a) Evolução do Patrimônio**
   - Gráfico de área (Area Chart)
   - Mostra Valor Total vs Investido
   - Eixo Y em milhares (k)
   - Tooltip com valores formatados

   **b) Comparação com Benchmarks**
   - Gráfico de linha (Line Chart)
   - 3 linhas: Carteira (sólida), CDI (tracejada), Ibovespa (tracejada)
   - Cards de Melhor/Pior Mês
   
   **c) Retornos Mensais**
   - Gráfico de barras (Bar Chart)
   - Mostra média mensal
   - Barras coloridas por performance

#### Integração

**Arquivo**: `src/components/portfolio-page-client.tsx`

```tsx
import { PortfolioAnalytics } from '@/components/portfolio-analytics';

<TabsContent value="analytics">
  <PortfolioAnalytics portfolioId={portfolio.id} />
</TabsContent>
```

---

## 🔧 3. Correção de Dados Históricos

### 3.1 Problema Identificado

Dados históricos estavam limitados até **2023-11-01**, não puxando o máximo disponível.

### 3.2 Solução Implementada

**Arquivo**: `src/lib/historical-data-service.ts`

#### Novo Parâmetro: `fetchMaximumAvailable`

```typescript
static async ensureHistoricalData(
  ticker: string,
  startDate: Date,
  endDate: Date,
  interval: '1mo' | '1wk' | '1d' = '1mo',
  fetchMaximumAvailable: boolean = false  // NOVO
): Promise<void>
```

**Lógica**:
- Se `fetchMaximumAvailable = true`, ajusta `startDate` para 20 anos atrás
- Garante buscar o máximo de dados disponíveis do Yahoo Finance

#### Novo Método Auxiliar: `fetchMaximumHistoricalData()`

```typescript
static async fetchMaximumHistoricalData(
  ticker: string,
  interval: '1mo' | '1wk' | '1d' = '1mo'
): Promise<void> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 20);
  
  await this.ensureHistoricalData(ticker, startDate, endDate, interval, true);
}
```

**Uso no PortfolioAnalyticsService**:
```typescript
await HistoricalDataService.fetchMaximumHistoricalData(ticker, '1mo');
```

---

## 📈 Fluxo Completo de Dividendos

### Quando um ativo paga dividendo:

1. **Background/On-Demand**:
   - `DividendService.fetchAndSaveDividends(ticker)` busca dados do Yahoo
   - Salva em `dividend_history`
   - Atualiza `Company.ultimoDividendo` e `dataUltimoDividendo`

2. **Ao Buscar Transações Sugeridas**:
   - `PortfolioTransactionService.getSuggestedTransactions()` chama
   - `generateDividendSuggestions(portfolioId, holdings, prices)`
   - Para cada ativo em custódia:
     - Busca dividendos do mês atual
     - Filtra por ex-date já passada
     - Gera sugestão de transação tipo `DIVIDEND`

3. **Usuário Confirma Transação**:
   - Transação `DIVIDEND` é confirmada
   - Aumenta `cashBalance`
   - Não afeta `totalInvested` (é rendimento, não aporte)

4. **Reflete em Analytics**:
   - Aparece nos gráficos de evolução
   - Não conta como aporte
   - Melhora o retorno percentual

---

## 📊 Fluxo Completo de Analytics

### Quando usuário acessa aba "Análises":

1. **Frontend Carrega**:
   ```tsx
   <PortfolioAnalytics portfolioId={id} />
   ```

2. **Fetch API**:
   ```javascript
   GET /api/portfolio/[id]/analytics
   ```

3. **Backend Processa**:
   - `PortfolioAnalyticsService.calculateAnalytics()`
   - Busca todas as transações confirmadas
   - Garante dados históricos de preços
   - Calcula evolução mês a mês
   - Compara com CDI e Ibovespa
   - Calcula estatísticas

4. **Frontend Renderiza**:
   - 4 cards de resumo
   - 3 abas com gráficos interativos (Recharts)
   - Tooltips formatados
   - Responsivo (mobile-friendly)

---

## 🎨 UI/UX Highlights

### Cards de Resumo
- **Retorno Total**: Verde/vermelho com ícone de tendência
- **vs CDI**: Mostra diferença e valor do CDI
- **vs Ibovespa**: Mostra diferença e valor do Ibovespa
- **Volatilidade**: Desvio padrão mensal

### Gráficos
- **Cores consistentes**: 
  - Azul (#8884d8) para carteira
  - Verde (#82ca9d) para investido/CDI
  - Amarelo (#ffc658) para Ibovespa
- **Gradientes** em área charts
- **Linhas tracejadas** para benchmarks
- **Tooltips formatados** em português
- **Responsive**: Adapta-se a diferentes tamanhos de tela

---

## 🔐 Segurança e Performance

### Autenticação
- Todos os endpoints verificam `getCurrentUser()`
- Apenas o dono da carteira pode acessar

### Performance
- **Parallel data fetch**: Busca histórico de todos os tickers em paralelo
- **Cache inteligente**: Usa `safeQueryWithParams` e `smart-query-cache`
- **Lazy loading**: Dados históricos são buscados apenas quando necessários
- **Upsert**: Evita duplicatas de dividendos

### Validações
- Verifica se portfolioId existe
- Verifica ownership do usuário
- Trata casos de carteiras vazias
- Fallbacks para dados ausentes

---

## 🧪 Como Testar

### 1. Testar Dividendos

1. **Adicione um ativo com histórico de dividendos** (ex: PETR4, VALE3)
2. **Execute manualmente**:
   ```typescript
   await DividendService.fetchAndSaveDividends('PETR4');
   ```
3. **Confirme algumas transações de compra** na carteira
4. **Espere até que um dividendo do mês atual tenha ex-date passada**
5. **Busque transações sugeridas**:
   - Deve aparecer sugestão de DIVIDEND
6. **Confirme a transação**:
   - Verifique que `cashBalance` aumentou
   - Confira na aba "Transações"

### 2. Testar Analytics

1. **Crie uma carteira com transações**
2. **Acesse a aba "Análises"**
3. **Verifique**:
   - Cards de resumo mostram valores corretos
   - Gráfico de evolução mostra crescimento
   - Benchmarks aparecem no gráfico
   - Retornos mensais são exibidos
   - Melhor/pior mês estão corretos

### 3. Testar Dados Históricos

1. **Inspecione banco de dados**:
   ```sql
   SELECT date, close FROM historical_prices 
   WHERE company_id = (SELECT id FROM companies WHERE ticker = 'PETR4')
   ORDER BY date DESC LIMIT 50;
   ```
2. **Verifique datas**:
   - Deve ter dados anteriores a 2023
   - Idealmente até 10-20 anos atrás

---

## 📝 Checklist de Implementação

- [x] Criar tabela `dividend_history` no schema
- [x] Adicionar campos `ultimoDividendo` e `dataUltimoDividendo` em `Company`
- [x] Criar `DividendService`
- [x] Integrar `DividendService` em `portfolio-transaction-service`
- [x] Atualizar `smart-query-cache` com mapeamentos
- [x] Criar `PortfolioAnalyticsService`
- [x] Criar endpoint `/api/portfolio/[id]/analytics`
- [x] Criar componente `PortfolioAnalytics` com gráficos
- [x] Integrar componente na página de carteira
- [x] Corrigir `HistoricalDataService` para buscar máximo de dados
- [x] Aplicar mudanças no banco com `npx prisma db push`

---

## 🚀 Próximos Passos Sugeridos

1. **Benchmarks Reais**:
   - Buscar dados reais do CDI de APIs (ex: BCB)
   - Buscar dados reais do Ibovespa (Yahoo Finance: ^BVSP)

2. **Mais Métricas**:
   - Sharpe Ratio
   - Sortino Ratio
   - Maximum Drawdown detalhado por período

3. **Filtros de Data**:
   - Permitir usuário escolher período de análise
   - YTD, 1Y, 3Y, 5Y, All Time

4. **Exportação**:
   - Exportar dados para CSV/Excel
   - Gerar PDF com relatório

5. **Alertas de Dividendos**:
   - Notificar usuário quando dividendo for pago
   - Dashboard de dividendos esperados

---

## 📚 Arquivos Modificados/Criados

### Schema e Database
- `prisma/schema.prisma` - Model DividendHistory e campos em Company

### Services (Backend)
- `src/lib/dividend-service.ts` ✨ NOVO
- `src/lib/portfolio-analytics-service.ts` ✨ NOVO
- `src/lib/historical-data-service.ts` - Melhorias
- `src/lib/portfolio-transaction-service.ts` - Integração de dividendos
- `src/lib/smart-query-cache.ts` - Mapeamentos

### API Endpoints
- `src/app/api/portfolio/[id]/analytics/route.ts` ✨ NOVO

### Components (Frontend)
- `src/components/portfolio-analytics.tsx` ✨ NOVO
- `src/components/portfolio-page-client.tsx` - Integração

### Documentation
- `PORTFOLIO_ENHANCEMENTS_DIVIDENDS_ANALYTICS.md` ✨ NOVO

---

## 📄 Comandos Executados

```bash
# Aplicar mudanças no banco
npx prisma db push

# Gerar Prisma Client
npx prisma generate
```

---

**Data de Implementação**: 20 de Outubro de 2025  
**Versão**: 2.0  
**Status**: ✅ Completo

