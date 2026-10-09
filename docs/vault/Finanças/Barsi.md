---
tags: [financas, valuation, barsi]
updated: 2026-10-09
fontes: [src/lib/strategies/barsi-strategy.ts, src/lib/strategies/bazin-strategy.ts, src/lib/ranking-models.ts, src/lib/strategies/strategy-config.ts]
---
# Barsi

> Método Barsi no ranking: **filtro de setores perenes (B.E.S.T.)** sobre o mesmo preço-teto do [[Bazin]] (média de 5 anos completos sem extraordinários ÷ DY alvo), com score próprio. Na página do ativo não há linha separada.

## Fórmula
```
média = média anual de proventos brutos, 5 anos-calendário completos, sem extraordinários
teto  = (média / DY_alvo) × multiplicador
desconto = 1 − preço / teto                     entra no ranking só se preço ≤ teto
BarsiScore = min(desconto%/30 × 40, 40)                         (até 30% de desconto)
           + min(DY × 200 + 15 se dividendos consistentes, 35)
           + min(min(ROE,25%)×40 + min(LC,2,5)×4 + min(margem,15%)×33, 25)
```
- Média: `src/lib/strategies/barsi-strategy.ts:24-44` (mesma base do Bazin, `:36-37`).
- Teto: `barsi-strategy.ts:72-78`; score: `:109-127`.

## Parâmetros e limiares
| Parâmetro | Valor (ranking B3) | Onde |
|---|---|---|
| DY alvo | 6% (BDR 3%) | `src/lib/ranking-models.ts:414` |
| Multiplicador do teto | 1,0 | `ranking-models.ts:415` |
| Anos com dividendos | 3 → exige DY > 1% em ⌊80%⌋ deles (2 de 3) | `ranking-models.ts:416`, `barsi-strategy.ts:84-106` |
| Dív. líq./PL máx. | 1,0 (BDR 1,5) | `ranking-models.ts:417` |
| ROE mín. | 10% (BDR 12%) | `ranking-models.ts:418` |
| Só setores perenes | ligado | `ranking-models.ts:419` |
| Market cap mín. (ranking) | R$ 1 bi | `barsi-strategy.ts:293` |
| Payout sustentável (análise) | 20%–95% | `barsi-strategy.ts:167` |
| Essenciais (análise) | preço ≤ teto, dividendos, ROE, dívida + ≥ 6 de 8 critérios | `barsi-strategy.ts:216-217` |

## Filtros / quando não se aplica
- Setor perene: utility (energia elétrica, saneamento, gás canalizado), financeira com "banco/segur/previd" ou telecom; **petróleo e gás fora** (`barsi-strategy.ts:61-66`).
- Ranking: overall score > 50, `shouldExcludeCompany`, setor perene, média > 0, ROE, dívida, consistência, market cap, preço ≤ teto (`barsi-strategy.ts:268-296`).
- `validateCompanyData` exige DY, último dividendo e preço > 0 (`barsi-strategy.ts:46-54`).
- No código: os padrões internos da classe divergem do registro (análise usa `minConsecutiveDividends = 5`, `maxDebtToEquity = 2.0`, `focusOnBEST = false`, `barsi-strategy.ts:134-141`; `STRATEGY_CONFIG.barsi` tem 3 / 2,0 / false, `strategy-config.ts:106-116`). Página e ranking recebem os do registro via `fairValueModelParams` (`ranking-models.ts:621`).

## Saídas na UI
- Ranking: "Barsi", premium, colunas Score (`barsiScore`) e "Preço-teto" (`ranking-models.ts:374-425`); ordena por Barsi Score (`barsi-strategy.ts:326`).
- Página do ativo: a análise roda para premium (`src/lib/company-analysis-service.ts:495`), mas o registro de valuation não tem linha `barsi` (`src/components/asset/valuation-models.ts:35-114`) — fica só a linha [[Bazin]].
- Radar: rótulo "Barsi" (antes aparecia "Bazin") — `src/components/radar-strategy-badges.tsx:32`, `src/app/api/radar/data/route.ts:23`.

## Decisões e histórico
- Onda 2: média em 5 anos completos e valores "brutos" (`w2-rankings-new-models.md` §3).
- `7d2503a` (decisão delegada pelo dono): **Barsi unificado ao Bazin** — fica no ranking como filtro de setores perenes com a mesma base (DY 6%, sem extraordinários) ([[Decisões do dono]], `RESUME.md:46`).
- `8783883`: petróleo e gás saem dos setores perenes.

## Relacionadas
[[Bazin]] [[Anti-armadilha]] [[Margem de segurança e upside]] [[Ranking]] [[Decisões do dono]] [[Onda 2]]
