# Implementação: Engine de Índices Preço Justo (IPJ)

## Visão Geral

Sistema de índices teóricos automatizados que calculam performance de carteiras baseadas em algoritmos quantitativos. O MVP será o IPJ-VALUE (Deep Value Investing).

## Arquitetura

### 1. Schema do Banco de Dados (Prisma)

**Arquivo**: `prisma/schema.prisma`

Adicionar 4 novos models:

- `IndexDefinition`: Definição do índice (ticker, nome, metodologia, config JSON)
- `IndexComposition`: Carteira atual do índice (snapshot dos ativos que compõem hoje)
- `IndexHistoryPoints`: Série temporal de pontos do índice (para gráficos)
- `IndexRebalanceLog`: Log de auditoria de trocas de ativos

**Campos críticos**:

- `IndexDefinition.config` (JSON): Armazena regras de screening dinâmicas
- `IndexHistoryPoints.points`: Valor do índice (base 100)
- `IndexComposition.targetWeight`: Peso alvo de cada ativo (equal weight = 0.10)

### 2. Engine de Cálculo de Índices

**Arquivo**: `src/lib/index-engine.ts` (NOVO)

**Responsabilidades**:

- Calcular variação diária do índice usando fórmula: `R_t = Σ(w_{i,t-1} × r_{i,t})`
- Atualizar pontos: `Pontos_hoje = Pontos_ontem × (1 + R_t)`
- Calcular DY médio ponderado da carteira
- Detectar lacunas no histórico e preencher retroativamente

**Métodos principais**:

- `calculateDailyReturn(indexId, date)`: Calcula retorno do dia
- `updateIndexPoints(indexId, date)`: Atualiza pontos do índice
- `fillMissingHistory(indexId)`: Preenche dias faltantes

### 3. Engine de Screening e Rebalanceamento

**Arquivo**: `src/lib/index-screening-engine.ts` (NOVO)

**Responsabilidades**:

- Executar query de screening baseada no `config` do índice
- Comparar resultado ideal vs composição atual
- Decidir trocas baseado em regras (ex: upside > 5% vs 10º colocado)
- Atualizar `IndexComposition` e criar logs em `IndexRebalanceLog`

**Métodos principais**:

- `runScreening(indexDefinition)`: Executa screening baseado em config
- `compareComposition(current, ideal)`: Compara e identifica mudanças
- `shouldRebalance(current, ideal, threshold)`: Decide se rebalanceia
- `updateComposition(indexId, newComposition)`: Atualiza carteira

**Sistema de Config JSON**:

O campo `config` do `IndexDefinition` deve suportar queries dinâmicas sobre:

- Tabela `companies` e todas suas relações (FinancialData, BalanceSheet, IncomeStatement, etc)
- Campos disponíveis: ROE, margemLiquida, dividaLiquidaEbitda, marketCap, volume médio, etc
- Operadores: `gte`, `lte`, `gt`, `lt`, `equals`, `in`, `not`
- Ordenação: Por upside (fairValue - currentPrice), DY, etc

### 4. Cron Jobs Diários

**Arquivo**: `src/app/api/cron/update-indices/route.ts` (NOVO)

**Job 1: Mark-to-Market (19:00h)**

- Buscar cotações de fechamento (API B3 ou via `quote-service.ts` como fallback)
- **CRÍTICO**: O JOB precisa ser tolerante a falha. Caso não execute em um dia ou execute com erro, na próxima execução deve detectar lacunas e CALCULAR os dias faltantes retroativamente
- Calcular variação ponderada (R_t) de cada índice ativo usando fórmula: `R_t = Σ(w_{i,t-1} × r_{i,t})`
- Calcular DY Médio ponderado da carteira atual (para fins de exibição)
- Salvar novo registro em `IndexHistoryPoints` com `points`, `dailyChange` e `currentYield`

**Job 2: Engine de Regras (19:30h) - A "IA"**

- Rodar query de screening baseada no `config` do índice
- **IMPORTANTE**: A config deve levar em conta TODOS os dados da tabela companies e suas associações (relações). Todos os dados existentes devem ser possíveis de configurar
- Comparar resultado ideal com a `IndexComposition` atual
- Se necessário: Atualizar `IndexComposition` e criar log em `IndexRebalanceLog` com `action`, `ticker` e `reason` (texto explicativo gerado pela IA)

**Configuração**: Adicionar ao `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-indices?job=mark-to-market",
      "schedule": "0 19 * * *"
    },
    {
      "path": "/api/cron/update-indices?job=screening",
      "schedule": "30 19 * * *"
    }
  ]
}
```

### 5. API Endpoints

