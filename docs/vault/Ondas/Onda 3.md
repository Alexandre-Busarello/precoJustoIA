---
tags: [onda, onda-3, onde-aportar]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, token-ledger.tsv (scratch)]
---
# Onda 3: Onde aportar, screening e IBOV (08/10/2026)

> A premissa central vira produto. A partir daqui, **um lote por vez** com `skipIntegration` e ledger de tokens.

## Lotes
| Lote | Ciclos | Agentes | Tokens | Commit |
|---|---|---|---|---|
| `w3-onde-aportar` | 2 | 5 | 878.438 | `407e805` |
| `w3-screening-filters` | 1 | 3 | 495.838 | `1c9af1d` |
| `w3-ibov-projections` | 1 | 3 | 411.632 | `61481fa` |
| Integração | — | 1 | 130.217 | `8a8f442` |

**Total ≈ 1,92 mi tokens.** tsc e eslint limpos, 326 testes.

## Entregas
- [[Onde aportar]]: motor determinístico, página `/onde-aportar` e e-mail mensal.
- [[Screening]]: liquidez visível, Bazin, PEG, DY 12m e "queda com fundamentos intactos".
- [[IBOV faixas estatísticas]]: faixas históricas, com a IA só no comentário.

## Lições
- O lote de feature nova com motor + página + integração custou ~2× um lote de ajuste.
- Commit preparatório `9d2a4e8`: `skipIntegration` no workflow.

## Relacionadas
[[Onda 2]] · [[Onda 4]] · [[Custo de tokens]] · [[00 - Início]]
