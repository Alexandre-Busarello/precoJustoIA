---
tags: [financas, valuation, bazin]
updated: 2026-10-09
fontes: [src/lib/strategies/bazin-strategy.ts, src/lib/finance/dividends.ts, src/lib/finance/valuation.ts, src/lib/ranking-models.ts]
---
# Bazin

> Preço-teto de Décio Bazin: média anual dos proventos brutos dos últimos 5 anos-calendário completos, **sem extraordinários**, dividida pelo DY alvo (6%). Exige dívida baixa e lucros consistentes.

## Fórmula
```
média  = Σ proventos(ano) / nº de anos completos      (anos N−1 … N−5; ano corrente nunca entra;
                                                       1º ano de cobertura sai se for parcial)
teto   = média / DY_alvo                              (DY_alvo inválido → 6%)
DY_méd = média / preço                                elegível exige DY_méd ≥ DY_alvo (= preço ≤ teto)
```
- Classe: `src/lib/strategies/bazin-strategy.ts:116-245`; anos completos: `src/lib/finance/dividends.ts:262-305`.
- Preço-teto puro: `src/lib/finance/valuation.ts:130-133`.
- Extraordinários removidos por padrão: `bazin-strategy.ts:134-136` (`removeExtraordinary`, `dividends.ts:218`).
- JCP líquido opcional (`useNetJcp`, IRRF 15% até 2025 / 17,5% desde 2026): `bazin-strategy.ts:137`, `dividends.ts:387-389`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| DY alvo | 6% | `bazin-strategy.ts:17`, `ranking-models.ts:448` |
| Anos na média | 5 | `bazin-strategy.ts:18` |
| Mín. de anos completos | 3 | `bazin-strategy.ts:32` |
| Dív. líq./PL máx. (não financeiras) | 0,5x | `bazin-strategy.ts:19` |
| Financeiras: ROE médio 5a | ≥ 12% | `bazin-strategy.ts:34` |
| Financeiras: payout | 25%–80% | `bazin-strategy.ts:35` |
| Lucros consistentes | ≤ 2 prejuízos em 8 anos (≤ 1 em 5–7; 0 em < 5) | `base-strategy.ts:869-923` |
| Janela de proventos carregada | 6 anos + corrente | `bazin-strategy.ts:52` |

## Filtros / quando não se aplica
- BDR sem conversão → não aplicável (`bazin-strategy.ts:124-125`).
- Menos de 3 anos completos → sem teto, com texto "Histórico de proventos insuficiente" (`bazin-strategy.ts:205-206`).
- Elegível só com **todos** os critérios: histórico, DY, saúde financeira e lucros (`bazin-strategy.ts:200`) — sem tolerância de falhas.
- Ranking: sem filtro de overall score; ordena por maior DY médio (`bazin-strategy.ts:247-261`).

## Saídas na UI
- Página do ativo: **uma** linha "Preço-teto (Bazin)", premium (campo `plan` permite liberar no grátis) (`src/components/asset/valuation-models.ts:88-96`).
- Critério de DY mostra a média, o DY médio e "R$ X em proventos extraordinários fora da média" (`bazin-strategy.ts:144-164`); o texto explica o valor retirado (`:216-218`).
- Ranking: coluna "DY médio" e "Preço-teto" (`ranking-models.ts:449-451`).
- Screening: filtro "Desconto vs. preço-teto Bazin" com o mesmo cálculo (`src/lib/strategies/screening-strategy.ts:57-60`, `:437-441`).
- Alertas de preço-teto usam a mesma regra (`src/lib/custom-trigger-service.ts:258`). Modelo do [[Onde aportar]].

## Decisões e histórico
- Onda 2 (`986090d`): modelo criado ([[Onda 2]], `docs/melhorias-2026-09/batches/w2-rankings-new-models.md`).
- `7d2503a` (decisão delegada pelo dono): Bazin **exclui extraordinários por padrão e mostra o valor retirado**; a página tem uma só linha "Preço-teto (Bazin)"; o Barsi passa a usar a mesma base ([[Decisões do dono]], `RESUME.md:46`).
- No código: `strategy.md:191` previa Bazin visível no grátis, mas o registro está `plan: 'premium'` (`valuation-models.ts:93`).
- Pendente (`RESUME.md:83`): BDR recebe nota de conversão mesmo com fator 1.

## Relacionadas
[[Barsi]] [[Gordon]] [[Anti-armadilha]] [[Margem de segurança e upside]] [[FII score e preço-teto]] [[Ranking]] [[Screening]] [[Onde aportar]]