**Arquivo**: `src/app/api/indices/route.ts` (NOVO)

- `GET /api/indices`: Lista todos os índices com performance atual
- `GET /api/indices/[ticker]/route.ts`: Detalhes de um índice específico
- `GET /api/indices/[ticker]/history`: Histórico de pontos
- `GET /api/indices/[ticker]/composition`: Composição atual
- `GET /api/indices/[ticker]/rebalance-log`: Timeline de mudanças

### 6. Serviço de Integração com Estratégias

**Arquivo**: `src/lib/index-strategy-integration.ts` (NOVO)

**Responsabilidades**:

- Integrar com `StrategyFactory` para calcular fairValue/upside
- Usar `quote-service.ts` para preços atuais
- Usar `company-analysis-service.ts` para dados completos
- Calcular volume médio diário (liquidez) a partir de `HistoricalPrice`

**Métodos**:

- `calculateUpside(ticker)`: Calcula upside usando estratégias existentes
- `getAverageDailyVolume(ticker, days)`: Calcula volume médio
- `getCompanyFinancials(ticker)`: Busca dados financeiros completos

### 7. UI/UX - Dashboard de Índices

**Arquivo**: `src/app/indices/page.tsx` (NOVO)

**Tela 1: Dashboard**

- Cards com nome, pontuação atual, rentabilidade acumulada
- Sparkline (mini gráfico) de tendência
- Link para detalhes

**Componentes**:

- `src/components/indices/index-card.tsx`: Card de índice
- `src/components/indices/index-sparkline.tsx`: Mini gráfico

### 8. UI/UX - Detalhe do Índice

**Arquivo**: `src/app/indices/[ticker]/page.tsx` (NOVO)

**Seções**:

- **A. Cabeçalho de Performance**: Retorno total estimado (valorização + DY médio)
- **B. Gráfico Comparativo**: Gráfico com IPJ vs IBOVESPA/CDI
- **C. Lista de Ativos**: Tabela com ticker, peso, preço entrada, DY atual
- **D. Timeline de Gestão**: Componente vertical com últimas trocas

**Componentes**:

- `src/components/indices/index-performance-header.tsx`
- `src/components/indices/index-comparison-chart.tsx`
- `src/components/indices/index-composition-table.tsx`
- `src/components/indices/index-rebalance-timeline.tsx`

**Feature Premium**: Borrar lista de ativos para usuários Free

### 9. Painel Admin - Criação de Índices

**Arquivo**: `src/app/admin/indices/page.tsx` (NOVO)

**Funcionalidades**:

- Listar índices existentes
- Criar novo índice com formulário visual
- Editor de configuração JSON com validação
- Preview de campos disponíveis (tabela companies + relações)
- Testar screening antes de criar

**Componentes**:

- `src/components/admin/index-manager.tsx`: Gerenciador principal
- `src/components/admin/index-config-builder.tsx`: Builder visual de config
- `src/components/admin/index-field-reference.tsx`: Referência de campos disponíveis

**Campos disponíveis**: Documentar todos os campos de `companies` e relações no componente de referência.

### 10. Setup Inicial do IPJ-VALUE

**Script**: `scripts/setup-ipj-value.ts` (NOVO)

**Responsabilidades**:

- Criar registro inicial em `IndexDefinition` com config do IPJ-VALUE
- Executar primeiro screening para definir composição inicial
- Criar primeiro ponto histórico (base 100)
- Registrar data de criação

**Config IPJ-VALUE** (exemplo):

```json
{
  "type": "VALUE",
  "universe": "B3",
  "liquidity": {
    "minAverageDailyVolume": 2000000
  },
  "quality": {
    "roe": { "gte": 0.10 },
    "margemLiquida": { "gte": 0.05 },
    "dividaLiquidaEbitda": { "lte": 3.0 }
  },
  "selection": {
    "topN": 10,
    "orderBy": "upside",
    "orderDirection": "desc"
  },
  "weights": {
    "type": "equal",
    "value": 0.10
  },
  "rebalance": {
    "threshold": 0.05,
    "checkQuality": true
  }
}
```

### 11. Integração com Smart Query Cache

**Arquivo**: `src/lib/smart-query-cache.ts`

**Atualizações necessárias**:

- Adicionar mapeamentos para novos models:
  - `indexDefinition` -> `index_definitions`
  - `indexComposition` -> `index_compositions`
  - `indexHistoryPoints` -> `index_history_points`
  - `indexRebalanceLog` -> `index_rebalance_logs`
- Adicionar dependências de cache:
  - `index_compositions` depende de `companies`, `daily_quotes`
  - `index_history_points` depende de `index_definitions`, `daily_quotes`

