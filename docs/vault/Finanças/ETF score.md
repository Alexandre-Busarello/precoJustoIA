---
tags: [financas, etf]
updated: 2026-10-09
fontes: [src/lib/etf-scoring.ts, src/lib/etf-scoring-core.ts, src/lib/etf-score-loader.ts, src/lib/etf-ai-analysis.ts, src/components/etf-header-score.tsx]
---
# ETF score
> O PJ-ETF Score vai de 0 a 100. É a soma ponderada de 6 dimensões menos uma penalidade de concentração. ETFs não têm preço justo; o score é a única nota.

## Fórmula / como funciona
`calculateEtfScore` (`src/lib/etf-scoring.ts:96`):
- **Custo**: linear entre 0,10% a.a. (nota 100) e 1,50% a.a. (nota 0) (`costScore`, `src/lib/etf-scoring-core.ts:39`).
- **Retorno**: retorno de 12 meses; sem ele, o de 6 meses anualizado, `(1+r6m)²−1` (`etf-scoring-core.ts:15`). A nota é a posição entre os ETFs do mesmo índice de referência (`returnScore`, `:47`).
- **Liquidez**: escala log do volume diário mais recente contra todos os ETFs (`logNormalize`, `etf-scoring-core.ts:26`; uso em `etf-scoring.ts:124`).
- **Solidez**: mesma escala log, aplicada ao patrimônio (`etf-scoring.ts:125`).
- **Qualidade da carteira**: média do `overallScore` das empresas da carteira, ponderada pelo peso de cada uma (`calcQualidadeCarteira`, `etf-scoring.ts:57`). Ver [[Overall score]].
- **Análise IA**: `aiAnalysisScore`, gravado pela análise com Gemini (`etf-ai-analysis.ts:8`, `refreshEtfAiAnalyses` em `etf-scoring.ts:296`).
- Total = `max(0, round(Σ dimensão × peso − penalidade))` (`etf-scoring.ts:138-146`).

## Parâmetros e limiares
| parâmetro | valor | onde |
|---|---|---|
| Pesos: custo / retorno / liquidez / solidez / qualidade / IA | 18 / 22 / 18 / 12 / 18 / 12% | `src/lib/etf-scoring.ts:137-144` |
| Taxa com nota máxima / nota zero | ≤ 0,10% / ≥ 1,50% a.a. | `src/lib/etf-scoring-core.ts:35-36` |
| Retorno de ETF sozinho no seu índice | 75 (neutro) | `etf-scoring-core.ts:48` |
| Penalidade de concentração | começa com top 5 > 65%; máximo de 20 pts quando o top 5 chega a 100% | `etf-scoring-core.ts:53-61` |
| Isenção da penalidade | IA marca concentração estrutural (fundo de fundos) | `etf-scoring.ts:128-130` |
| Qualidade sem empresas rastreáveis | 50 (neutro) | `etf-scoring.ts:61`, `:89` |
| IA ainda não analisou | 50 (neutro) | `etf-scoring.ts:133-135` |
| Validade da análise IA | 7 dias | `etf-scoring.ts:299` |
| Classificação | Excelente ≥ 70, Bom ≥ 55, Regular ≥ 40, Fraco | `src/components/etf-header-score.tsx:13-18` |

## Quando não se aplica
- Sem taxa de administração ou sem retorno de 12m/6m, o score é `null` (`etf-scoring.ts:101-105`). O valor zero conta como dado; só `null` é ausência (`etf-scoring-core.ts:3-12`).
- ETF já processado na fase 2 que ficou sem score é **desativado** (`isActive: false`, `etf-scoring.ts:270-286`).
- No [[Onde aportar]], ETF fica de fora por não ter preço justo (`src/lib/allocation/engine.ts:115-117`).

## Saídas na UI
- `/etf/[ticker]`: painel `EtfHeaderScore` com os seis pilares (`src/components/etf-header-score.tsx:21`). O loader recalcula o score contra o universo ativo (`src/lib/etf-score-loader.ts:17`).
- Cada recálculo grava um `AssetSnapshot` com `overallScore`, `scoreComposition` e `penaltyInfo` (`etf-scoring.ts:222-256`).
- Ranking de ETFs: `src/lib/strategies/etf-ranking-strategy.ts`. Preset de renda fixa: `isFixedIncomeBenchmark` (`etf-scoring-core.ts:68-73`).

## Decisões e histórico / pendências
- O cron `fetch-etf` roda `recalculateAllEtfScores` e, na fase semanal, `refreshEtfAiAnalyses` antes de recalcular (`src/app/api/cron/fetch-etf/route.ts:41`, `:67-68`). Ver [[Crons]].
- Bug da onda 2, já corrigido no código: taxa ou retorno igual a 0 era tratado como ausente, e o preset de renda fixa casava "ima" por substring. Hoje `toNullableNumber` mantém o zero e a regex exige palavra inteira (`etf-scoring-core.ts:63-68`).
- Ponto de atenção ([[Compliance CVM]]): 12% da nota vem de um LLM, a única parte não determinística. O prompt pede um "veredicto" (`etf-ai-analysis.ts:131`).
- `refreshEtfAiAnalyses` monta o filtro com duas chaves `OR` (`etf-scoring.ts:305-311`). Com `forceAll` falso, a segunda sobrescreve a primeira, e o filtro de retorno some. Não testei o efeito.

## Relacionadas
[[Overall score]] · [[Ranking]] · [[Fontes de dados]] · [[Crons]] · [[Compliance CVM]] · [[Pendências]]
