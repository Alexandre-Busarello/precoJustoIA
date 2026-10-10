---
tags: [financas, valuation, fundamentalista]
updated: 2026-10-09
fontes: [src/lib/strategies/fundamentalist-strategy.ts, src/lib/strategies/strategy-config.ts, src/lib/ranking-models.ts]
---
# Estratégia 3+1

> "Fundamentalista 3+1" (no código: `FundamentalistStrategy`, chave `fundamentalist`): três indicadores — qualidade, preço e endividamento — escolhidos conforme o perfil da empresa, mais um bônus de dividendos. Score de 0 a 100, sem preço justo.

## Fórmula
```
score = qualidade (até 35) + preço (até 30) + dívida (até 20) + dividendos (até 15)     (teto 100)

perfil            qualidade   preço                    dívida
banco/seguradora  ROE         P/L                      20 fixo (não avaliada)
sem dívida rel.   ROE         P/L vs CAGR lucros 5a    Dív.líq./EBITDA
com dívida rel.   ROIC        EV/EBITDA                Dív.líq./EBITDA
"dívida relevante" = Dív.líq./EBITDA > 0
```
- Passos: `src/lib/strategies/fundamentalist-strategy.ts:52-133` (qualidade), `:135-239` (preço), `:241-272` (dívida), `:274-300` (dividendos), soma `:303-306`.

## Parâmetros e limiares
| Item | Faixas → pontos | Onde |
|---|---|---|
| Qualidade (ROE ou ROIC) | ≥ mín. (15%) → 35; ≥ 10% → 25; ≥ 5% → 15; < 5% → 5 e **inelegível** | `fundamentalist-strategy.ts:63-77`, `:89-103`, `:113-127` |
| Preço banco (P/L) | ≤ 8 → 30; ≤ 12 → 25; ≤ 18 → 15; ≤ 25 → 10; > 25 → 5 | `:146-162` |
| Preço sem dívida (P/L vs CAGR%) | ≤ 0,8×CAGR → 30; ≤ CAGR → 25; ≤ 1,5×CAGR → 15; senão 5 | `:177-193` |
| Preço sem dívida, sem CAGR confiável | P/L ≤ 10 → 25; ≤ 15 → 15; senão 5 | `:194-206` |
| Preço com dívida (EV/EBITDA) | ≤ 6 → 30; ≤ 10 → 25; ≤ 15 → 15; ≤ 20 → 10; > 20 → 5 | `:217-233` |
| Dívida (Dív.líq./EBITDA) | < 0 ou ≤ 1 → 20; ≤ 2 → 15; ≤ máx. (3) → 10; > máx. → 0 e **inelegível**; sem dado → 10 | `:250-271` |
| Dividendos | payout na faixa (40–80%) e DY ≥ 4% → 15; payout ≥ mín. e DY ≥ 2% → 10; paga algo → 5; só DY ≥ 4% → 8 | `:280-300` |
| Padrões | ROE 15%, ROIC 15%, Dív./EBITDA 3x, payout 40–80% | `:21-25`, `strategy-config.ts:69-78` |
| Registro do ranking (BDR) | Dív./EBITDA 4x, payout 30–90% | `src/lib/ranking-models.ts:364-371` |

## Filtros / quando não se aplica
- Inelegível também sem ROE/ROIC, sem P/L positivo ou sem EV/EBITDA (`fundamentalist-strategy.ts:78-81`, `:163-166`, `:234-237`).
- `validateCompanyData`: preço > 0 e ROE ou ROIC presentes (`:515-528`).
- No código: a detecção de banco/seguradora usa lista própria por substring do setor (`bancos`, `seguradoras`, `previdência`, `serviços financeiros`, `intermediários financeiros`, `:368-380`), **não** a `sector-classification` usada pelos demais modelos.
- Ranking: overall score > 50, `shouldExcludeCompany`, só elegíveis; ordena por `fundamentalistScore` (`:434-478`).

## Saídas na UI
- Critérios exibidos: "Qualidade da Empresa" (≥ 25 pts), "Preço Atrativo" (≥ 20), "Endividamento Controlado" (≥ 15), "Dividendos (Bônus)" (≥ 8) (`fundamentalist-strategy.ts:330-355`).
- Página do ativo: "Fundamentalista 3+1", premium (`src/components/asset/valuation-models.ts:81-87`).
- Ranking: premium, 5 sliders, coluna Score = `fundamentalistScore` (`ranking-models.ts:321-373`). Entra no [[Overall score]] (`base-strategy.ts:967`).

## Decisões e histórico
- Não há lote específico das ondas 2026-09 para este modelo nos documentos lidos; o texto da metodologia (`:480-513`) ainda usa caixa alta e emojis no racional (`:398-427`), que a UI remove (`localizeStrategyText`, `valuation-models.ts:254`).

## Relacionadas
[[Lynch]] [[P-L baixo]] [[Fórmula Mágica]] [[Overall score]] [[Ranking]]
