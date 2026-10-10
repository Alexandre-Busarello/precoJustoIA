---
tags: [arquitetura, dados]
updated: 2026-10-09
fontes: [src/lib/site-constants.ts, scripts/fetch-data-ward.ts, scripts/fetch-data-fundamentus-fii.ts, scripts/fetch-etf-brapi.ts, src/lib/yahooFinance2-service.ts, src/lib/bdr-data-service.ts, src/lib/finance/macro.ts, src/lib/finance/macro-sync.ts, src/lib/etf-scrapers/etf1-endpoints.ts]
---
# Fontes de dados
> Cotações e fundamentos vêm de BRAPI, Yahoo Finance e Ward; FIIs do Fundamentus; ETFs de BRAPI/etf1; macro do BCB (SGS). A copy pública diz "Dados da B3 e da CVM via BRAPI e Yahoo Finance".

## Como funciona
| Fonte | Uso | Arquivos |
|---|---|---|
| **Ward** (`api.ward.app.br`) | Fundamentos e histórico de ações (carga principal) | `scripts/fetch-data-ward.ts`, rotas `src/app/api/fetch-ward-data/route.ts` e `src/app/api/cron/fetch-ward/route.ts` |
| **BRAPI** (`brapi.dev`) | Cotação (`/api/quote/<ticker>`), ETFs, índices de mercado, benchmark legado | `scripts/fetch-data-ward.ts`, `scripts/fetch-etf-brapi.ts`, `src/app/api/market-indices/route.ts`, `src/app/api/benchmarks/route.ts`, `src/lib/ben-tools.ts` |
| **Yahoo Finance** (`yahoo-finance2`) | Cotações, históricos, dividendos, complemento de dados, BDRs | `src/lib/yahooFinance2-service.ts`, `yahoo-finance-loader.ts`, `yahoo-finance-complement-service.ts`, `quote-service.ts`, `dividend-service.ts`, `historical-data-service.ts`, `benchmark-service.ts` |
| **Fundamentus** | Lista e indicadores de FIIs (`fii_resultado.php`, com fallback via `r.jina.ai`) | `scripts/fetch-data-fundamentus-fii.ts`, `src/app/api/cron/fetch-fii/route.ts`, `src/app/api/fetch-fii-data/route.ts` |
| **etf1.com.br** | Dados complementares de ETFs | `src/lib/etf-scrapers/etf1-client.ts`, `etf1-endpoints.ts` |
| **BCB SGS** | Selic meta (432), CDI (12), IPCA (433) | `src/lib/finance/macro.ts`, `src/lib/finance/macro-sync.ts`, `src/app/api/cron/macro-indicators/route.ts` |

### BDRs (`src/lib/bdr-data-service.ts`)
- Busca dados do Yahoo para a lista `MAIN_BDRS` (`AAPL34.SA`, `MSFT34.SA`…) no mesmo formato gravado pelo `fetch-data-ward.ts`.
- Sem mudar o schema, grava em `financials` `financialCurrency: "USD"`, `bdrRatio` (de `BDR_PARITY`, via `bdrParity` em `src/lib/strategies/base-strategy.ts`) e `usdBrl` (câmbio do dia). Sem paridade ou câmbio, os modelos ficam "não aplicável".

### Indicadores macro
- `syncMacroIndicators` faz upsert em `EconomicIndicatorHistory` (intervalo `1d`) com o valor em % como o BCB publica; `getMacroAssumptions` converte para fração.
- Selic/CDI: janela de 90 dias; IPCA: 400 dias (premissa = IPCA acumulado 12 meses).
- `NTNB_REAL_LONG` ainda é fixo em 7,68% (`ntnbRealLong: 0.0768` em `src/lib/finance/macro.ts`).

### CVM
- No código, a CVM aparece só como referência em textos e prompts (`src/lib/site-constants.ts`, `src/lib/ai/generate-analysis.ts`). Não achei cliente que baixe dados de `dados.cvm.gov.br`.

## Regras / limites
- Mesmo no ambiente local, abrir páginas consulta Yahoo/BRAPI (APIs públicas) (`scripts/local/README.md`).
- Proventos: dedupe na leitura (mesmo ticker, data-ex a até 5 dias, valor a até 2%) e o gravador não apaga linhas do Yahoo (onda 5, `4782de7`, `f15d22f`).

## Histórico nas ondas
- [[Onda 1]]: `src/lib/finance/*` (dividendos, macro, sinais) com testes (`395302f`).
- [[Onda 2]]: benchmarks com IPCA e CDI diário composto (`47df9e2`).
- [[Onda 5]]: dedupe de dividendos de FII e preço justo de BDR por paridade (`4782de7`, `0940f2c`).

## Pendências
- Fonte automática para `NTNB_REAL_LONG`.
- `/api/benchmarks` (legado) ainda usa BRAPI mensal.
- `BDR_PARITY` precisa de revisão em desdobramentos; BDRs com balanço em CNY/TWD continuam "não aplicável".
- Confirmar com o dono o número de ativos cobertos (`COVERED_ASSETS_LABEL = 'mais de 600 ativos'`).

## Relacionadas
[[Crons]] · [[Caches]] · [[Stack]] · [[Agenda de proventos]] · [[Sinais financeiros]] · [[FII score e preço-teto]] · [[ETF score]]
