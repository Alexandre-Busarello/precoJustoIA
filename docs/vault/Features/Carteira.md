---
tags: [feature, carteira]
updated: 2026-10-09
fontes: [src/app/carteira/, src/components/portfolio-*.tsx, src/lib/portfolio-service.ts, src/lib/portfolio-transaction-service.ts, src/lib/portfolio-metrics-service.ts, src/lib/portfolio-analytics-service.ts, src/lib/portfolio-cache.ts, src/app/api/portfolio/route.ts]
---
# Carteira
> Carteiras do usuário com transações, posições, rentabilidade (TWR, XIRR, Sharpe com CDI), proventos sugeridos e ajustes para a alocação-alvo definida por ele.

## Como funciona
- Rotas: `/carteira` (lista, `portfolio-list-page.tsx`), `/carteira/nova`, `/carteira/tutorial` e `/carteira/[id]`, com as abas `transacoes`, `analise`, `config` e `sugestoes` (`portfolio-tabs.tsx`, `portfolio-page-shell.tsx`).
- Posições: `portfolio-holdings-table.tsx`, com cards no mobile e `DataTable` com ticker fixo no desktop. Coluna yield on cost = proventos TTM ÷ custo médio.
- Transações: `portfolio-transaction-form.tsx` (`inputMode='decimal'`, máscara BRL em `portfolio-money-input.tsx`), entrada inteligente (`portfolio-smart-input.tsx`), importação por IA (`portfolio-transaction-ai.tsx`, `/api/portfolio/transaction-ai`) e assistente (`portfolio-ai-assistant.tsx`).
- Proventos: sugestões de DIVIDEND calculadas de `DividendHistory` × posição na data-ex, com JCP líquido e dedupe; nunca gravadas sem confirmação (`src/lib/portfolio-transaction-service.ts`).
- Métricas: `src/lib/portfolio-analytics-service.ts` (TWR por cota, XIRR, retorno sobre capital investido, volatilidade, Sharpe com CDI do mesmo período, drawdown); `portfolio-analytics.tsx` com carteira em `chart-1` e CDI/IBOV/IPCA tracejados.
- Sugestões: `portfolio-suggestions-page.tsx` mostra "Ajuste para sua alocação-alvo" (o alvo é do próprio usuário). Rebalanceamento em `portfolio-rebalancing-combined-form.tsx`.
- Integrações: backtest → carteira (`/api/portfolio/from-backtest`), [[Onde aportar]] (aporte registrado), [[Agenda de proventos]].
- Cache no cliente: `src/lib/portfolio-cache.ts` (ver [[Caches]]).

## Regras / limites
- **Free:** 1 carteira (`POST /api/portfolio` responde 403 "Usuários gratuitos estão limitados a 1 carteira"). **Premium:** ilimitadas.
- Retorno só com cor semântica; sem "Comprar/Vender" como sinal ([[Compliance CVM]]).

## Histórico nas ondas
- [[Onda 1]]: `4c65a67` (cards no mobile, tabelas, formulários, AlertDialog no lugar de `confirm()`).
- [[Onda 2]]: `47df9e2` (TWR/XIRR, Sharpe com CDI, IPCA) e `f77fd79` (proventos sugeridos, yield on cost).
- [[Onda 3]]: compras do [[Onde aportar]] ligadas à carteira (`407e805`).
- [[Onda 6]]: contexto de carteira e "Perguntar ao Ben" nas posições.

## Pendências
- Dono: as sugestões automáticas com o caixa ficaram mais rigorosas e podem deixar caixa parado.
- Compras pendentes do Onde aportar não entram nas sugestões automáticas; descartar uma compra registrada deixa o "Aporte registrado" órfão.

## Relacionadas
[[Onde aportar]] · [[Backtest]] · [[Agenda de proventos]] · [[Ben]] · [[Planos e preços]]
