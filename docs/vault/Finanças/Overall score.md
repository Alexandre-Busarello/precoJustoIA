---
tags: [financas, score]
updated: 2026-10-09
fontes: [src/lib/strategies/overall-score.ts, src/lib/calculate-company-score-service.ts]
---
# Overall score
> A nota geral (0–100) de ações e BDRs é a média ponderada dos modelos com dado disponível. Depois vêm as penalizações por dívida, margem, risco das demonstrações e flag de IA. A nota sai com `qualityLabel` e `dataCoverage`.

## Fórmula / como funciona
`calculateOverallScore` (`src/lib/strategies/overall-score.ts:4232`):
1. **Dividendos entram só com lucro e payout > 30%** (`:4251-4258`). Fora disso, o peso de DY, Barsi e Gordon é redistribuído entre os demais critérios (`overallScoreWeights`, `:4151`).
2. **Modelos com preço justo** (Graham, FCD, Gordon e afins) passam por `progressivePenalty`: potencial < 5% → −50%; < 10% → −25%; < 15% → −10%; < 20% → −5% (`:4214-4221`). Sem preço justo, o modelo vale 0 se o prejuízo é conhecido e fica fora se faltam dados (`:4278-4281`).
3. **Demonstrações**: risco CRITICAL limita o critério a 20 e HIGH a 40 (`:4377-4382`).
4. **Média só entre os critérios com dado**: o peso dos ausentes sai do denominador (`:4400-4413`). `dataCoverage = { used, total }` (`:4414`).
5. **Penalizações** sobre a média: dívida líquida/PL (`:4423-4444`), margem líquida (`:4447-4468`), risco das demonstrações (CRITICAL −15 com teto 50; HIGH −8 com teto 70; `:4471-4477`) e flag de perda de fundamentos da IA, −20 (`:4496-4501`).
6. Nota, classificação e `qualityLabel` (`:4503-4504`).

## Parâmetros e limiares
| parâmetro | valor | onde |
|---|---|---|
| Pesos BR: Graham, P/L baixo, Fórmula Mágica, FCD, 3+1, demonstrações, DY, Barsi, Gordon | 8, 15, 13, 10, 20, 20, 4, 4, 1 | `overall-score.ts:4123-4133` |
| Pesos BDR (mesma ordem) | 5, 10, 18, 6, 25, 26, 2,5, 2,5, 1 | `:4134-4144` |
| Dívida líq./PL BR (limite → pts) | > 3,0 → −12; > 2,0 → −7; > 1,5 → −5; > 1,0 → −3; > 0,9 → −2 | `:4432-4438` |
| Dívida líq./PL BDR | > 4,0 → −12; > 3,0 → −7; > 2,5 → −5; > 2,0 → −3; > 1,5 → −1 | `:4424-4431` |
| Margem líquida BR | < −5% → −18; < 0 → −12; < 2% → −8; < 5% → −4; < 8% → −2 | `:4456-4462` |
| Margem líquida BDR | < −5% → −18; < 0 → −12; < 1% → −6; < 3% → −3; < 6% → −1 | `:4448-4455` |
| `qualityLabel` | alta ≥ 85; boa ≥ 70; moderada ≥ 50; baixa < 50 | `:4165-4170` |
| Nota (grade) | A+ ≥ 95, A ≥ 90, A- ≥ 85, B+ ≥ 80, B ≥ 75, B- ≥ 70, C+ ≥ 65, C ≥ 60, C- ≥ 50, D ≥ 30, F | `:4172-4184` |

Os pesos são relativos e normalizados para somar 1 (`:4158-4160`). Só a primeira faixa atingida de cada penalização é aplicada (`bands.find`).

## Quando não se aplica
- FIIs têm score próprio ([[FII score e preço-teto]]) e ETFs também ([[ETF score]]).
- O sentimento de mercado (`youtubeAnalysis`) é exibido, mas não entra na nota (`:4230`).
- Lucro positivo com payout ≤ 30% ou DY 0 conta como reinvestimento: os dividendos ficam de fora, sem penalidade (`:4259-4262`).

## Saídas na UI
- `score`, `grade`, `classification`, até 5 pontos fortes e 5 fracos (`:4506-4517`). `recommendation` é mantido só por compatibilidade e tem o mesmo valor de `qualityLabel` (`:17-18`).
- Com `includeBreakdown`, a saída traz `contributions` (nome, nota, peso, pontos, descrição) e `rawScore` (`:4519-4525`).
- "Nota baseada em X de Y critérios": o texto aparece hoje nos motivos do [[Onde aportar]] (`src/lib/allocation/engine.ts:134`, `:287`). No CompactScore ainda não aparece, e nenhum componente lê `dataCoverage` ou `qualityLabel` (grep em `src/components` e `src/app`, 09/10).
- O ETF score usa este `overallScore` (via `AssetSnapshot`) na dimensão de qualidade da carteira.

## Decisões e histórico / pendências
- Onda 2 (`w2-score-compliance-fii`): pesos normalizados, critério sem dado tratado como neutro, `qualityLabel` no lugar de "Compra/Venda" ([[Compliance CVM]]).
- Pendência (RESUME, onda 2): mostrar `dataCoverage` e `qualityLabel` no CompactScore. `src/components/compact-score.tsx:13` ainda tipa `recommendation` como "Empresa Excelente…".
- Página × ranking: o RESUME registra parâmetros diferentes (Gordon VALE3). A onda 5 (`w5-data-consistency`) diz que alinhou os números; não conferi aqui.

## Relacionadas
[[Graham]] · [[FCD]] · [[Gordon]] · [[Barsi]] · [[Fórmula Mágica]] · [[P-L baixo]] · [[Estratégia 3+1]] · [[Margem de segurança e upside]] · [[Sinais financeiros]] · [[ETF score]] · [[Ranking]] · [[Onda 2]] · [[Pendências]]
