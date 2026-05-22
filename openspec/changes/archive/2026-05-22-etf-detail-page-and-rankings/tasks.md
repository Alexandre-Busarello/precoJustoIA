## 1. Busca Global — Habilitar ETFs

- [x] 1.1 Em `src/app/api/search-companies/route.ts`, adicionar `'ETF'` ao array `assetType` no filtro Prisma
- [x] 1.2 No componente `GlobalSearchBar`, adicionar case `ETF` para navegar para `/etf/[ticker]` ao clicar no resultado
- [x] 1.3 Adicionar badge "ETF" (cor distinta de STOCK e FII) no item de resultado da busca para ETFs

## 2. Estratégia e Presets de Ranking ETF

- [x] 2.1 Criar `src/lib/strategies/etf-ranking-strategy.ts` com classe `EtfRankingStrategy` que busca `EtfData` (com `company`) filtrados por `etfScore IS NOT NULL`, ordenando por `etfScore` DESC por padrão
- [x] 2.2 Criar `src/lib/etf-ranking-presets.ts` com 4 presets: `etfs-melhor-score-geral`, `etfs-menor-taxa-administracao`, `etfs-maior-retorno-1a`, `etfs-renda-fixa`
- [x] 2.3 Criar rota `src/app/api/etf-ranking/route.ts` (POST) que recebe `{ preset: string, limit?: number }` e retorna lista de ETFs com os campos do ranking (ticker, nome, score, taxa, retorno, benchmark)

## 3. Seletor de Tipo de Ativo no Ranking

- [x] 3.1 Na página `src/app/ranking/page.tsx`, adicionar estado/tabs para seleção de tipo de ativo (Ações | FIIs | ETFs)
- [x] 3.2 Quando "ETFs" estiver selecionado, exibir os 4 presets de ETF e usar a rota `/api/etf-ranking`
- [x] 3.3 Limitar resultados a 10 para FREE, ilimitado para PREMIUM (replicar lógica já existente)
- [x] 3.4 Tornar cada resultado do ranking ETF clicável, navegando para `/etf/[ticker]`

## 4. Página ETF — Dados e API

- [x] 4.1 Criar `src/app/etf/[ticker]/page.tsx` como Server Component que busca `EtfData` + `Company` + `EtfHolding` (com `company` vinculada) + cotação atual via `HistoricalPrice` mais recente
- [x] 4.2 Implementar 404 se ticker não encontrado ou `assetType !== 'ETF'`
- [x] 4.3 Recalcular dimensões do score on-demand via `calculateEtfScore()` importado de `src/lib/etf-scoring.ts`
- [x] 4.4 Adicionar cache `etf:<ticker>:page` com TTL 1h via `cache-service`

## 5. Página ETF — Interface

- [x] 5.1 Criar seção de cabeçalho com logo da empresa, ticker, nome e badge "ETF"
- [x] 5.2 Criar card de score com nota geral (etfScore) e barra de progresso para cada dimensão (custo, retorno, liquidez, solidez, qualidade da carteira)
- [x] 5.3 Criar card de dados principais: taxa de administração, benchmark, patrimônio líquido (netAssets), concentração top 5 (holdingsConcentrationTop5)
- [x] 5.4 Criar card de retornos: tabela ou badges com 6m, 1a, 3a, 5a (formato "+29,9%", com cor verde/vermelho)
- [x] 5.5 Criar tabela de holdings: ticker/nome, peso (%), link para `/acoes/[ticker]` se companyId vinculado; FREE vê top 5, PREMIUM vê todas
- [x] 5.6 Exibir aviso "Score indisponível — histórico de retorno insuficiente" quando `etfScore` for null, sem quebrar o layout
- [x] 5.7 Adicionar link de volta (`← Ranking de ETFs`) no topo da página

## 6. SEO e Metadados

- [x] 6.1 Implementar `generateMetadata()` na página ETF com title e description dinâmicos baseados no ticker e benchmark
- [x] 6.2 Atualizar sitemap ou rota de sitemaps para incluir URLs `/etf/[ticker]` dos ETFs ativos
