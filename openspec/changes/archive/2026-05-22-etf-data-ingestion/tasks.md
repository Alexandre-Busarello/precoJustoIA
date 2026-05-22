## 1. Database Migration

- [x] 1.1 Adicionar campos ao model `EtfData` no `prisma/schema.prisma`: `benchmarkIndex`, `return1m`, `return3m`, `return6m`, `return1y`, `return2y`, `return3y`, `return5y`, `returnSinceInception`, `maxDrawdown`, `volatility12m`, `holdingsConcentrationTop5`, `holdingsUpdatedAt`, `etfScore`, `scoreUpdatedAt`, `lastScrapedAt`, `dataSource`
- [x] 1.2 Criar model `EtfHolding` no schema: `id`, `etfDataId` (FK → EtfData), `ticker` (String?), `name` (String), `weight` (Decimal), `companyId` (Int?, FK → Company), `updatedAt`; adicionar índice em `(etfDataId)` e `(companyId)`
- [x] 1.3 Adicionar model `EtfIngestionLog` ao schema: `id`, `phase`, `processedCount`, `failedCount`, `durationMs`, `status` (success/partial/failed), `createdAt`
- [x] 1.4 Gerar e aplicar migration Prisma (`npx prisma migrate dev --name etf-data-expand`) — usar `prisma db push` (padrão do projeto)
- [x] 1.5 Verificar que todos os registros existentes em `etf_data` permanecem intactos com novos campos null — garantido pois todos os novos campos são nullable

## 2. Fase 1 — Pipeline BRAPI

- [x] 2.1 Criar `scripts/fetch-etf-brapi.ts`: buscar listagem de fundos via `/api/quote/list?type=fund` e filtrar ETFs (excluir tickers com `assetType = "FII"` no banco)
- [x] 2.2 Implementar detecção de novos ETFs: registrar ativo com `assetType = "ETF"` via `asset-registration-service` quando ticker desconhecido for detectado
- [x] 2.3 Para cada ETF identificado, buscar dados detalhados via `/api/quote/{ticker}` com token BRAPI e salvar em `EtfData` usando `upsert` por `companyId`: `regularMarketPrice`, `dividendYield`, `ytdReturn`, `netAssets`, `totalAssets`
- [x] 2.4 Implementar persistência seletiva: nunca sobrescrever campo existente não-nulo com valor null recebido do BRAPI
- [x] 2.5 Implementar tratamento de falha por ETF individual: capturar erro por ticker, logar e continuar o lote (nunca lançar exceção que interrompa o loop inteiro)
- [x] 2.6 Implementar backoff exponencial para erros 429 do BRAPI (reutilizar padrão dos scripts existentes)
- [x] 2.7 Atualizar `dataSource` para `"brapi-only"` após execução bem-sucedida da fase 1; registrar `EtfIngestionLog` com contadores de sucesso/falha

## 3. Fase 2 — Descoberta de API (dev-time, executada localmente uma vez)

- [x] 3.1 Instalar `playwright` e `@playwright/test` como devDependencies (uso exclusivo local, não vai para bundle Vercel)
- [x] 3.2 Criar `scripts/discover-etf1-api.ts`: script local que abre Playwright, navega `etf1.com.br/etf/BOVA11`, `etf1.com.br/etf/NSDV11`, `etf1.com.br/etf/IVVB11` e intercepta todas as chamadas XHR/fetch, logando URLs, headers e body de resposta
- [x] 3.3 Documentar os endpoints descobertos em `src/lib/etf-scrapers/etf1-endpoints.ts`: URLs parametrizadas por ticker, headers necessários, estrutura do JSON de resposta (campos de dados e holdings)
- [x] 3.4 Validar se os endpoints são acessíveis sem cookie de sessão via `curl` (confirmação de que plano A funciona; caso contrário, ativar plano B com `@sparticuz/chromium`)

## 4. Fase 2 — Pipeline etf1.com.br (Runtime Vercel — Plano A: fetch direto)

- [x] 4.1 Criar `src/lib/etf-scrapers/etf1-client.ts`: funções `fetchEtfDetails(ticker)` e `fetchEtfHoldings(ticker)` usando `fetch()` nativo com os endpoints de `etf1-endpoints.ts`; sem Playwright em runtime
- [x] 4.2 Implementar concorrência controlada: processar ETFs em lotes de 10 paralelos com `Promise.allSettled` (falha individual não interrompe o lote)
- [x] 4.3 Para cada ETF, extrair e mapear: `netExpenseRatio`, `benchmarkIndex`, `category`, `return1m`, `return3m`, `return6m`, `return1y`, `return2y`, `return3y`, `return5y`, `returnSinceInception`, `maxDrawdown`, `volatility12m`
- [x] 4.4 Extrair holdings: `{ ticker, name, weight }` dos principais ativos; normalizar tickers (remover sufixo ".SA"); fazer lookup de `companyId` no banco; logar holdings sem match
- [x] 4.5 Persistir holdings via transaction atômica (delete + insertMany): deletar todos os `EtfHolding` do ETF e inserir os novos em uma única transação Prisma; calcular e salvar `holdingsConcentrationTop5`
- [x] 4.6 Implementar cursor de resumabilidade: selecionar apenas ETFs com `lastScrapedAt` null ou anterior à segunda-feira 00:00 BRT da semana corrente
- [x] 4.7 Implementar suporte ao parâmetro `?force=true` no cron para reprocessar todos os ETFs ignorando o cursor
- [x] 4.8 Atualizar `lastScrapedAt` e `dataSource = "brapi+etf1"` somente para ETFs processados com sucesso; usar `upsert` por `companyId` (nunca sobrescrever não-nulo com null)
- [x] 4.9 Registrar `EtfIngestionLog` ao final com totais de sucesso/falha/duração

