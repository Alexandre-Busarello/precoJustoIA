---
tags: [financas, fii]
updated: 2026-10-09
fontes: [src/lib/fii-listing-valuation.ts, src/lib/finance/macro.ts, src/lib/finance/valuation.ts, src/lib/strategies/fii-overall-score.ts]
---
# FII score e preço-teto
> Preço-teto do FII = rendimento anual por cota ÷ DY-alvo, com DY-alvo = NTN-B real + IPCA + spread. O PJ-FII Score (0–100) é separado: 5 pilares ponderados.

## Fórmula / como funciona
**Preço-teto** (`computeFiiListingValuation`, `src/lib/fii-listing-valuation.ts:84`)
1. DY-alvo = `ntnbRealLong + ipcaExpected + spread` (`src/lib/fii-listing-valuation.ts:29`). O spread vem do tipo do fundo (`fiiKind`, `:72`): papel, tijolo ou desconhecido.
2. Rendimento anual = soma dos 12 últimos rendimentos (`annualizeFromLast12`, `:69`). Sem histórico válido, usa DY 12m × cotação (`:115`).
3. Preço-teto = rendimento ÷ DY-alvo (`ceilingPrice`, `src/lib/finance/valuation.ts:130`). Potencial = (teto − cotação) ÷ cotação × 100 (`:123`).
4. Sem rendimento, o fallback é o valor patrimonial por cota: VPA ou cotação ÷ P/VP (`:132-136`).

**PJ-FII Score** (`calculateFiiOverallScore`, `src/lib/strategies/fii-overall-score.ts:216`): média ponderada de 5 pilares (`:354-359`), seguida de travas (`:361-369`).
- Dividendos = DY 40% + consistência 30% + estabilidade (CV) 20% + payout/FFO 10% (`:293`).
- Valuation = P/VP 50% + cap rate (tijolo) ou FFO yield (papel) 30% + gap cotação/VP 20% (`:305`).
- Qualidade do portfólio, tijolo: nº de imóveis 45% + vacância 40% + yield implícito 15% (`:332`). Papel: segmento 50% + consistência 30% + P/VP 20% (`:337`).
- Liquidez = volume 60% + valor de mercado 30% + 60 fixo × 10% (`:346`).
- "Segmento e resiliência" (a chave no código é `gestao`) = segmento 50% + 70 fixo × 30% + atualização 20% (`:352`).

## Parâmetros e limiares
| parâmetro | valor | onde |
|---|---|---|
| Spread tijolo / papel / desconhecido | 2,5 / 2,0 / 2,5 p.p. | `src/lib/fii-listing-valuation.ts:9` |
| NTN-B real longa (fallback) | 7,68% | `src/lib/finance/macro.ts:21` |
| IPCA 12m (fallback) | 4,0% | `src/lib/finance/macro.ts:18-20` |
| Idade máxima da NTN-B no banco | 30 dias | `src/lib/finance/macro.ts:97` |
| Histórico de rendimentos válido | último em até 400 dias | `src/lib/fii-listing-valuation.ts:61` |
| Pesos dos pilares (tijolo) | 30 / 25 / 20 / 15 / 10% | `src/lib/strategies/fii-overall-score.ts:257-261` |
| Pesos dos pilares (papel) | 35 / 25 / 15 / 15 / 10% | idem |
| Faixa de DY com nota máxima: tijolo / papel | 8–12% / 10–15% | `src/lib/strategies/fii-overall-score.ts:90-93` |
| Armadilha no pilar de dividendos (×0,8) | DY > 14%, P/VP < 0,85 e vacância > 12% | `:295` |
| Dividend trap no total (−20 pts) | DY > 18%, P/VP < 0,8 e vacância > 15% | `:362` |
| Teto por liquidez | 40 pts se volume < R$ 100 mil/dia | `:366` |
| Notas | A+ ≥ 85, A ≥ 75, A- ≥ 70, B+ ≥ 65, B ≥ 55, C ≥ 45, D ≥ 35 | `:197-210` |

## Quando não se aplica
- Fundo sem cotação válida: valuation vazio (`src/lib/fii-listing-valuation.ts:111`) e score 0/F (`fii-overall-score.ts:237`).
- MALL11 não recebe score (`FII_UNAVAILABLE_TICKERS`, `fii-overall-score.ts:4`).
- Sem rendimento nem VP, o FII fica sem preço de referência.

## Saídas na UI
- Rótulo do modelo: "Teto DY x% a.a." ou "Valor patrimonial (VP)" (`fiiListingFairValueModelLabel`, `src/lib/fii-listing-valuation.ts:147`).
- Linha de premissas: "NTN-B … + IPCA esperado … + spread de N pp" (`:143`), em `src/components/fii-strategic-analysis.tsx`.
- `qualityLabel` (de "Qualidade alta" a "Qualidade baixa") no lugar de recomendação (`fii-overall-score.ts:41-49`).
- O preço-teto também alimenta o modelo `fiiCeiling` do [[Onde aportar]].

## Decisões e histórico / pendências
- Onda 2 (`w2-score-compliance-fii`): o teto passou a somar os 12 últimos rendimentos, em vez de usar o último × 12 com a heurística de 0,55. O DY-alvo deixou de ser 8% fixo e passou a usar o spread sobre a NTN-B. O pilar "gestão" foi renomeado para "Segmento e resiliência".
- **Pendência do dono (em aberto no código em 09/10):** com o fallback, o DY-alvo do tijolo dá 7,68% + 4,0% + 2,5% = **14,18%**. O RESUME registra o HGLG11 a −68% do teto com score 93. O aluguel de tijolo é corrigido pela inflação, e uma alternativa seria um alvo real (NTN-B + spread, sem IPCA). A fórmula não mudou.
- **NTN-B ainda fixa na prática:** o símbolo `NTNB_REAL_LONG` só é lido (`macro.ts:40`, `:239-240`). Nenhum código do repo grava esse símbolo: o cron do BCB cobre Selic, CDI e IPCA (`SGS_CODES`, `:44`). Então vale sempre o fallback de 7,68%, a menos que alguém carregue o valor à mão e repita a carga a cada 30 dias.
- **Rótulo enganoso:** a UI diz "IPCA esperado", mas o valor é o IPCA realizado em 12 meses (`macro.ts:17-20`).
- Pilar de resiliência: o ranking mostra 60 e a página mostra 80, porque falta passar `lastFetchedAt` (RESUME, onda 2). A página passa o campo (`src/lib/fii-score-loader.ts:45`); o ranking não foi conferido.

## Relacionadas
[[Bazin]] · [[Barsi]] · [[Margem de segurança e upside]] · [[Overall score]] · [[Ranking]] · [[Fontes de dados]] · [[Crons]] · [[Decisões do dono]] · [[Pendências]] · [[Onda 2]]
