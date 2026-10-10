---
tags: [financas, valuation, bancos]
updated: 2026-10-09
fontes: [src/lib/strategies/bank-pvp-strategy.ts, src/lib/finance/valuation.ts, src/lib/finance/macro.ts, src/lib/finance/sector-classification.ts]
---
# P-VP bancos

> P/VP justo para bancos, seguradoras e demais financeiras (lucro residual em perpetuidade). No código: `BankPvpStrategy`, chave `bankPvp`, rótulo "P/VP justo (bancos)".

## Fórmula
```
ROE   = média de até 5 anos (atual + histórico)
payout = informado, ou DY × P/L se faltar (limitado a 1)
g     = min(ROE × (1 − payout), 6%)
Ke    = max(Selic, (1+NTN-B real)(1+IPCA 12m) − 1 + ERP)       β = 1
P/VP justo = (ROE − g) / (Ke − g)      exige Ke − g ≥ 4 p.p. e ROE > g
VJ    = VPA × P/VP justo
```
- Classe: `src/lib/strategies/bank-pvp-strategy.ts:49-126`; payout: `:19-26`.
- ROE médio: `fiveYearAverage` (`src/lib/strategies/bazin-strategy.ts:41-49`).
- Fórmula pura: `src/lib/finance/valuation.ts:103-114`; Ke: `src/lib/finance/macro.ts:135-150`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| Teto de g | 6% | `bank-pvp-strategy.ts:11` |
| ROE médio mínimo | 12% | `bank-pvp-strategy.ts:12` |
| Spread mínimo Ke − g | 4 p.p. | `finance/valuation.ts:11`, `bank-pvp-strategy.ts:78-79` |
| Ke | macro (pode ser sobrescrito por `costOfEquity`) | `bank-pvp-strategy.ts:63` |
| Elegível | ROE ≥ 12% E spread ok E preço < VJ | `bank-pvp-strategy.ts:117` |

## Filtros / quando não se aplica
- Só para `isFinancial` (setor/indústria com banco, seguro, previdência, mercado de capitais etc.; imobiliário e fintech/software ficam fora) — `bank-pvp-strategy.ts:57-59`, `src/lib/finance/sector-classification.ts:19-62`.
- Sem ROE histórico, sem payout (nem DY × P/L) ou VPA ≤ 0 → não aplicável com motivo (`bank-pvp-strategy.ts:71-75`).
- Spread < 4 p.p. → "o P/VP justo não é confiável" (`bank-pvp-strategy.ts:85-91`).

## Saídas na UI
- Página do ativo: linha "P/VP justo (bancos)", premium, `appliesTo: 'financial'` (`src/components/asset/valuation-models.ts:105-113`); roda só para financeiras (`src/lib/company-analysis-service.ts:458`, `:498`).
- É o **modelo padrão do cabeçalho** para financeiras premium (ordem `bankPvp, bazin, graham, gordon, fcd`, `valuation-models.ts:158`).
- Texto: "P/VP justo de X = (ROE − g) ÷ (Ke − g)" e valor estimado por ação (`bank-pvp-strategy.ts:109-114`).
- Não está no registro do [[Ranking]] (`src/lib/ranking-models.ts` não tem `bankPvp`); existe `runRanking` na classe (`:128-141`), ordenado por potencial. Entra no [[Onde aportar]] (`src/lib/allocation/constants.ts:35`).

## Decisões e histórico
- Onda 2 (`986090d`): criado como substituto do FCD em financeiras; FCD e Lynch remetem a ele ([[Onda 2]], `w2-rankings-new-models.md` §6).
- No código: o texto de metodologia diz "IPCA esperado" (`bank-pvp-strategy.ts:157`), mas o macro usa IPCA **realizado** 12m (`macro.ts:17-20`; o rótulo "IPCA esperado" foi proibido na onda 2).

## Relacionadas
[[FCD]] [[Lynch]] [[Graham]] [[Margem de segurança e upside]] [[Onde aportar]] [[Fontes de dados]]
