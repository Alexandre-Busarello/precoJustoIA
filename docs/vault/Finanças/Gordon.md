---
tags: [financas, valuation, gordon]
updated: 2026-10-09
fontes: [src/lib/strategies/gordon-strategy.ts, src/lib/finance/valuation.ts, src/lib/finance/dividends.ts, src/lib/finance/macro.ts]
---
# Gordon

> Modelo de desconto de dividendos com crescimento constante: VJ = D1 ÷ (k − g). D0 vem dos proventos dos últimos 12 meses sem extraordinários; k é o Ke macro com beta setorial.

## Fórmula
```
D0 = Σ proventos (div. + JCP brutos) com data-com nos últimos 12 meses, sem extraordinários
     (sem histórico: DY 12m × preço; depois DY × preço)
D1 = D0 × (1 + g)
k  = max(Ke(β) + ajuste manual, Selic, taxa informada)
g  = max(0, min(teto do parâmetro, ROE × (1 − payout), 6%))
VJ = D1 / (k − g) × fatorPorRecibo        exige k − g ≥ 4 p.p.
```
- Insumos: `src/lib/strategies/gordon-strategy.ts:93-129`; fórmula pura: `src/lib/finance/valuation.ts:86-90`.
- D0 TTM sem extraordinários: `gordon-strategy.ts:55-57` (usa `sumTTM` + `removeExtraordinary`, `src/lib/finance/dividends.ts:170`, `:218`).
- Ke: `src/lib/finance/macro.ts:135-150`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| Teto de g | 6% | `gordon-strategy.ts:21` |
| g padrão sem parâmetro | 5% | `gordon-strategy.ts:23` |
| Teto de g no registro (B3 / BDR) | 4% / 5% | `src/lib/ranking-models.ts:314` |
| Taxa informada no registro (B3 / BDR) | 11% / 12% (só vale se > Ke e Selic) | `ranking-models.ts:313`, `gordon-strategy.ts:99` |
| Beta setorial | utility 0,8; cíclica 1,2; financeira/outros 1,0 | `gordon-strategy.ts:36-41` |
| Spread mínimo k − g | 4 p.p. | `finance/valuation.ts:11`, `gordon-strategy.ts:146` |
| Margem mínima (desconto) | 10% | `gordon-strategy.ts:30` |
| DY / DY 12m (ação) | ≥ 4% / ≥ 3% | `gordon-strategy.ts:166-167` |
| Payout / ROE | ≤ 80% / ≥ 12% | `gordon-strategy.ts:168-169` |
| Crescimento dos lucros | ≥ −20% (ou CAGR 5a > 0) | `gordon-strategy.ts:185` |
| LC / Dív. líq./PL (geral) | ≥ 1,2 / ≤ 1,0 | `gordon-strategy.ts:170-171` |
| Utility: Dív. líq./EBITDA | ≤ 3,5 | `gordon-strategy.ts:193` |
| Extraordinário | > 2× mediana e sem repetição sazonal (±45 dias, até 2,5×) | `finance/dividends.ts:182-186` |
| Falhas toleradas | 2 critérios | `gordon-strategy.ts:199` |

## Filtros / quando não se aplica
- BDR sem conversão → não aplicável (`gordon-strategy.ts:139-140`).
- Sem proventos em 12 meses, spread < 4 p.p. ou potencial > 500% → sem preço, com motivo no texto (`gordon-strategy.ts:215-226`).
- Financeiras: sem liquidez corrente nem Dív./PL (`gordon-strategy.ts:188-195`).
- Ranking: só elegíveis, overall score > 50 e `shouldExcludeCompany` (`gordon-strategy.ts:263-272`).

## Saídas na UI
- Texto: "Preço justo de R$ X = D1 ÷ (k − g)", com D0, g, k, beta e extraordinários retirados (`gordon-strategy.ts:203-235`).
- Ranking: `compositeScore` = 35% potencial, 25% DY, 20% ROE, 10% payout, 10% crescimento (sem crescimento: 40/30/20/10) (`gordon-strategy.ts:282-289`); coluna Score (`ranking-models.ts:319`).
- Página do ativo: premium, "Gordon (dividendos)" (`src/components/asset/valuation-models.ts:51-58`); usado no [[Onde aportar]].

## Decisões e histórico
- Onda 2 (`27fc167`): D0 TTM (acabou o valor justo 4–12× errado nas pagadoras mensais/trimestrais), k = Ke, spread ≥ 4 p.p., classificação setorial determinística ([[Onda 2]]).
- Margem mínima caiu de "potencial ≥ 15%" para desconto ≥ 10%, porque com Ke ~16–19% o ranking ficava vazio — "decisão registrada para o dono revisar" (`gordon-strategy.ts:24-30`).
- Onda 5 (`0c8c9ca`): página e ranking com os mesmos padrões (antes VALE3 R$ 86,80 × R$ 80,08) ([[Onda 5]]).
- Pendente (`RESUME.md:83`): BDR recebe nota "Convertido por paridade..." mesmo com fator 1.

## Relacionadas
[[Margem de segurança e upside]] [[Bazin]] [[FCD]] [[Overall score]] [[Ranking]] [[Decisões do dono]]
