## Why

A plataforma já coleta e pontua 99 ETFs com score composto (custo, retorno, liquidez, solidez, qualidade de carteira), mas o investidor não consegue explorar esses dados — não há página individual de ETF, ETFs não aparecem na busca global e não há rankings dedicados. Usuários como criadores de conteúdo e investidores em ETFs (BOVA11, NSDV11, POSB11) ficam sem visibilidade sobre os ativos que já têm cobertura.

## What Changes

- **Nova rota `/etf/[ticker]`**: página de análise individual do ETF com score, dimensões do score, retornos históricos, taxa de administração, benchmark, patrimônio líquido, e tabela de holdings com peso e score das empresas subjacentes.
- **Busca global habilitada para ETFs**: o input de busca já existente na plataforma passa a incluir ETFs ativos (assetType=ETF) nos resultados.
- **Rankings de ETF na página `/ranking`**: novas estratégias (presets) dedicadas a ETFs — Menor Custo, Maior Retorno 1A, Melhor Score Geral, por Benchmark — separadas dos rankings de ações e FIIs.

## Capabilities

### New Capabilities
- `etf-detail-page`: Página `/etf/[ticker]` com dados completos do ETF: score e suas 5 dimensões, retornos (6m/1a/3a/5a), taxa de administração, benchmark, patrimônio líquido (netAssets), holdingsConcentrationTop5, e tabela de participações principais com link para a página da empresa.
- `etf-ranking`: Presets de ranking exclusivos para ETFs na página `/ranking` (ou sub-aba ETFs), usando o etfScore e campos de EtfData para ordenação e filtragem. Estratégias iniciais: Melhor Score, Menor Taxa, Maior Retorno 1A, por Benchmark.

### Modified Capabilities
- `ranking`: Adição de presets e asset-type filter para ETFs. Sem quebra de comportamento existente para ações/FIIs — ETFs aparecem somente quando o filtro ETF está selecionado.

## Non-goals

- Calculadora de aportes ou dividendos para ETFs (escopo futuro).
- Comparativo entre ETFs (escopo futuro).
- Ingestão de novos dados — usa apenas o que já está no banco (EtfData + EtfHolding + AssetSnapshot).

## Impact

- **Novas rotas**: `src/app/etf/[ticker]/page.tsx`, `src/app/api/etf/[ticker]/route.ts`
- **Busca global**: `src/components/SearchInput.tsx` (ou equivalente) — adicionar assetType ETF na query
- **Rankings**: `src/lib/screening-presets.ts` (ou equivalente) — novos presets ETF; `src/app/ranking/page.tsx` — filtro de tipo de ativo
- **Tier afetado**: FREE — score e página básica disponíveis; PREMIUM — holdings detalhadas e rankings sem limite de resultados
