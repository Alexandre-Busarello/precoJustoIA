---
tags: [arquitetura, cache]
updated: 2026-10-09
fontes: [src/lib/cache-service.ts, src/lib/rate-limit-cache-service.ts, src/lib/smart-query-cache.ts, src/lib/portfolio-cache.ts, src/lib/index-realtime-cache.ts, src/lib/react-query-persister.ts, src/app/api/company-analysis/[ticker]/route.ts, src/lib/ibov-projections/service.ts]
---
# Caches
> Redis é o cache principal no servidor, com fallback em memória; o rate limit usa um Redis separado. No cliente, React Query e localStorage.

## Como funciona
**Servidor**
- `src/lib/cache-service.ts` — cache unificado: Redis (`REDIS_URL`) com fallback automático em memória, serialização automática e prefixo por chave. Pensado para serverless: desconecta após 10 s ocioso (`REDIS_IDLE_TIMEOUT`) e, com `REDIS_DISCONNECT_AFTER_OP=true`, após cada operação. Sem `REDIS_URL`, só memória.
- `src/lib/rate-limit-cache-service.ts` — Redis dedicado (`REDIS_RATE_LIMIT_URL`) para não disputar com o cache geral. Usado pelo [[Middleware e rate limit]]. O `process.on` de limpeza é guardado (`typeof processRef?.on === 'function'`) porque o Edge não tem `process.on`.
- `src/lib/smart-query-cache.ts` — cache de SELECTs do Prisma (TTL de 1 h) com invalidação por tabela nas escritas; usado em `asset-monitoring-service.ts`, `ai-reports-service.ts`, `rank-builder-service.ts` e outros.
- Chaves versionadas: `company-analysis:v6:<ticker>:<logged|anon>:<premium|free>` (`src/app/api/company-analysis/[ticker]/route.ts`); sobe a versão quando os parâmetros mudam (v6 em `3836ac7`, onda 5).
- Por pregão: projeções do IBOV em cache por dia e fase do pregão, com versão de formato (`src/lib/ibov-projections/service.ts`); sinais de preço do screening ("queda com fundamentos") por pregão (`src/app/api/rank-builder/route.ts`); radar explore por dia e plano (`radar-explore:<plano>:<dia>` em `src/app/api/radar/explore/route.ts`).
- `src/lib/index-realtime-cache.ts` — retorno em tempo real dos índices; com mercado fechado guarda até 10h do dia seguinte (Brasília).
- ISR/`revalidate` do Next em poucas rotas: `/metodologia` (3600), `/indices` e `/indices/[ticker]` (60), `/api/indices` (30), `/api/pl-bolsa` (3600).

**Cliente**
- `src/lib/react-query-persister.ts` — persiste queries do React Query no localStorage.
- `src/lib/portfolio-cache.ts` — cache da carteira no localStorage (analytics, métricas, posições, transações, sugestões; dividendos com TTL de 24 h).

## Regras / limites
- Falha no contador de rate limit nunca derruba a API (fail open, `src/middleware.ts`).
- Caches de IA pré-calculados no seed local evitam chamadas ao Gemini (`scripts/local/README.md`).

## Histórico nas ondas
- [[Onda 3]]: cache por pregão do screening e das faixas do IBOV.
- [[Onda 5]]: guarda do `process.on`; `company-analysis` v6 após unificar parâmetros página × ranking.

## Pendências
- Não verifiquei TTLs de cada chave individual de `cacheService` espalhadas pelo código.

## Relacionadas
[[Middleware e rate limit]] · [[Stack]] · [[Ranking]] · [[Screening]] · [[IBOV faixas estatísticas]]
