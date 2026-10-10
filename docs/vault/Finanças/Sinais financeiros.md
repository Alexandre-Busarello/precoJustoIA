---
tags: [financas, sinais, helpers]
updated: 2026-10-09
fontes: [src/lib/finance/signals.ts, src/lib/finance/dividends.ts, src/lib/finance/valuation.ts, src/lib/finance/macro.ts, src/lib/finance/liquidity-rules.ts, src/lib/finance/sector-classification.ts, src/lib/allocation/fundamentals.ts]
---
# Sinais financeiros

> Helpers puros de `src/lib/finance/` (sem I/O, exceto `liquidity.ts`, `macro-sync.ts` e a leitura macro). `signals.ts` descreve preço e fundamentos para o [[Screening]] e o [[Onde aportar]]; "não são indicação de compra ou venda" (`signals.ts:1-5`).

## Fórmula — `signals.ts`
```
SMA(n)        = média dos n últimos fechamentos (null se < n pontos)          n padrão 200
pctAbove      = último / SMA − 1
drawdown52w   = último / máx(fechamentos nos últimos 364 dias) − 1
fundamentalsIntact: 8 trimestres consecutivos, últimos 4 vs 4 anteriores
   lucro 12m: Σ4 / Σ4ant − 1 ≥ −15%        (base ≤ 0: não pode piorar)
   ROE e margem 12m: queda ≤ 3 p.p.        ('ttm': último vs 4 tri antes; 'quarterly': soma/média)
   Dív.líq./EBITDA: alta ≤ 1,0x            (EBITDA 12m ≤ 0 → reprova)
dipWithIntactFundamentals = (pctAbove < 0  OU  drawdown ≤ −20%)  E  fundamentalsIntact
```
- SMA/posição: `src/lib/finance/signals.ts:25-45`; queda: `:57-64`; fundamentos: `:156-267`; queda com fundamentos: `:291-300`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| Queda máx. do lucro 12m | 15% | `signals.ts:78` |
| Queda máx. ROE / margem 12m | 3 p.p. / 3 p.p. | `signals.ts:80-82` |
| Alta máx. Dív.líq./EBITDA | 1,0x | `signals.ts:84` |
| Base padrão dos índices | `'ttm'` | `signals.ts:165` |
| Trimestres consecutivos | intervalo 75–110 dias | `signals.ts:138-139` |
| Limite de correção (drawdown) | −20% | `signals.ts:270` |
| Liquidez mínima (ação / FII / BDR) | R$ 1 mi / 500 mil / 200 mil por dia | `src/lib/finance/liquidity-rules.ts:12-16` |
| Extraordinário | > 2× mediana, sem repetição ±45 dias até 2,5× | `src/lib/finance/dividends.ts:182-186` |
| Histórico de proventos desatualizado | 18 meses | `dividends.ts:318` |
| IRRF do JCP | 15% até 2025; 17,5% desde 2026 | `dividends.ts:387-389` |
| Spread mínimo k − g | 4 p.p. | `src/lib/finance/valuation.ts:11` |
| Fallback macro | Selic 13,75%, CDI 13,65%, IPCA 12m 4%, NTN-B 7,68%, ERP 5,5%, UST 4,2% (asOf 2026-09-16) | `src/lib/finance/macro.ts:14-25` |
| Ke | max(Selic, rf nominal + β × ERP) | `macro.ts:135-137` |

## Filtros / quando não se aplica
- Dado ausente **reprova** com o check "dados insuficientes" — sem benefício da dúvida (`signals.ts:111`, `:131-133`). Idem liquidez: volume ausente = ilíquido (`liquidity-rules.ts:30-41`).
- No [[Onde aportar]] a base guarda balanço anual: cada ano vira 4 "trimestres" com 1/4 do lucro e EBITDA e índices repetidos (`'ttm'`); em financeiras o check de alavancagem é ignorado (`src/lib/allocation/fundamentals.ts:1-9`, `:52-75`).
- Classe setorial (`financial`, `utility`, `cyclicalCommodity`, `other`) por dicionário sem acento; imobiliário e fintech/software não são financeiras (`src/lib/finance/sector-classification.ts:19-62`).

## Saídas na UI
- [[Screening]]: filtro "Queda com fundamentos intactos" (`src/lib/strategies/screening-strategy.ts:99-118`), além de Bazin, PEG e DY 12m como colunas.
- [[Onde aportar]]: `fundamentalsStatus` exclui ativos sem dados ou com fundamentos piorando.
- [[Ranking]]: `applyLiquidityRules` exclui ilíquidos (BDR só é marcado) e mantém a classe mais líquida de cada empresa (`src/lib/ranking-models.ts:717-759`); badge "Baixa liquidez" nas páginas.
- Helpers de valuation usados pelos modelos: `equityFromEV`, `gordonValue`, `fairPVP`, `peg`, `lynchFairPE`, `ceilingPrice`, `magicFormulaRank` (`finance/valuation.ts:30-189`).

## Decisões e histórico
- Onda 1 (`395302f`): helpers puros e testados; `signals.ts` entrou por adendo do dono de 2026-09-29 (`w1-finance-foundation.md:91-96`) ([[Onda 1]]).
- Onda 2: `fundamentalsIntact` passa a `'ttm'` por padrão e exige trimestres consecutivos; `ipcaExpected` vira `ipca12m` (alias depreciado) e nunca é rotulado "IPCA esperado"; `magicFormulaRank` exclui ROIC ≤ 0 (`w2-valuation-core.md`, carry-over) ([[Onda 2]]).
- Onda 3 (`1c9af1d`, `407e805`): uso no screening e no motor determinístico do [[Onde aportar]] ([[Onda 3]]).

## Relacionadas
[[Bazin]] [[Gordon]] [[FCD]] [[Lynch]] [[Screening]] [[Onde aportar]] [[Fontes de dados]] [[Compliance CVM]]
