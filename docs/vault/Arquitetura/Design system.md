---
tags: [arquitetura, design-system]
updated: 2026-10-09
fontes: [src/app/globals.css, src/components/ui/, src/components/asset/, src/components/page-header.tsx, src/lib/format.ts, src/lib/valuation-metrics.ts, scripts/check-ui.sh, scripts/check-compliance.sh, docs/melhorias-2026-09/reports/ux-ui.md]
---
# Design system
> Tokens semânticos em `globals.css`, primitivos em `src/components/ui`, blocos de ativo em `src/components/asset` e formatação pt-BR única em `@/lib/format`. Dois scripts barram regressões visuais e de compliance.

## Como funciona
**Tokens** (`src/app/globals.css`, spec em `docs/melhorias-2026-09/reports/ux-ui.md` §2.2): `background`, `foreground`, `surface`, `card`, `muted`, `border`, `brand`/`brand-subtle`, `positive`/`negative`/`warning` (+ `-subtle`), `chart-1…5`, `radius-sm…xl`, `font-sans`/`font-mono` (Geist). Números com `tabular-nums` em `table` e `[data-num]`.

**Componentes da [[Onda 0]]**
- `ui/stat.tsx` — `Stat`: rótulo, valor grande `tabular-nums`, delta opcional, dica e estado bloqueado.
- `ui/section-header.tsx` — `SectionHeader` (título, descrição, slot de ações; as ações quebram linha desde a onda 6).
- `src/components/page-header.tsx` — `PageHeader` (breadcrumb, H1, descrição, ações).
- `ui/data-table.tsx` — `DataTable<T>`: colunas tipadas, ordenação no cliente, cabeçalho fixo, primeira coluna fixa, linhas densas, skeleton, estado vazio, linhas expansíveis.
- `ui/info-hint.tsx` — `InfoHint`: ajuda em Popover (toque e mouse), ícone de 16 px em área de 44×44. `info-tooltip.tsx` virou wrapper dele.
- `asset/asset-header.tsx` — `AssetHeader`: ticker, nome, 4 Stats (Preço, Preço justo, Margem de segurança, Score), ações e bloqueios por plano.
- `asset/score-card.tsx` — `ScoreCard` (`compact`/`full`, pilares em barras) e `ScoreBar`.
- `asset/asset-section-nav.tsx` — `AssetSectionNav`: abas âncora fixas com IntersectionObserver.
- `ui/badge.tsx` — `Badge` com `neutral`, `positive`, `negative`, `warning`, `brand` (nomes legados mapeados).
- Também: `button` (sem gradiente), `card` sem margem externa, `tabs` (`underline`/`segmented`, rolagem horizontal), `dialog`/`sheet`/`popover`.

**Formatação** — `src/lib/format.ts`: `formatBRL`, `formatCompact`, `formatBRLCompact` ("R$ 625,7 bi"), `formatPct`, `formatDeltaPct` (sinal sempre, menos U+2212), `formatMultiple` ("10,8x"), `formatNumber`, `formatDate` (`short`/`datetime`/`relative`, opção `dateOnly` e `isMidnightUtc`), `formatNullable`; vazio = `EMPTY_VALUE` ("—"). `src/lib/valuation-metrics.ts`: `marginOfSafety`, `upside`, `valuationStatus`.

**Guarda-corpos**
- `scripts/check-ui.sh` (`yarn check:ui`): falha em `bg-gradient-to-`, `bg-clip-text`, `backdrop-blur`, `font-black/extrabold`, `shadow-lg/xl/2xl` fora dos overlays, emoji em `.tsx` e `text-purple/violet/indigo/pink-`. `--all` imprime contagens. Exceções em `scripts/check-ui.allowlist`.
- `scripts/check-compliance.sh`: termos proibidos na copy ("Compra", "Sinal de compra", "Região segura", "garantid*", "preditiv*", "melhores ações", "recomendação"…), com tratamento de negações ("não é recomendação") e exceções em `scripts/check-compliance.allowlist`. Ver [[Compliance CVM]].

## Regras / limites
- **Mobile:** alvos de toque ≥ 44 px (`Button` `h-11`/`size-11` no mobile, `pointer-coarse:min-h-11`); inputs com `text-base` (16 px) abaixo de `md` para o iOS não dar zoom; nada de rolagem horizontal a 320/360.
- Sem gradientes, blur, sombras grandes, emoji ou roxo na UI; cor só para sinal (positivo/negativo/aviso).
- Datas "só dia" (data-ex, pagamento) formatadas em UTC; timestamps em America/Sao_Paulo (onda 5).

## Histórico nas ondas
- [[Onda 0]]: `6ad9d41` (tokens, primitivos, `format.ts`, shell, `check-ui.sh`).
- [[Onda 1]]/[[Onda 2]]: telas migradas; `check-compliance.sh` criado em `c463adb`.
- [[Onda 4]]: emoji na UI chegou a 0; check-ui/check-compliance limpos na integração `57fc0f1`.
- [[Onda 5]]: `formatDate` com `dateOnly`; toques de 44 px (`6e7d08c`).

## Pendências
- Conferir telas com `SectionHeader` depois da mudança da onda 6.
- `src/app/admin/**` fora do design system.

## Relacionadas
[[Tema e dark mode]] · [[Compliance CVM]] · [[Ambiente local e CI]] · [[Harness]]
