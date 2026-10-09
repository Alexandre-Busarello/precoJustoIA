---
tags: [financas, valuation, margem]
updated: 2026-10-09
fontes: [src/lib/valuation-metrics.ts, src/lib/strategies/base-strategy.ts, src/lib/strategies/strategy-config.ts, src/lib/ranking-models.ts]
---
# Margem de segurança e upside

> Duas leituras do mesmo par preço × preço justo. **Margem de segurança** (desconto) = 1 − P/VJ. **Potencial** (upside) = VJ/P − 1. Fonte única: `src/lib/valuation-metrics.ts`.

## Fórmula
```
margem   = 1 − preço / VJ        (fração)   VJ 100, preço 75 → 0,25
potencial = VJ / preço − 1       (fração)   VJ 100, preço 75 → 0,3333
conversão: potencial mínimo u ⇔ desconto mínimo 1 − 1/(1+u)
           20% de potencial = 16,67% de desconto; 15% = 13,04%
```
- `marginOfSafety` e `upside`: `src/lib/valuation-metrics.ts:15-24` (`null` se preço ou VJ ausente ou ≤ 0).
- Nas estratégias: `discountFraction` (fração) e `upsidePercent` (pontos percentuais, 33,3 = 33,3%) — `src/lib/strategies/base-strategy.ts:229-237`.
- Conversão documentada: `src/lib/strategies/strategy-config.ts:4-7`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| Faixa "Dentro da faixa estimada" | \|margem\| < 5% (arredondada como exibida) | `valuation-metrics.ts:29`, `:49-54` |
| Status | margem > 0 "Abaixo do preço justo"; < 0 "Acima do preço justo" | `valuation-metrics.ts:31-35` |
| Potencial plausível máx. | 500% (acima: VJ descartado) | `base-strategy.ts:226`, `:240-243` |
| Graham: desconto mín. (registro B3 / BDR) | 20% / 15% | `ranking-models.ts:176` |
| FCD: desconto mín. (registro B3 / BDR) | 15% / 10% | `ranking-models.ts:270` |
| Gordon: desconto mín. | 10% | `gordon-strategy.ts:30` |
| Graham: "Potencial ≥ 10%" (análise) | upside | `graham-strategy.ts:108` |

## Filtros / quando não se aplica
- Modelos sem preço justo (Fórmula Mágica, P/L baixo, anti-armadilha, 3+1, Lynch) devolvem `fairValue`/`upside` nulos; a linha da página usa a proporção de critérios ("Atende / Em parte / Não atende") — `src/components/asset/valuation-models.ts:197-212`.

## Saídas na UI
- Resultado de ranking traz os dois: `upside` (p.p.) e `marginOfSafety` (desconto em p.p.) — `base-strategy.ts:796-814`; Bazin/Lynch/P-VP usam `toRankingResult` (`bazin-strategy.ts:85-99`).
- Página do ativo: "Margem de segurança" = desconto e "Potencial" na linha expandida (`w2-valuation-core.md` §9).
- Sliders do ranking: "Margem de segurança mínima", com dica "1 − preço ÷ preço justo" (`ranking-models.ts:167-172`, `:255-261`).
- [[Onde aportar]] usa `marginOfSafety` (`src/lib/allocation/engine.ts:85`).

## Decisões e histórico
- Onda 2 (`27fc167`): todo resultado passa a ter `discount` e `upside`; filtros chamados `marginOfSafety` passam à semântica de desconto ([[Onda 2]]).
- Pendência pós-onda 2 (`RESUME.md:57`): sliders de Graham/FCD diziam "Upside mínimo 20%" mas filtravam margem — **rótulo já corrigido** no registro atual. Ainda abertos: Graham mistura as duas leituras (`graham-strategy.ts:108` × `:185`) e a página mostra "Score do modelo" e "Score de qualidade" juntos.
- No código: os padrões do registro (Graham 0,20; FCD 0,15) são mais exigentes que os do `STRATEGY_CONFIG` convertidos (0,1667; 0,13), e são eles que valem na página e no ranking (`fairValueModelParams`, `ranking-models.ts:621-629`).

## Relacionadas
[[Graham]] [[FCD]] [[Gordon]] [[Bazin]] [[P-VP bancos]] [[Ranking]] [[Onde aportar]] [[Compliance CVM]]
