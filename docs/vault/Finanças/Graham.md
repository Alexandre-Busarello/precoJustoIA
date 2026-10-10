---
tags: [financas, valuation, graham]
updated: 2026-10-09
fontes: [src/lib/strategies/graham-strategy.ts, src/lib/strategies/base-strategy.ts, src/lib/ranking-models.ts, src/lib/strategies/strategy-config.ts]
---
# Graham

> Número de Graham: √(22,5 × LPA × VPA) é o **preço máximo do investidor defensivo** (P/L 15 × P/VP 1,5), não um "valor justo". Rótulo no código: `Número de Graham (preço máximo defensivo)` (`src/lib/strategies/graham-strategy.ts:17`).

## Fórmula
```
VJ = √(22,5 × LPA × VPA) × fatorPorRecibo        (BDR; 1 para ações)
LPA = média dos últimos 5 anos (atual + histórico, sem repetir o ano)
      se houver ≥ 3 anos (≥ 2 em commodity cíclica); senão LPA atual
```
- Cálculo: `src/lib/strategies/base-strategy.ts:625`; LPA normalizado: `graham-strategy.ts:39-61`.
- LPA ≤ 0 ou VPA ≤ 0 → sem preço (`base-strategy.ts:623-626`).
- Potencial > 500% → preço descartado como erro de dados (`graham-strategy.ts:94`, `MAX_PLAUSIBLE_UPSIDE` em `base-strategy.ts:226`).

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| Anos do LPA normalizado | 5 | `graham-strategy.ts:20` |
| Mín. de anos (geral / cíclica) | 3 / 2 | `graham-strategy.ts:22-23` |
| Critério "Potencial ≥ 10%" (análise) | 10% de upside | `graham-strategy.ts:108`, `:129` |
| ROE mínimo (ação / BDR) | 10% / 12% | `graham-strategy.ts:101` |
| Liquidez corrente | ≥ 1,0 | `graham-strategy.ts:102` |
| Dív. líq./PL (ação / BDR) | ≤ 1,5 / 2,0 | `graham-strategy.ts:103` |
| Crescimento dos lucros | ≥ −15% (ou CAGR 5a > 0) | `graham-strategy.ts:121` |
| Market cap (ação / BDR) | R$ 2 bi / R$ 5 bi | `graham-strategy.ts:104` |
| Falhas toleradas | 2 critérios | `graham-strategy.ts:128` |
| Desconto mínimo no ranking (padrão do registro) | 20% (BDR 15%) | `src/lib/ranking-models.ts:176` |
| Desconto mínimo em `STRATEGY_CONFIG` | 16,67% | `strategy-config.ts:14` |

## Filtros / quando não se aplica
- BDR sem paridade/câmbio → "não aplicável" (`graham-strategy.ts:74-75`).
- Bancos e seguradoras não são avaliados por liquidez corrente nem Dív./PL (`graham-strategy.ts:112-118`).
- Ranking: overall score > 50 (`base-strategy.ts:1140`), desconto ≥ mínimo, market cap mínimo, lucros consistentes e overall score ≥ 50 recalculado (`shouldExcludeCompany`, `base-strategy.ts:988`) — `graham-strategy.ts:188-200`.

## Saídas na UI
- `score` = % de critérios atendidos; `qualityScore` = 60% margem (desconto × 180, teto 60) + 40% fundamentos (`graham-strategy.ts:133-139`).
- Ranking ordena por `qualityScore` (`graham-strategy.ts:204`) e mostra "Score" = `qualityScore` (`ranking-models.ts:177`).
- Página do ativo: linha "Número de Graham", plano **free** (exige login) (`src/components/asset/valuation-models.ts:36-43`). Na página o `score` é substituído pela contribuição do overall score (`src/lib/company-analysis-service.ts:630-634`).
- Usado no [[Onde aportar]] (único modelo gratuito, `src/lib/allocation/constants.ts:44`) e no [[Overall score]].

## Decisões e histórico
- Onda 2 (`27fc167`): rótulo "preço máximo defensivo", LPA normalizado, semântica margem × potencial ([[Onda 2]]).
- Os sliders do ranking diziam "Upside mínimo" mas filtravam margem; hoje o rótulo é "Margem de segurança mínima" (`ranking-models.ts:167`).
- **Ainda misturado no código:** a análise usa *potencial* ≥ 10% (`:108`) e o ranking usa *desconto* ≥ mínimo (`:185`, `:199`) — pendência registrada em `docs/melhorias-2026-09/RESUME.md:57`.
- No código: o padrão do registro (0,20 de desconto ≈ 25% de potencial) é mais exigente que o comentário de conversão do `STRATEGY_CONFIG` (0,1667 = antigo potencial de 20%). A página e o ranking usam o do registro (`fairValueModelParams`, `ranking-models.ts:621`).

## Relacionadas
[[Margem de segurança e upside]] [[FCD]] [[P-VP bancos]] [[Overall score]] [[Ranking]] [[Onde aportar]] [[Decisões do dono]]
