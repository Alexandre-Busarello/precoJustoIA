---
tags: [feature, ranking]
updated: 2026-10-09
fontes: [src/app/ranking/page.tsx, src/app/ranking/ranking-client.tsx, src/lib/ranking-models.ts, src/components/quick-ranker.tsx, src/components/ranking-wizard/, src/app/api/rank-builder/route.ts, src/lib/rank-builder-service.ts]
---
# Ranking
> `/ranking` abre direto num ranking útil (Graham, grátis) e troca de modelo por um registro tipado; os parâmetros ficam num painel recolhível.

## Como funciona
- `src/app/ranking/page.tsx` (servidor, metadata e canonical `/ranking`) + `ranking-client.tsx` (UI).
- Registro de modelos: `src/lib/ranking-models.ts` (`key`, `label`, `plan`, `assetType`, sliders, `defaults`, `score`). Modelos de ação: `graham`, `dividendYield` ([[Anti-armadilha]]), `lowPE` ([[P-L baixo]]), `magicFormula` ([[Fórmula Mágica]]), `fcd` ([[FCD]]), `gordon` ([[Gordon]]), `fundamentalist` ([[Estratégia 3+1]]), `barsi` ([[Barsi]]), `bazin` ([[Bazin]]), `lynch` ([[Lynch]]), `ai` (síntese com IA). FIIs: `fiiDividendYield`, `fiiRanking`. ETFs: presets do [[ETF score]]. O P/VP justo de bancos ([[P-VP bancos]]) não é modelo do registro: sai na análise da empresa (`1e188da`).
- Execução: `POST /api/rank-builder` → `src/lib/rank-builder-service.ts` e `src/lib/strategies/*`. Resultados em `DataTable` (Ticker · Empresa · Preço · Preço justo · Margem de segurança · Score); ranking do dia salvo é reaberto em vez de gerado de novo (`51806a1`).
- Histórico em aba (`ranking-history-section.tsx`, também usado no dashboard).
- Metodologia de cada modelo na tela e em `/metodologia` (`32d0306`, `src/lib/ranking-methodology.ts`).

## Regras / limites
- `plan: 'free'`: `graham`, `magicFormula`, `fiiDividendYield` e os presets de ETF; o resto é `premium` (API devolve 401 sem login e 403 sem Premium).
- Fórmula Mágica: 3 resultados no plano gratuito (as páginas de marketing dependem disso).
- Padrão `limit: 10` nos modelos de ação; FIIs com os padrões do registro (`maxPvp 1.1`, `limit 50`; PJ-FII `minScore 55`, `limit 30`).
- Página do ativo e ranking usam o mesmo loader e parâmetros padrão ([[Onda 5]]); mudar sliders gera a nota "parâmetros do ranking".

## Histórico nas ondas
- [[Onda 1]]: `ed5428f` (sem tela intermediária, registro de modelos, sem framer-motion).
- [[Onda 2]]: `986090d`/`1e188da` (filtro de liquidez, Barsi, Bazin, Lynch, P/VP), `7d2503a` (Barsi unificado ao Bazin, Lynch como PEG), `8783883` (anti-armadilha e P/L baixo exigem Premium na API).
- [[Onda 5]]: `0c8c9ca` + `3836ac7` (mesmos números que a página do ativo; cache v6).
- [[Onda 6]]: "Perguntar ao Ben" no cabeçalho dos resultados.

## Pendências
- Lynch ainda mostra o preço justo de outro modelo; o aviso "parâmetros do ranking" aparece mesmo quando o filtro não muda o preço justo.
- Ranking de BDR não avisa quando os modelos não se aplicam.

## Relacionadas
[[Screening]] · [[Overall score]] · [[Graham]] · [[Caches]] · [[Ben]]
