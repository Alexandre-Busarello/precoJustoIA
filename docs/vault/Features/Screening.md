---
tags: [feature, screening]
updated: 2026-10-09
fontes: [src/app/screening-acoes/, src/app/screening-fiis/, src/components/screening/screening-hub-page.tsx, src/components/screening-ai-assistant.tsx, src/lib/screening-presets.ts, src/lib/strategies/screening-strategy.ts, src/app/api/rank-builder/route.ts]
---
# Screening
> Filtro de ações (`/screening-acoes`) e FIIs (`/screening-fiis`) por critérios quantitativos, com presets de SEO em `/screening-acoes/[slug]` e configuração por IA.

## Como funciona
- UI: `src/components/screening/screening-hub-page.tsx` (dois painéis no desktop: filtros à esquerda, resultados em `DataTable` à direita, atualizados ao vivo; no mobile, resultados primeiro e botão "Filtros (n)" que abre uma folha inferior).
- Filtros de setor/indústria vêm de `/api/sectors-industries`.
- Execução: `POST /api/rank-builder` com `model: "screening"`, usando `ScreeningStrategy` (`src/lib/strategies/screening-strategy.ts`).
- Presets: `src/lib/screening-presets.ts` (slugs fixos; nomes descritivos como "Desconto vs. preço justo"); página de preset de sinal em `screening/signal-preset-page.tsx`.
- IA: campo inline "Descreva o que procura" + "Configurar com IA" (`screening-ai-assistant.tsx`, `/api/screening-ai`).
- **Filtros novos da [[Onda 3]]** (`1c9af1d`):
  - liquidez visível (`liquidity-filter.tsx`): padrão ≥ R$ 1 mi/dia em ações e ≥ R$ 500 mil/dia em FIIs, com a coluna "Volume médio (21d)";
  - desconto vs. preço-teto [[Bazin]];
  - PEG máximo ([[Lynch]]);
  - "DY 12m (proventos reais, bruto)";
  - "Queda com fundamentos intactos": abaixo da MM200 ou ≥ 20% abaixo da máxima de 52 semanas, com fundamentos intactos (ver [[Sinais financeiros]]). Sinais de preço carregados em lote, com cache por pregão.

## Regras / limites
- **Free/anônimo:** 3 resultados, sem as métricas dos modelos Premium (`PREMIUM_SCREENING_METRICS` em `src/app/api/rank-builder/route.ts`). **Premium:** sem limite.
- O modo preset só vale quando os parâmetros batem com um preset conhecido (`findPresetForScreeningParams`); um `sortBy` avulso não libera filtros Premium (correção da [[Onda 5]]).
- Copy: "Filtros quantitativos sobre dados públicos. Não é recomendação de investimento." (ver [[Compliance CVM]]).

## Histórico nas ondas
- [[Onda 1]]: `9f5dc31` (dois painéis, IA inline, correção do 404 de setores, sem emoji).
- [[Onda 3]]: `1c9af1d` (liquidez, Bazin, PEG, DY 12m, queda com fundamentos).
- [[Onda 5]]: brecha do `sortBy` em `/api/rank-builder` fechada (`44aa012`).
- [[Onda 6]]: "Perguntar ao Ben" no cabeçalho dos resultados (`87a519a`).

## Pendências
- Nada específico aberto no RESUME. Não verifiquei a meta de p95 < 2 s do lote.

## Relacionadas
[[Ranking]] · [[Sinais financeiros]] · [[Bazin]] · [[Lynch]] · [[Ben]] · [[Caches]]
