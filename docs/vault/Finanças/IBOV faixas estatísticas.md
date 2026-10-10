---
tags: [financas, ibov]
updated: 2026-10-09
fontes: [src/lib/ibov-projections/engine.ts, src/lib/ibov-projections/service.ts, src/lib/ibov-projections/context.ts, src/lib/ibov-projections/commentary.ts]
---
# IBOV faixas estatísticas
> Faixas de 1 semana, 1 mês e 12 meses calculadas com percentis empíricos dos retornos históricos do Ibovespa. É um cálculo determinístico. A IA só escreve um comentário opcional e não mexe nos números.

## Fórmula / como funciona
`buildIbovProjection` (`src/lib/ibov-projections/engine.ts:397`):
1. Limpa os fechamentos: data válida, preço > 0, último valor por data (`sanitizeCloses`, `:159`).
2. Para cada horizonte, calcula os retornos log `ln(P[i+h]/P[i])` em todas as janelas sobrepostas dos últimos 10 anos (`horizonLogReturns`, `:199`; `estimateAt`, `:274`).
3. Tira os percentis p5, p16, p50, p84 e p95 com interpolação linear, como o PERCENTIL do Excel ou o tipo 7 do R (`percentile`, `:173`). Os níveis do índice são `último fechamento × e^r` (`:439`).
4. Ajuste de regime: a dispersão em torno da mediana é multiplicada por vol63 atual ÷ mediana da vol63, limitada a 0,7–1,5× (`volatilityScale`, `:244`; `scaleQuantiles`, `:253`). Fica ligado por padrão (`:399`).
5. Também calcula a fração de janelas positivas (`:282`).
6. Calibração: refaz o método em datas passadas, só com os dados disponíveis em cada data, e conta quantas vezes o fechamento caiu em p16–p84 e em p5–p95 (`calibrate`, `:315`). O veredito compara com 68% e 90% (`verdictFor`, `:302`).
7. Cone do gráfico em 5, 10, 21, 42, 63, 126, 189 e 252 pregões (`:58`, `:461-465`).

## Parâmetros e limiares
| parâmetro | valor | onde |
|---|---|---|
| Horizontes | 5 / 21 / 252 pregões | `engine.ts:34-38` |
| Janela de dados | 10 anos (2.520 pregões) | `engine.ts:42` |
| Vol. realizada | 63 pregões; fator entre 0,7 e 1,5× | `engine.ts:44-46` |
| Mínimo de janelas | 250 | `engine.ts:50` |
| Dado desatualizado | > 3 pregões | `engine.ts:48`, `:380-386` |
| Calibração | últimos 5 anos; ≥ 3 anos de histórico antes de cada data | `engine.ts:52-54` |
| Passo da calibração | `min(h, 21)` pregões | `engine.ts:298-300` |
| Tolerância ok | ±8 p.p. (68%) e ±6 p.p. (90%); < 10 períodos = "insuficiente" | `engine.ts:56`, `:303` |
| Fonte | Yahoo `^BVSP`, diário, 16 anos | `service.ts:4-5`, `:25-26` |
| Cache | 24 h por dia/fase do pregão; "último bom" por 30 dias | `service.ts:27-31` |
| Fechamento do pregão | 18h30 (Brasília) | `context.ts:11` |
| Comentário IA | Gemini flash-lite; até 700 caracteres; descartado após 3 dias | `service.ts:33-35`, `commentary.ts:10` |

## Quando não se aplica
- Sem fechamentos: `status: 'no-data'` (`engine.ts:419-434`). Com menos de 250 janelas, o horizonte fica "insuficiente" (`:444`).
- O pregão em andamento é ignorado: a faixa sempre parte do último fechamento completo (`context.ts:50`).
- Se o Yahoo falhar, a página mostra o último cálculo bom com o aviso de desatualizado (`service.ts:7`).

## Saídas na UI
- `/projecoes-ibov`: um card por horizonte com a faixa provável (p16–p84), a faixa ampla (p5–p95), a frequência de alta e a calibração ("Nos últimos 5 anos, o fechamento caiu dentro da faixa provável em X%…"). Também mostra o gráfico em cone, contexto (P/L da bolsa e seu percentil, Selic, CDI) e o selo "Comentário gerado por IA".
- Banner do dashboard: "Ibovespa: faixa provável para o mês entre … e … pts", com o aviso "não é previsão nem recomendação" (`src/components/dashboard-ibov-banner.tsx`).
- O comentário da IA é descartado se usar "vai subir", "alvo", "compra", "venda", "recomend…", "previsão" ou emoji (`commentary.ts:13-24`, `:63-73`).

## Decisões e histórico / pendências
- Onda 3, lote `w3-ibov-projections` (`61481fa`; spec em `docs/melhorias-2026-09/batches/w3-ibov-projections.md`). Decisão do dono (07/10): sai o número único do Gemini e a "confiança 0–100", entra a faixa estatística. Sem mudança de schema; os campos novos ficam em `IbovProjection.keyIndicators` (`service.ts:8`).
- O cálculo é sob demanda e não depende do cron. O cron `/api/cron/calculate-ibov-projections` só aquece o cache, grava o snapshot e gera o comentário. **Ainda precisa ser agendado** no agendador externo (opcional, 1×/dia depois das 18h30). Ver [[Crons]].
- A spec pede o diagnóstico de por que a versão antiga parou: o cron não estava no `vercel.json`. O resto do diagnóstico ficou no relatório do lote, que não li.
- Pendência (onda 3): o aviso do IBOV e o card do Ben ficavam empilhados no topo do dashboard; o lote `w6-ben-ui` herdou o ajuste.

## Relacionadas
[[Compliance CVM]] · [[Ben]] · [[Crons]] · [[Fontes de dados]] · [[Decisões do dono]] · [[Onda 3]] · [[Pendências]]