### 12. Benchmark Data (IBOVESPA/CDI)

**Arquivo**: `src/lib/benchmark-service.ts` (NOVO)

**Responsabilidades**:

- Buscar dados históricos do IBOVESPA (via API externa ou banco)
- Buscar dados históricos do CDI
- Normalizar para base 100 na mesma data do índice
- Fornecer dados para gráficos comparativos

**Nota**: Pode usar dados públicos ou integrar com API de índices da B3.

### 13. Disclaimer Jurídico

**Componente**: `src/components/indices/index-disclaimer.tsx` (NOVO)

**Texto obrigatório**:

"Os índices da família Preço Justo (IPJ) são carteiras teóricas automatizadas, geradas estritamente por algoritmos matemáticos baseados em dados públicos. A inclusão de um ativo no índice não configura recomendação de investimento, compra ou venda, nem leva em consideração o perfil de risco do usuário. Rentabilidade passada não é garantia de resultados futuros."

**Uso**: Exibir em todas as páginas de índices (rodapé de gráficos e tabelas).

## Ordem de Implementação

1. **Fase 1: Schema e Models** (Prisma)

   - Criar 4 models no schema.prisma
   - Rodar migration
   - Atualizar smart-query-cache.ts

2. **Fase 2: Engine de Cálculo**

   - Implementar index-engine.ts
   - Implementar index-screening-engine.ts
   - Implementar index-strategy-integration.ts

3. **Fase 3: Cron Jobs**

   - Implementar endpoint de cron
   - Configurar vercel.json
   - Testar mark-to-market e screening

4. **Fase 4: Setup Inicial**

   - Criar script setup-ipj-value.ts
   - Executar setup inicial
   - Validar dados

5. **Fase 5: APIs**

   - Implementar endpoints REST
   - Testar queries e performance

6. **Fase 6: UI Dashboard**

   - Implementar página de listagem
   - Implementar página de detalhes
   - Adicionar gráficos comparativos

7. **Fase 7: Admin Panel**

   - Implementar gerenciador de índices
   - Implementar builder de config
   - Documentar campos disponíveis

8. **Fase 8: Benchmark**

   - Implementar benchmark-service.ts
   - Integrar dados no gráfico comparativo

9. **Fase 9: Polish**

   - Adicionar disclaimer
   - Otimizar performance
   - Testes finais

## Considerações Técnicas

- **Performance**: Queries de screening podem ser pesadas. Considerar cache e otimizações.
- **Tolerância a Falhas**: Cron jobs devem ser idempotentes e preencher lacunas automaticamente.
- **Escalabilidade**: Sistema deve suportar múltiplos índices sem impacto de performance.
- **Compliance**: Disclaimer sempre visível, metodologia transparente.
- **Premium Features**: Lista de ativos borrada para usuários Free.

## Dependências Externas

- Yahoo Finance API (via quote-service.ts) para cotações
- Dados históricos do IBOVESPA (a definir fonte)
- Dados históricos do CDI (a definir fonte)

## Arquivos a Criar

1. `prisma/schema.prisma` (modificar)
2. `src/lib/index-engine.ts`
3. `src/lib/index-screening-engine.ts`
4. `src/lib/index-strategy-integration.ts`
5. `src/lib/benchmark-service.ts`
6. `src/app/api/cron/update-indices/route.ts`
7. `src/app/api/indices/route.ts`
8. `src/app/api/indices/[ticker]/route.ts`
9. `src/app/api/indices/[ticker]/history/route.ts`
10. `src/app/api/indices/[ticker]/composition/route.ts`
11. `src/app/api/indices/[ticker]/rebalance-log/route.ts`
12. `src/app/indices/page.tsx`
13. `src/app/indices/[ticker]/page.tsx`
14. `src/components/indices/index-card.tsx`
15. `src/components/indices/index-sparkline.tsx`
16. `src/components/indices/index-performance-header.tsx`
17. `src/components/indices/index-comparison-chart.tsx`
18. `src/components/indices/index-composition-table.tsx`
19. `src/components/indices/index-rebalance-timeline.tsx`
20. `src/components/indices/index-disclaimer.tsx`
21. `src/app/admin/indices/page.tsx`
22. `src/components/admin/index-manager.tsx`
23. `src/components/admin/index-config-builder.tsx`
24. `src/components/admin/index-field-reference.tsx`
25. `scripts/setup-ipj-value.ts`
26. `vercel.json` (modificar)

## Arquivos a Modificar

1. `prisma/schema.prisma` - Adicionar 4 models
2. `src/lib/smart-query-cache.ts` - Adicionar mapeamentos
3. `vercel.json` - Adicionar cron jobs