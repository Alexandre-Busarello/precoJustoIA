---
tags: [onda, onda-5, dados, plataforma]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, token-ledger.tsv (scratch)]
---
# Onda 5: pendências acumuladas (09/10/2026)

> Os mesmos números na página do ativo e no ranking, correções de plataforma, dedupe de proventos, BDR por paridade e Ben no mobile.

## Lotes
| Lote | Ciclos | Agentes | Tokens | Commit |
|---|---|---|---|---|
| `w5-data-consistency` | wip (aprovado pelo coordenador) | 5 | 644.677 | `0c8c9ca` + `3836ac7` |
| `w5-platform-fixes` | 1 | 3 | 360.997 | `44aa012` + `86ffed8` |
| `w5-dividends-bdr-data` | 1 | 3 | 377.831 | `4782de7` + `f15d22f` |
| `w5-mobile-ben-a11y` | 2 | 5 | 492.759 | `6e7d08c` |
| Integração | — | 1 | 187.736 | `0940f2c` |

**Total ≈ 2,06 mi tokens.** 384 testes. BDRs passam a ter preço justo convertido.

## Intervenções do coordenador
- `86ffed8`: o rate limit começa em `log`, não em `enforce`. Ver [[Middleware e rate limit]].
- `f15d22f`: a gravação de proventos **não apaga** linhas do Yahoo. O dedupe passa a ser só na leitura (`dedupeDividends`).
- Ver [[Revisão do coordenador]].

## Entregas
- Cache da análise v6 (`3836ac7`).
- Backtest sem carteiras duplicadas e datas sem fuso (date-only).
- Gating do `/api/sector-analysis` e redirect do `/login` para quem já está logado.
- BDR via paridade e câmbio, sem mudar o schema.
- Ben no mobile e alvos de toque de 44 px.

## Relacionadas
[[Onda 4]] · [[Onda 6]] · [[Agenda de proventos]] · [[00 - Início]]
