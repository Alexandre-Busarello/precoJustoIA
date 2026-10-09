---
tags: [financas, valuation, pl-baixo]
updated: 2026-10-09
fontes: [src/lib/strategies/lowpe-strategy.ts, src/lib/strategies/strategy-config.ts, src/lib/ranking-models.ts]
---
# P-L baixo

> "P/L baixo com qualidade" (chave `lowPE`): P/L entre 3 e um **teto fixo** (não relativo ao setor), com filtros de rentabilidade e crescimento contra armadilhas de valor. Sem preço justo.

## Fórmula
```
entrada:   3 < P/L ≤ P/L_máx         (BDR: P/L_máx ≥ 25)
valueScore = max(0, 50 − P/L × peso)            peso 2,0 (BDR 1,5 só no ranking)
           + min(ROE, 30%) × 50 + min(ROA, 20%) × 100
           + min(margem líq., 20%) × 80 + max(0, cresc. receitas + 10%) × 30
           + min(ROIC, 25%) × 40                 (teto 100)
```
- Análise: `src/lib/strategies/lowpe-strategy.ts:17-90`; score: `:62-71`.
- Ranking: `lowpe-strategy.ts:92-180`; score com peso por BDR: `:132-142`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| P/L máx. (`STRATEGY_CONFIG`, página do ativo) | 15 | `strategy-config.ts:30` |
| P/L máx. (registro do ranking B3 / BDR) | 12 / 25 | `src/lib/ranking-models.ts:205` |
| ROE mín. (config e registro) | 12% (BDR ≥ 12%) | `strategy-config.ts:31`, `ranking-models.ts:205` |
| P/L mínimo | > 3 | `lowpe-strategy.ts:13`, `:43` |
| Crescimento das receitas | ≥ −10% | `lowpe-strategy.ts:45` |
| Margem líquida | ≥ 3% (BDR 5%) | `lowpe-strategy.ts:38` |
| Liquidez corrente | ≥ 1,0 | `lowpe-strategy.ts:49` |
| ROA | ≥ 5% | `lowpe-strategy.ts:50` |
| Dív. líq./PL | ≤ 2,0 (BDR 2,5) | `lowpe-strategy.ts:39` |
| Market cap | ≥ R$ 500 mi (BDR 2 bi) | `lowpe-strategy.ts:40` |
| Falhas toleradas | 2 critérios + P/L obrigatório | `lowpe-strategy.ts:58` |

## Filtros / quando não se aplica
- Bancos e seguradoras não são avaliados por liquidez corrente nem Dív./PL (`lowpe-strategy.ts:22-23`, `:47-53`).
- Ranking: overall score > 50, tipo/tamanho, P/L válido, `shouldExcludeCompany`, P/L ≤ máx. e ROE ≥ mín. (`lowpe-strategy.ts:97-128`).
- No código: a análise usa ROE/margem/ROIC com médias históricas (`use7YearAverages`, `:26-33`), mas o ranking usa os valores atuais (`:115-121`) — podem divergir.
- Sem tratamento específico de BDR sem conversão (não chama `bdrNotApplicableReason`).

## Saídas na UI
- Página do ativo: "P/L baixo com qualidade", premium (`src/components/asset/valuation-models.ts:67-73`); linha por critérios.
- Ranking: premium, sliders "P/L máximo" e "ROE mínimo", coluna Score = `valueScore` (`ranking-models.ts:193-207`); ordena por `valueScore`, top 50 (`lowpe-strategy.ts:169-176`).
- Entra no [[Overall score]] (`base-strategy.ts:963`).

## Decisões e histórico
- Onda 2 (`27fc167`): descrição corrigida para "P/L fixo ≤ 15, não abaixo do setor"; financeiras sem LC e Dív./PL ([[Onda 2]], `w2-valuation-core.md` §6).
- `8783883`: P/L baixo e anti-armadilha passam a exigir Premium também na API.

## Relacionadas
[[Lynch]] [[Fórmula Mágica]] [[Estratégia 3+1]] [[Anti-armadilha]] [[Ranking]] [[Overall score]]
