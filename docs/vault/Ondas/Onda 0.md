---
tags: [onda, onda-0, fundacao]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/batches/w0-foundation.md, docs/melhorias-2026-09/RESUME.md]
---
# Onda 0: fundação (29/09/2026)

> Um lote sozinho, porque todo o resto importa dele: design tokens, a infraestrutura do dark mode, componentes primitivos, formatação pt-BR, header/footer/nav mobile e a política de interrupções.

## Lote
| Lote | Resultado | Commit |
|---|---|---|
| `w0-foundation` (52 owned paths) | Aprovado pelo QA no 3º ciclo | `6ad9d41` |
| Integração | — | `b5aca7c` |

Commits de apoio:
- `adb0f6a`: package-lock com next-themes;
- `5b2c491`: seed local;
- `abb9915`: plano;
- `9caacea`: pendências.

## O que nasceu aqui
- `src/lib/format.ts`: `formatBRL`, `formatPct(fraction)`, `formatDate`…
- `src/lib/valuation-metrics.ts`: margem × potencial. Ver [[Margem de segurança e upside]].
- Componentes `Stat`, `SectionHeader`, `PageHeader`, `DataTable`, `InfoHint`, `AssetHeader`, `ScoreCard`, `AssetSectionNav` e variantes de `Badge`. Ver [[Design system]].
- `ThemeProvider` (next-themes) com o seletor escondido. Ver [[Tema e dark mode]].
- `claimModalSlot()`: no máximo um modal por página.
- `scripts/check-ui.sh`.

## Decisões
Tema padrão claro e seletor escondido até a [[Onda 4]]. As decisões de shell (header de 56 px, bottom nav para logados, sem popup proativo do Ben) vêm da strategy.md §3.

## Lições
- A fundação precisou de 3 ciclos. Specs de fundação devem listar exatamente os componentes e as APIs esperadas.
- Ao fim da sessão, o disco estava 99% cheio por causa das screenshots. Daí a regra de disco do workflow (`2c7f909`).

## Relacionadas
[[Onda 1]] · [[Harness]] · [[00 - Início]]
