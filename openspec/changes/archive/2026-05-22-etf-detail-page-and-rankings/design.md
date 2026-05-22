## Context

A plataforma já possui pipeline completo de ingestão ETF (2 fases + scoring). O banco tem 99 ETFs com `etfScore` calculado e dados em `EtfData` (taxa, retorno, benchmark, netAssets, holdingsConcentrationTop5) e `EtfHolding` (participações com `companyId` e `weight`). As páginas `/acoes/[ticker]` e `/fii/[ticker]` são a referência arquitetural. A busca global usa `GET /api/search-companies?q=` filtrado em `assetType IN ['STOCK','BDR','FII']`.

## Goals / Non-Goals

**Goals:**
- Entregar `/etf/[ticker]` com dados dos modelos `EtfData` + `EtfHolding` + cotação atual via BRAPI
- Habilitar ETFs na busca global com link correto para `/etf/[ticker]`
- Criar estratégia e presets de ranking ETF reutilizando `etfScore` existente

**Non-Goals:**
- Calculadora de aportes ou dividendos com ETFs
- Scraping adicional de dados — nenhuma nova fonte de dados
- Comparativo entre ETFs

## Decisions

### 1. Página ETF — Server Component sem camada de API própria

**Decisão**: A página `/etf/[ticker]/page.tsx` fará query Prisma diretamente (Server Component), igual ao padrão FII. Não criar rota API `/api/etf/[ticker]` separada por enquanto.

**Rationale**: Páginas de ativo na plataforma são Server Components com queries diretas. Adicionar rota API agora seria over-engineering — a única rota necessária seria se houvesse client-side fetch, o que não é o caso.

**Cotação atual**: A página buscará o preço atual via `HistoricalPrice` (mais recente com `interval='1d'`) do banco — sem chamada síncrona ao BRAPI no render, evitando timeout de 60s no Vercel.

**Cache**: `etf:<ticker>:page` com TTL de 1h via `cache-service` — mesmo padrão do FII.

### 2. Score e dimensões — exibição via `etfScore` + campo `scoreDimensions`

**Decisão**: O campo `etfScore` (INT) já existe em `EtfData`. As dimensões (custo, retorno, liquidez, solidez, qualidadeCarteira, concentracaoPenalty) **não** estão armazenadas — são recalculadas on-demand via `calculateEtfScore()` na página.

**Alternativa considerada**: Adicionar coluna `scoreDimensions` JSON no Prisma. Rejeitado por aumentar escopo (migration + schema change) sem necessidade imediata — o recálculo é rápido (operações locais, sem I/O extra).

### 3. Busca global — adicionar 'ETF' ao filtro existente + rota de navegação

**Decisão**: Editar `src/app/api/search-companies/route.ts` para incluir `'ETF'` no array `assetType`. No `GlobalSearchBar`, adicionar case para `ETF` que navega para `/etf/[ticker]`.

**Rationale**: Mudança mínima e cirúrgica — sem quebrar busca existente. ETFs aparecem com badge "ETF" no resultado.

### 4. Ranking ETF — nova estratégia + presets + aba/filtro na página de ranking

**Decisão**: Criar `src/lib/strategies/etf-ranking-strategy.ts` (classe `EtfRankingStrategy`) que consulta `EtfData` ordenando por `etfScore`. Adicionar presets ETF em arquivo dedicado `src/lib/etf-ranking-presets.ts`. A página `/ranking` ganha seletor de tipo de ativo (Ações | FIIs | ETFs) que alterna qual estratégia/preset usar.

**Rationale**: Segue exatamente o padrão da `FiiRankingStrategy`. ETF ranking é leve — nenhum cálculo de valuation, apenas ranking por score/campos pré-calculados.

**Presets iniciais**:
- `etfs-melhor-score-geral` — Top ETFs por etfScore
- `etfs-menor-taxa-administracao` — Menor netExpenseRatio com etfScore ≥ 40
- `etfs-maior-retorno-1a` — Maior return1y (com fallback return6m)
- `etfs-renda-fixa` — Benchmark contém "Selic", "IPCA", "IRF-M"

### 5. Acesso FREE vs PREMIUM

- Página ETF: **FREE** (score, retornos, taxa, benchmark). Holdings das empresas: **FREE** limitado a top 5; PREMIUM vê todas.
- Busca ETF: **FREE**
- Ranking ETF: top 10 resultados **FREE**; ilimitado **PREMIUM** (igual ao ranking de ações)

## Risks / Trade-offs

- [ETFs sem score na página] Página deve funcionar mesmo para os 16 ETFs sem `etfScore` — exibir dados disponíveis e omitir seção de score com aviso "Dados insuficientes para calcular score".
- [Holdings sem companyId] ~30% dos holdings podem não ter `companyId` (empresa não cadastrada) — exibir com ticker/nome do ETF1 sem link.
- [Cotação ausente] Se `HistoricalPrice` não tiver registro recente, exibir "—" sem quebrar a página.
- [Ranking ETF vazio para novos usuários] 16 ETFs sem score aparecem fora do ranking — documentar isso como comportamento esperado.
