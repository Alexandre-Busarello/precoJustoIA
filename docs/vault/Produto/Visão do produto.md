---
tags: [produto, visao]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/strategy.md, src/lib/site-constants.ts]
---
# Visão do produto

> Preço Justo AI: o analista quantitativo do investidor pessoa física. Valuation transparente e multimodelo, com premissas ligadas à Selic e à NTN-B, e a pergunta central: **onde aportar o próximo real**.

## Posicionamento (strategy.md §5)
- Diferencial defensável: **transparência, premissas vivas e multimodelo**. Exemplos: FCD com Ke ligado à NTN-B e a ponte EV→Equity.
- Direção visual: **"terminal de análise sóbrio"**, com visual neutro, uma cor de marca, [[Tema e dark mode|dark mode completo]] e nenhuma interrupção automática.
- Linguagem de dados, não de recomendação. Ver [[Compliance CVM]].

## Premissa central: Onde aportar
"Tenho R$ 2.000 e estas ações ou esta carteira: qual o melhor ativo para este aporte?" O dono decidiu em 29/09/2026 que isso vira a feature [[Onde aportar]]. Ela usa um motor determinístico, sem LLM, e é enquadrada como calculadora que aplica os critérios do próprio usuário.

## O que o produto cobre (texto oficial em `src/lib/site-constants.ts`)
- `COVERED_ASSETS_LABEL`: "mais de 600 ativos" (ações, BDRs e FIIs; confirmado pelo dono em out/2026).
- `STOCK_VALUATION_MODELS_COUNT = 11`: os 10 modelos da página do ativo mais o [[Barsi]], que existe como ranking. Só o [[Graham]] é gratuito. O teste `site-constants.test.ts` falha se os registros mudarem e esse número não.
- Fontes exibidas: "Dados da B3 e da CVM via BRAPI e Yahoo Finance". Ver [[Fontes de dados]].
- Frequência exibida: "Cotações atualizadas diariamente".

## Hábitos que retêm (strategy.md §6)
Agenda de proventos, alertas de preço-teto, carteira com proventos comparada ao CDI/IPCA e, no futuro, IR. Ver [[Agenda de proventos]], [[Alertas]] e [[Carteira]].

## Relacionadas
[[Decisões do dono]] · [[Planos e preços]] · [[Compliance CVM]] · [[00 - Início]]
