---
tags: [financas, valuation, dividendos]
updated: 2026-10-09
fontes: [src/lib/strategies/dividend-yield-strategy.ts, src/lib/strategies/strategy-config.ts, src/lib/ranking-models.ts, src/lib/finance/sector-classification.ts]
---
# Anti-armadilha

> "Anti-armadilha de dividendos" (no código: `DividendYieldStrategy`, chave `dividendYield`). Exige DY mínimo e testa se o dividendo é sustentável, com **critérios por perfil** (geral, utilidade pública, bancos e seguradoras). Sem preço justo.

## Fórmula
```
perfil = financial | utility | general            (classificação setorial determinística)
elegível = DY ≥ DY_mín  E  critérios atendidos ≥ total − 2
sustainabilityScore = base + saúde                (teto 100)
  base  = min(ROE,30%)×25 + min(margem,20%)×75 + min(ROIC,25%)×20 + DY×50
  saúde geral    = min(LC,3)×15 + max(0, 50 − Dív.líq./PL × 50)
  saúde utility  = min(LC,3)×15 + max(0, 50 − Dív.líq./EBITDA / 3,5 × 50)
  saúde financ.  = 25 (payout na faixa) + 25 (lucros consistentes) + min(ROE5a/20%, 1) × 45
```
- Perfis e critérios: `src/lib/strategies/dividend-yield-strategy.ts:10-14`, `:100-132`.
- Elegibilidade: `dividend-yield-strategy.ts:135`; score: `:166-179`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| DY mínimo (B3 / BDR) | 4% / 2,5% | `strategy-config.ts:22`, `ranking-models.ts:190` |
| Geral: ROE | ≥ 10% (BDR 12%) | `dividend-yield-strategy.ts:85` |
| Geral: LC | ≥ 1,2 (BDR 1,0) | `dividend-yield-strategy.ts:86` |
| Geral: Dív. líq./PL | ≤ 1,0 (BDR 1,5) | `dividend-yield-strategy.ts:87` |
| Utility: Dív. líq./EBITDA (no lugar de Dív./PL) | ≤ 3,5 | `dividend-yield-strategy.ts:26` |
| Financeira: ROE médio 5a | ≥ 12% | `dividend-yield-strategy.ts:23` |
| Financeira: payout | 25%–80% | `dividend-yield-strategy.ts:24` |
| Financeira: lucros consistentes | ≤ 2 prejuízos em 8 anos | `dividend-yield-strategy.ts:110`, `base-strategy.ts:869-923` |
| P/L | entre 4 e 25 (BDR 30) | `dividend-yield-strategy.ts:88` |
| Margem líquida (geral/utility) | ≥ 5% | `dividend-yield-strategy.ts:89` |
| Market cap | ≥ R$ 1 bi (BDR 2 bi) | `dividend-yield-strategy.ts:90` |
| **Falhas toleradas** | **2 critérios** (só o DY é obrigatório) | `dividend-yield-strategy.ts:135` |

## Filtros / quando não se aplica
- Entrada: DY ≥ mínimo (`validateCompanyData`, `dividend-yield-strategy.ts:53-56`).
- Financeiras não usam liquidez corrente nem Dív./PL (`:101-113`).
- Ranking: overall score > 50, elegível, ROE e P/L presentes e `shouldExcludeCompany` (`dividend-yield-strategy.ts:184-195`); ordena por `sustainabilityScore`, top 50 (`:230-232`).

## Saídas na UI
- Página do ativo: "Anti-armadilha de dividendos", premium (`src/components/asset/valuation-models.ts:59-66`); texto "Atende ao modelo anti-armadilha (critérios de …)" ou "Pode ser uma armadilha de dividendos: X de Y" (`:145-147`).
- Ranking: premium, slider "Dividend yield mínimo", coluna Score = `sustainabilityScore` (`ranking-models.ts:179-191`).
- Entra no [[Overall score]] (`base-strategy.ts:962`).

## Decisões e histórico
- Onda 2 (`27fc167`): critérios por tipo de negócio; corrigido o "DY 0.1%" do texto ([[Onda 2]], `w2-valuation-core.md` §7).
- `8783883`: exige Premium também na API.
- **Pendente de decisão do dono** (`RESUME.md:49`): os critérios por perfil ainda toleram 2 falhas — banco pode falhar ROE e payout; TAEE11 passa com Dív. líq./EBITDA 3,6; B3SA3 cai no perfil "bancos e seguradoras". Tornar obrigatórios? ([[Decisões do dono]]).

## Relacionadas
[[Bazin]] [[Barsi]] [[Gordon]] [[P-L baixo]] [[Overall score]] [[Ranking]] [[Decisões do dono]]
