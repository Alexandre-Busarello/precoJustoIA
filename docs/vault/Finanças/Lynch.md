---
tags: [financas, valuation, lynch]
updated: 2026-10-09
fontes: [src/lib/strategies/lynch-strategy.ts, src/lib/finance/valuation.ts, src/lib/strategies/base-strategy.ts, src/lib/ranking-models.ts]
---
# Lynch

> Peter Lynch (PEG): **indicador relativo**, sem preço-alvo. Compara o P/L com o crescimento dos lucros e com um P/L de referência (crescimento + DY). Não se aplica a bancos, seguradoras, commodities cíclicas nem empresas com prejuízo.

## Fórmula
```
g     = min(CAGR de lucros 5a validado, teto)       (g ≤ 0 ou inválido → não se aplica)
P/L   = preço / LPA
PEG   = P/L / (g × 100)
P/L_ref = (g + DY) × 100                             (DY ausente ou ≤ 0 conta como 0)
faixas: PEG < 0,5 "muito barato" · 0,5 a 1 "barato" · > 1 "caro"
elegível = PEG ≤ PEG máx  E  P/L < P/L_ref
```
- Crescimento: `src/lib/strategies/lynch-strategy.ts:23-27` (validação `validateCAGR5Years`, `base-strategy.ts:119`).
- PEG e P/L de referência: `src/lib/finance/valuation.ts:117-127`.
- Faixas: `lynch-strategy.ts:16-20`; elegibilidade: `:94-95`, `:117`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| PEG máximo | 1 | `lynch-strategy.ts:9`, `ranking-models.ts:465` |
| Teto do crescimento | 25% | `lynch-strategy.ts:10` |
| Faixa "muito barato" | PEG < 0,5 | `lynch-strategy.ts:17` |
| Faixa "barato" | 0,5 ≤ PEG ≤ 1 | `lynch-strategy.ts:18` |
| Faixa "caro" | PEG > 1 | `lynch-strategy.ts:19` |

## Filtros / quando não se aplica
- BDR sem conversão (`lynch-strategy.ts:56-57`).
- Bancos e seguradoras: "o lucro cresce com alavancagem e o PEG distorce; veja P/VP justo" (`lynch-strategy.ts:67-72`) → [[P-VP bancos]].
- Commodities cíclicas: "P/L de pico distorce o PEG" (`lynch-strategy.ts:73-78`).
- LPA ≤ 0 (`:79-81`) ou sem crescimento positivo em 5 anos (`:83-86`).
- O resultado "não se aplica" vem com um único critério "Modelo aplicável" = falso (`lynch-strategy.ts:29-40`).
- Ranking: sem filtro de overall score; ordena pelo menor PEG (`lynch-strategy.ts:134-148`).

## Saídas na UI
- `fairValue`, `upside` e `discount` sempre `null` (`lynch-strategy.ts:119-121`); `key_metrics`: `pl`, `peg`, `growthRate`, `fairPE` (`:124-130`).
- Página do ativo: "Peter Lynch (PEG)", premium; a linha segue a proporção de critérios ("Atende / Em parte / Não atende"), não a margem (`src/components/asset/valuation-models.ts:97-104`, `:197-212`).
- Ranking: "Peter Lynch (PEG)", slider "PEG máximo" (`ranking-models.ts:453-466`); o registro não define coluna de score.
- Screening: filtro "PEG" pelo mesmo cálculo (`src/lib/strategies/screening-strategy.ts:63-64`, `:446-450`).

## Decisões e histórico
- Onda 2 (`986090d`): modelo criado com preço justo = LPA × (g + DY) ([[Onda 2]]).
- `7d2503a` (decisão delegada pelo dono): **Lynch vira indicador relativo (PEG e faixas, sem preço-alvo)** e não se aplica a bancos e seguradoras — o preço-alvo dava potenciais de centenas de % em P/L baixo (`lynch-strategy.ts:42-47`, [[Decisões do dono]]).
- Pendente (`RESUME.md:86`): no ranking, a linha do Lynch ainda exibe o preço justo de outro modelo.
- No código: `lynch` está em `FAIR_VALUE_MODEL_KEYS` (`ranking-models.ts:601`) embora não gere preço justo.

## Relacionadas
[[P-L baixo]] [[Estratégia 3+1]] [[P-VP bancos]] [[Screening]] [[Ranking]] [[Decisões do dono]]
