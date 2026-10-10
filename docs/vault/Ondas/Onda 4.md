---
tags: [onda, onda-4, dark-mode, ci]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, token-ledger.tsv (scratch)]
---
# Onda 4: limpeza, CI e dark mode liberado (09/10/2026)

> Os lotes `w3-cleanup-deps-ci` e `w3-dark-mode-final-qa`, planejados como onda 3 no backlog, rodaram como onda 4.

## Lotes
| Lote | Ciclos | Agentes | Tokens | Commit |
|---|---|---|---|---|
| `w3-cleanup-deps-ci` | 2 | 5 | 435.116 | `ad4cc22` |
| `w3-dark-mode-final-qa` | 1 | 3 | 477.307 | `e0c3907` |
| Compliance (coordenador) | — | — | — | `85eeb53` |
| Integração | — | 1 | 86.206 | `57fc0f1` |

**Total ≈ 1,00 mi tokens.** tsc, eslint, check-ui e check-compliance limpos, 343 testes.

## Entregas
- Código morto removido, dependências podadas e CI em `.github/workflows/quality.yml`, sem build. Ver [[Ambiente local e CI]].
- **Dark mode liberado**: o padrão é o tema do sistema e o seletor fica no header, no menu e no perfil. Ver [[Tema e dark mode]].
- Prompts de IA reescritos sem pedir "recomendação". Ver [[Compliance CVM]] e [[Revisão do coordenador]].

## Relacionadas
[[Onda 3]] · [[Onda 5]] · [[00 - Início]]
