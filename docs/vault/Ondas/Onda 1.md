---
tags: [onda, onda-1, paginas]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/backlog.json, docs/melhorias-2026-09/RESUME.md]
---
# Onda 1: páginas (29–30/09/2026)

> 13 lotes em paralelo (concorrência 3) migram as páginas para o design system, corrigem bugs de dados visíveis e criam os helpers financeiros puros.

## Lotes e commits
| Lote | Commit |
|---|---|
| `w1-finance-foundation` (helpers puros de dividendos, valuation, liquidez e macro) | `395302f` |
| `w1-asset-fii-etf-bdr` | `82cf1d1` |
| `w1-asset-stock` (AssetHeader, valuation em tabela) | `2463a12` |
| `w1-home-pricing-checkout` | `2775289` |
| `w1-asset-indicators-ai` (média de 7 anos, demonstrativos) | `e340fa8` |
| `w1-dashboard-alerts` | `c08d34e` |
| `w1-technical-radars` (sem sinais de compra) | `0f00d7c` |
| `w1-screening` (dois painéis, IA inline) | `9f5dc31` |
| `w1-portfolio` (cards mobile) | `4c65a67` |
| `w1-ranking` (sem tela intermediária, registro de modelos) | `ed5428f` |
| `w1-comparador` (tabela única, ETFs como aba) | `7fb6f37` |
| `w1-backtest` (landing pública, carteira de exemplo) | `9f3ac36` |
| `w1-account-ben-onboarding` | `7ff4c71` |
| Integração | `7134d14` |

Todos foram aprovados pelo QA.

## Decisões
- `src/lib/finance/signals.ts` nasce aqui e é reaproveitado pelo screening na [[Onda 3]]. Ver [[Sinais financeiros]].
- Selos de confiança inventados foram removidos ("4,8 · 1.250 avaliações").

## Lições
- Com 13 lotes, a disjunção dos OWNED PATHS precisa ser verificada por script.
- Arquivos compartilhados (Footer antigo) geraram pendências "o dono remove o import; a onda 4 apaga o export".

## Relacionadas
[[Onda 0]] · [[Onda 2]] · [[00 - Início]]