## 4B. Fase 2 — Plano B: @sparticuz/chromium (ativar somente se endpoints exigirem sessão)

> **SKIPPED — Plano A suficiente**: os endpoints do etf1.com.br são acessíveis sem sessão via HTTP direto. Plano B nunca foi ativado.

- [x] 4B.1 Adicionar `@sparticuz/chromium-min` + `playwright-core` como dependências (bundle ~60 MB, dentro do limite Vercel)
- [x] 4B.2 Criar `src/lib/etf-scrapers/etf1-chromium-client.ts`: abre browser headless, navega à página do ETF e intercepta a resposta XHR diretamente no runtime
- [x] 4B.3 Reduzir lote para 15 ETFs por invocação (comporta em 60s com browser)
- [x] 4B.4 Ajustar cron para rodar a cada 3 horas (`0 */3 * * *`) em vez de semanal, garantindo 180 ETFs processados em ~1 dia
- [x] 4B.5 Reutilizar cursor de resumabilidade e lógica de persistência do Plano A (mesmos upserts e log)

## 5. ETF Scoring

- [x] 5.1 Criar `src/lib/etf-scoring.ts` com função `calculateEtfScore(etfData: EtfData & { holdings: EtfHolding[] }, allEtfs: EtfData[]): number | null`
- [x] 5.2 Implementar dimensão Custo (20%): interpolação linear de `netExpenseRatio` entre 0.10% (100 pts) e 1.50% (0 pts); null/zero = 100 pts
- [x] 5.3 Implementar dimensão Retorno (25%): normalização min-max de `return1y` por grupo de `benchmarkIndex`; ETFs sem benchmark no grupo "Outros"
- [x] 5.4 Implementar dimensão Liquidez (20%): normalização logarítmica de `regularMarketVolume` entre todos os ETFs
- [x] 5.5 Implementar dimensão Solidez (15%): normalização logarítmica de `netAssets` entre todos os ETFs
- [x] 5.6 Implementar dimensão Qualidade da Carteira (20%): para cada holding com `companyId` não-nulo, buscar score da empresa; calcular média ponderada por `weight`; se nenhum holding rastreável, usar 50 pts (neutro)
- [x] 5.7 Implementar penalidade de concentração: se `holdingsConcentrationTop5 > 0.70`, subtrair até 10 pts proporcionalmente ao excesso acima de 70%
- [x] 5.8 Retornar null se `return1y = null` ou `netExpenseRatio = null`
- [x] 5.9 Criar função `recalculateAllEtfScores()` que busca todos os `EtfData` ativos com holdings e aplica `calculateEtfScore` em lote, salvando `etfScore` e `scoreUpdatedAt`
- [x] 5.10 Implementar recálculo em cascata: ao final do pipeline diário de ações/FIIs, identificar ETFs com holdings de empresas atualizadas e enfileirar para recálculo (via Redis, limite de 200/ciclo)

## 6. Cron Route

- [x] 6.1 Criar `src/app/api/cron/fetch-etf/route.ts` com autenticação pelo mesmo mecanismo dos crons existentes
- [x] 6.2 Implementar lógica de despacho: `?phase=1` (BRAPI, diário) e `?phase=2` (fetch direto etf1.com.br, semanal ou a cada 3h no plano B)
- [x] 6.3 Chamar `recalculateAllEtfScores()` ao final de cada execução de qualquer fase
- [x] 6.4 Registrar o cron no `vercel.json`: fase 1 diária (`0 6 * * *`), fase 2 semanal (`0 7 * * 0`); ajustar para `0 */3 * * *` se plano B for ativado
- [x] 6.5 Expor endpoint admin `GET /api/admin/etf-ingestion/logs` para visualizar os últimos `EtfIngestionLog` sem acessar o Vercel

## 7. Validação

- [x] 7.1 Acionar cron de fase 1 via admin e verificar dados populados para NSDV11, UTLL11, RAYS, POSB11
- [x] 7.2 Acionar cron de fase 2 via admin e verificar taxa de administração, benchmark e holdings para os mesmos ETFs
- [x] 7.3 Verificar que holdings têm `companyId` resolvido para tickers conhecidos (ex: holdings de BOVA11 devem ter companyId das ações do IBOV — VALE3→13, ITUB4→232, PETR4→14 ✓)
- [x] 7.4 Verificar que o ETF Score é calculado e não nulo; inspecionar breakdown das 5 dimensões manualmente (NSDV11=51, BOVA11=49, IVVB11=52, GOLD11=42 ✓)
- [x] 7.5 Verificar no banco que ETFs e FIIs não se misturam (ETFs conhecidos como ETF ✓; FIIs conhecidos como FII ✓; fix de regex aplicado para prevenir registros futuros incorretos)
- [x] 7.6 Testar rota cron com e sem autenticação (deve retornar 401 sem token)
- [x] 7.7 Testar resumabilidade: acionar fase 2 com `?maxItems=5` (parâmetro de teste), verificar `lastScrapedAt`, acionar novamente e confirmar que retoma do item 6
