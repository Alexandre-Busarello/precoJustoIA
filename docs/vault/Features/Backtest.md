---
tags: [feature, backtest]
updated: 2026-10-09
fontes: [src/app/backtest/page.tsx, src/components/backtest-page-client.tsx, src/components/backtest-config-form.tsx, src/components/backtest-results.tsx, src/lib/adaptive-backtest-service.ts, src/lib/benchmark-service.ts, src/app/api/backtest/]
---
# Backtest
> Simula uma carteira no passado com proventos reais e compara com CDI, IBOV e IPCA. Landing pública para visitantes, ferramenta só para Premium.

## Como funciona
- `src/app/backtest/page.tsx`: visitante vê a landing (`backtest-landing.tsx`, 200 e indexável); logado sem Premium vê `backtest-upgrade-card.tsx`; Premium vê a ferramenta (`src/components/backtest-page-client.tsx`).
- Abre com a carteira de exemplo (PETR4, VALE3, ITUB4, WEGE3, BBAS3, pesos iguais, 5 anos, R$ 10.000; `example-portfolio-card.tsx`). "Minhas configurações" é uma aba.
- APIs: `/api/backtest/config` (upsert via `upsertBacktestConfig`), `/configs`, `/run`, `/historical-data`, `/validate`.
- Motor: `src/lib/adaptive-backtest-service.ts`. Proventos reais de `DividendHistory` creditados na data-ex (JCP líquido), sem o crédito sintético por `averageDividendYield`. Custo de 0,03% por operação mostrado como premissa.
- Benchmarks (`src/lib/benchmark-service.ts`): CDI com fatores diários compostos, IBOV, IPCA e IPCA+6%.
- Resultados: Stats neutros, gráfico com carteira em `chart-1` e benchmarks tracejados, tabelas em `DataTable`.
- `/backtesting-carteiras` → 308 `/backtest` (`next.config.ts`).

## Regras / limites
- **Free:** sem acesso (`/api/backtest/run` responde "Backtesting exclusivo para usuários Premium"). **Premium:** completo.

## Histórico nas ondas
- [[Onda 1]]: `9f3ac36` (landing pública, sem redirects 307 no layout, carteira de exemplo).
- [[Onda 2]]: `47df9e2` (dividendos reais, Sharpe com CDI, TWR/XIRR, IPCA).
- [[Onda 5]]: `44aa012` (a carteira de exemplo não duplica a cada execução; DY legado removido do formulário).
- [[Onda 6]]: contexto de backtest para o [[Ben]].

## Pendências
- Nenhuma aberta no RESUME.

## Relacionadas
[[Carteira]] · [[Ranking]] · [[Fontes de dados]] · [[Ben]]
