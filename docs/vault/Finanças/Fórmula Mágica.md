---
tags: [financas, valuation, formula-magica]
updated: 2026-10-09
fontes: [src/lib/strategies/magic-formula-strategy.ts, src/lib/finance/valuation.ts, src/lib/ranking-models.ts, src/app/api/rank-builder/route.ts]
---
# Fórmula Mágica

> Método de Joel Greenblatt: posição por ROIC + posição por earnings yield (EBIT/EV); ordena pela soma (menor é melhor). Sem preço justo.

## Fórmula
```
EY = EBIT / EV = 1 / (EV/EBIT)                 (EV/EBIT ≤ 0 → fora)
posição = 1 + nº de empresas com valor estritamente maior   (empates dividem a posição: 1-2-2-4)
soma    = posição_ROIC + posição_EY
ordem   = soma ↑, depois EY ↓, ROIC ↓, ticker
magicScore (ranking) = round(100 × (1 − (posição − 1) / total))
```
- EY: `src/lib/strategies/magic-formula-strategy.ts:15-18`.
- Ranking puro: `src/lib/finance/valuation.ts:154-189` (exclui ROIC ≤ 0 e EV/EBIT ≤ 0, `:164-166`).
- Score do ranking: `magic-formula-strategy.ts:138`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| EY mínimo (padrão) | 8% (BDR: no máx. 5%) | `magic-formula-strategy.ts:7`, `:54` |
| ROIC mínimo (análise) | 15% (BDR: no mín. 12%) | `magic-formula-strategy.ts:9`, `:53` |
| ROE | ≥ 15% (BDR 12%) | `magic-formula-strategy.ts:55` |
| Margem líquida | ≥ 5% | `magic-formula-strategy.ts:56` |
| LC / Dív. líq./PL | ≥ 1,2 / ≤ 1,5 (BDR 1,0 / 2,0) | `magic-formula-strategy.ts:57-58` |
| Crescimento das receitas | ≥ −5% | `magic-formula-strategy.ts:69` |
| Market cap | ≥ R$ 1 bi (BDR 3 bi) | `magic-formula-strategy.ts:59` |
| Elegível (análise) | ≥ 6 de 8, com ROIC e EY obrigatórios | `magic-formula-strategy.ts:81` |
| `STRATEGY_CONFIG` | limit 10, minROIC 15%, minEY 8% | `strategy-config.ts:38-45` |

## Filtros / quando não se aplica
- Bancos, seguradoras e utilidade pública ficam fora (`magic-formula-strategy.ts:11-12`, `:21-24`, `:38`).
- Ranking: overall score > 50, tipo/tamanho, `validateCompanyData` (ROIC > 0 e ≥ mín.; EY ≥ mín.) e `shouldExcludeCompany` antes do ranqueamento (`magic-formula-strategy.ts:115-122`).
- No código: o registro do ranking só define `limit: 10` (`ranking-models.ts:220`), então `minROIC`/`minEY` chegam como `undefined` e o `validateCompanyData` usa 0 (`:30`); na página do ativo valem os 15%/8% do `STRATEGY_CONFIG` (`src/lib/company-analysis-service.ts:491`). A rota só completa com os padrões do registro (`withRegistryDefaults`, `src/app/api/rank-builder/route.ts:131-142`), não com o `STRATEGY_CONFIG` — ou seja, no ranking basta ROIC > 0 e EY > 0.

## Saídas na UI
- Ranking: "Fórmula Mágica", plano free com **3 resultados no grátis** e lista completa no Premium (`ranking-models.ts:208-222`, `src/app/api/rank-builder/route.ts:538-558`); texto "Posição N de T: Xº em ROIC e Yº em EBIT/EV" (`magic-formula-strategy.ts:148`).
- Página do ativo: premium, linha por critérios; `magicScore` de leitura rápida (ROIC, EY, ROE, margem, crescimento) (`magic-formula-strategy.ts:85-92`).

## Decisões e histórico
- Onda 2 (`27fc167`): EY = 1/(EV/EBIT), ordem pela soma das posições, financeiras e utilities fora, minEY 0,08 (antes 0,8) ([[Onda 2]], `w2-valuation-core.md` §5).
- Onda 1 → 2: `magicFormulaRank` passou a excluir ROIC ≤ 0.
- Onda 5 (`w5-data-consistency.md` §5): manter 3 resultados no grátis (as páginas de marketing dependem disso) e dizer isso na copy ([[Onda 5]]).

## Relacionadas
[[P-L baixo]] [[Estratégia 3+1]] [[Overall score]] [[Ranking]]
