---
tags: [financas, valuation, fcd]
updated: 2026-10-09
fontes: [src/lib/strategies/fcd-strategy.ts, src/lib/strategies/base-strategy.ts, src/lib/finance/valuation.ts, src/lib/finance/macro.ts, src/lib/ranking-models.ts]
---
# FCD

> Fluxo de caixa descontado: projeta o FCFF (ou o fluxo alavancado) por N anos com crescimento convergente, soma o valor terminal de Gordon e passa do valor da firma ao acionista pela dívida líquida.

## Fórmula
```
FCFF = EBIT × (1 − 34%) + D&A − Capex − ΔNCG
       D&A = EBITDA − EBIT; Capex = −fluxo de investimento; ΔNCG = −variação de ativos/passivos (DFC)
g_t  = g0 + (g_term − g0) × t / N         (converge linearmente; no ano N = g_term)
g0   = min(CAGR receitas 5a, CAGR lucros 5a), limitado a [−5%, 10%]
VP   = Σ FCF_t / (1+r)^t  +  [FCF_N × (1+g_term) / (r − g_term)] / (1+r)^N
FCFF: r = WACC → EV;  Equity = EV − (dívida total − caixa)   (fallback: EV_modelo − (EV_mercado − market cap))
FCFE: r = Ke  → valor do acionista direto (sem subtrair dívida)
VJ   = Equity / ações × fatorPorRecibo
WACC = E/(D+E) × Ke + D/(D+E) × Kd × (1 − 34%);  Kd = Selic (ou UST 10y) + 2 p.p.
Ke   = max(Selic, (1+NTN-B real)(1+IPCA 12m) − 1 + β × ERP), β = 1
```
- FCFF: `src/lib/strategies/base-strategy.ts:315-328`, montagem em `fcd-strategy.ts:71-98`.
- Projeção e valor terminal: `base-strategy.ts:296-312`; convergência: `:266-268`.
- Ponte EV → Equity: `src/lib/finance/valuation.ts:56-66`; uso em `fcd-strategy.ts:190-204`.
- Taxas: `fcd-strategy.ts:118-130`; Ke: `src/lib/finance/macro.ts:135-150`.

## Parâmetros e limiares
| Parâmetro | Valor | Onde |
|---|---|---|
| g terminal BRL (faixa / padrão config) | 4%–5% / 4,5% | `fcd-strategy.ts:28` |
| g terminal padrão do ranking e da página | 4% | `ranking-models.ts:267` |
| g terminal USD (BDR em dólar) | 2,5% | `fcd-strategy.ts:30` |
| g inicial (teto / piso) | 10% / −5% | `fcd-strategy.ts:32-34` |
| Spread mínimo r − g | 4 p.p. | `finance/valuation.ts:11`, `base-strategy.ts:298` |
| IR + CSLL | 34% | `base-strategy.ts:220` |
| Spread de crédito | 2 p.p. | `base-strategy.ts:223` |
| Taxa informada (`discountRate`) | só vale se > taxa macro | `fcd-strategy.ts:172` |
| Margem mínima (config / registro B3 / BDR) | 13% / 15% / 10% | `strategy-config.ts:51`, `ranking-models.ts:270` |
| Dív. líq./EBITDA máx. | 3x (critério e corte do ranking) | `fcd-strategy.ts:36`, `:350` |
| ROE / margem EBITDA / LC (ação) | 12% / 15% / 1,2 | `fcd-strategy.ts:215-217` |
| Falhas toleradas | 2 critérios | `fcd-strategy.ts:253` |
| Premissas macro de fallback | Selic 13,75%, NTN-B 7,68%, IPCA 4%, ERP 5,5%, UST 4,2% | `finance/macro.ts:14-25` |

## Filtros / quando não se aplica
- Bancos e seguradoras: "Modelo não se aplica a bancos e seguradoras; veja P/VP justo." (`fcd-strategy.ts:38`, `:143`) → [[P-VP bancos]].
- BDR sem conversão → não aplicável (`fcd-strategy.ts:144-145`).
- Fluxo-base ≤ 0, spread < 4 p.p., dívida líquida > EV ou potencial > 500% → sem preço (`fcd-strategy.ts:180-211`).
- Ranking: overall score > 50, desconto ≥ mínimo, market cap ≥ R$ 2 bi, Dív./EBITDA ≤ 3, `shouldExcludeCompany` (`fcd-strategy.ts:333-352`).

## Saídas na UI
- `fcdQualityScore` (ROE, margem EBITDA, crescimento, LC + até 5 pts pela margem) (`fcd-strategy.ts:257-265`); ranking ordena por margem de segurança (`:357`).
- Página do ativo: premium; detalhe mostra ponte EV → Equity e "valor terminal: N% do total" (`terminalValueShare`, `fcd-strategy.ts:273-276`, `:293-294`). Modelo padrão do cabeçalho para não financeiras (`valuation-models.ts:159`).

## Decisões e histórico
- Onda 2 (`27fc167`): fim do `EBITDA × 0,6` e do `0,05·e^(−0,5t)`; Ke macro; ponte EV → Equity; financeiras fora ([[Onda 2]], `docs/melhorias-2026-09/batches/w2-valuation-core.md`).
- Onda 5 (`0c8c9ca`, `3836ac7`): página e ranking passam a usar os mesmos padrões do registro (`fairValueModelParams`) ([[Onda 5]]).
- No código: o slider "Taxa de desconto (WACC)" tem padrão 10% (`ranking-models.ts:268`), abaixo do Ke macro, então na prática não muda o resultado.

## Relacionadas
[[Margem de segurança e upside]] [[Gordon]] [[P-VP bancos]] [[Overall score]] [[Ranking]] [[Onde aportar]]
