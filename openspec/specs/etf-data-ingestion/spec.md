# Spec: ETF Data Ingestion

## Purpose
Define o pipeline de coleta de dados de ETFs brasileiros em duas fases: fase 1 via BRAPI (cotação, volume, retorno histórico — execução diária) e fase 2 via scraping do etf1.com.br com Playwright (taxa de administração, benchmark, categoria, retornos múltiplos períodos — execução semanal). Os dados coletados alimentam o model `EtfData` no banco e habilitam o cálculo do ETF Score.

O pipeline é projetado para ser **idempotente**, **tolerante a falhas** e **resumível**: execuções repetidas não geram inconsistências, falhas parciais não corrompem dados já salvos, e uma execução interrompida pode continuar do ponto onde parou.

## Requirements

### Requirement: Listagem de ETFs Ativos via BRAPI
O sistema SHALL identificar todos os ETFs brasileiros ativos usando o endpoint BRAPI `/api/quote/list?type=fund`, filtrando por ativos com `assetType != "FII"` no banco.
ETFs recém-detectados que ainda não possuem `assetType` definido SHALL ser registrados com `assetType = "ETF"` via `asset-registration-service`.

#### Scenario: Novo ETF detectado na listagem
- **WHEN** o script de fase 1 encontra um ticker com `type=fund` que não existe no banco
- **THEN** o ativo é registrado com `assetType = "ETF"` e um registro inicial de `EtfData` é criado

#### Scenario: ETF já existente atualizado
- **WHEN** o script de fase 1 roda para um ETF já cadastrado no banco
- **THEN** os campos `regularMarketPrice`, `regularMarketChangePercent`, `regularMarketVolume` são atualizados no `EtfData`

#### Scenario: Separação ETF vs FII
- **WHEN** o endpoint BRAPI retorna um fundo com ticker "MXRF11" (FII conhecido)
- **THEN** o script ignora o ativo pois `assetType = "FII"` já existe no banco

---

### Requirement: Coleta de Dados de Cotação via BRAPI (Fase 1 — Diária)
O sistema SHALL coletar diariamente via `scripts/fetch-etf-brapi.ts` os seguintes campos de cada ETF ativo: cotação atual, variação diária, volume, dividend yield, retorno YTD.
O script SHALL ser acionado pelo cron `/api/cron/fetch-etf` com execução diária.

#### Scenario: Coleta diária bem-sucedida
- **WHEN** o cron `/api/cron/fetch-etf?phase=1` executa
- **THEN** todos os `EtfData` ativos têm `regularMarketPrice`, `dividendYield`, `ytdReturn` e `updatedAt` atualizados

#### Scenario: BRAPI retorna erro 429
- **WHEN** BRAPI retorna HTTP 429 durante o fetch de um lote de ETFs
- **THEN** o script aguarda com backoff exponencial e retenta, registrando o incidente no log

#### Scenario: ETF sem dados no BRAPI
- **WHEN** BRAPI retorna dados vazios ou null para um ETF específico
- **THEN** o registro `EtfData` não é sobrescrito com valores nulos; `updatedAt` não é alterado

---

### Requirement: Coleta de Dados Qualitativos via etf1.com.br (Fase 2 — Semanal)
O sistema SHALL coletar semanalmente via `src/lib/etf-scrapers/etf1-client.ts` (HTTP direto aos endpoints JSON do etf1.com.br) os seguintes campos de cada ETF: taxa de administração (`netExpenseRatio`), índice de referência (`benchmarkIndex`), categoria (`category`), retornos de 1m, 3m, 6m, 1a e 3a, e composição da carteira (holdings).
O scraper acessa diretamente os endpoints JSON do etf1.com.br (descobertos via `etf1-endpoints.ts`), sem necessidade de browser headless (Playwright não foi implementado — a abordagem via HTTP direto foi suficiente e mais performática).

#### Scenario: Coleta semanal bem-sucedida
- **WHEN** o script fase 2 executa para BOVA11
- **THEN** `EtfData.netExpenseRatio`, `benchmarkIndex`, `category`, `return1m`, `return3m`, `return6m`, `return1y`, `return3y` e `lastScrapedAt` são atualizados

#### Scenario: etf1.com.br inacessível
- **WHEN** o Playwright não consegue acessar etf1.com.br (timeout ou erro HTTP)
- **THEN** o script registra o erro, não atualiza os dados e uma notificação de falha é gerada; os dados anteriores permanecem no banco

#### Scenario: ETF não encontrado no etf1.com.br
- **WHEN** o script tenta acessar a página de um ETF que não existe no etf1.com.br
- **THEN** o ETF é marcado com `dataSource = "brapi-only"` e apenas os dados de fase 1 são mantidos

---

### Requirement: Coleta de Composição da Carteira (Holdings)
O sistema SHALL coletar via fase 2 (etf1.com.br) a composição da carteira de cada ETF: lista dos principais ativos com ticker, nome e percentual de peso.
Os holdings SHALL ser persistidos no model `EtfHolding` (tabela separada, relacionada a `EtfData` via `etfDataId`).
Para cada holding cujo ticker estiver cadastrado no banco como `Company`, o sistema SHALL popular o campo `companyId` para habilitar cruzamento com scores internos.
A coleção de holdings de um ETF SHALL ser substituída integralmente a cada atualização (delete + insert), nunca acumulada.

#### Scenario: Holdings coletados com sucesso
- **WHEN** o script de fase 2 coleta a composição do BOVA11
- **THEN** os registros anteriores em `EtfHolding` para o BOVA11 são deletados e substituídos pelos novos; cada holding com ticker reconhecido no banco recebe `companyId` preenchido

#### Scenario: Holding com ticker desconhecido (ativo internacional ou não rastreado)
- **WHEN** um holding do ETF IVVB11 tem ticker "AAPL" (não cadastrado no banco como Company)
- **THEN** o holding é salvo com `ticker = "AAPL"`, `name = "Apple Inc."`, `companyId = null`

#### Scenario: ETF sem composição disponível no etf1.com.br
- **WHEN** o site não retorna dados de composição para um ETF específico
- **THEN** os holdings existentes no banco para esse ETF são mantidos; `holdingsUpdatedAt` não é alterado

#### Scenario: Concentração calculada após atualização de holdings
- **WHEN** os holdings de um ETF são atualizados
- **THEN** `EtfData.holdingsConcentrationTop5` é recalculado como a soma dos pesos dos 5 maiores holdings

---

### Requirement: Coleta de Métricas de Risco e Retornos Estendidos
O sistema SHALL coletar via fase 2 as seguintes métricas adicionais disponíveis no etf1.com.br:
- Retornos de longo prazo: `return2y`, `return5y`, `returnSinceInception`
- Risco: `maxDrawdown` (maior queda percentual do pico ao vale, período de 3 anos)
- `volatility12m` (desvio padrão anualizado dos retornos mensais dos últimos 12 meses)

#### Scenario: Métricas de risco coletadas
- **WHEN** o script de fase 2 coleta dados do BOVA11
- **THEN** `maxDrawdown`, `volatility12m`, `return2y`, `return5y` e `returnSinceInception` são atualizados no `EtfData`

#### Scenario: ETF recém-lançado sem histórico longo
- **WHEN** um ETF com menos de 1 ano de existência não tem `return1y` ou `return5y` disponíveis
- **THEN** os campos são salvos como null; o score é calculado apenas com as dimensões que têm dados disponíveis

---

### Requirement: Modelo de Dados EtfData Expandido e EtfHolding
O model `EtfData` SHALL ser expandido via migration Prisma para incluir os campos necessários para score e análise.
Um novo model `EtfHolding` SHALL ser criado para armazenar a composição da carteira.
Todos os novos campos em `EtfData` SHALL ser nullable para garantir compatibilidade retroativa.

Novos campos em `EtfData`:
- `benchmarkIndex` (String?) — índice referência (ex: "IBOV", "NASDAQ 100")
- `return1m`, `return3m`, `return6m`, `return1y`, `return2y`, `return3y`, `return5y` (Decimal?) — retornos por período
- `returnSinceInception` (Decimal?) — retorno acumulado desde o lançamento do fundo
- `maxDrawdown` (Decimal?) — maior queda do pico ao vale (negativo, ex: -0.32 = -32%)
- `volatility12m` (Decimal?) — volatilidade anualizada dos últimos 12 meses
- `holdingsConcentrationTop5` (Decimal?) — soma dos pesos dos 5 maiores holdings
- `holdingsUpdatedAt` (DateTime?) — timestamp da última atualização de holdings
- `etfScore` (Int?) — score composto 0–100 (6 dimensões)
- `scoreUpdatedAt` (DateTime?) — timestamp do último cálculo de score
- `aiAnalysisScore` (Int?) — score da análise IA (0–100), 6ª dimensão do ETF Score
- `aiAnalysisSummary` (String?) — resumo textual da análise IA (PREMIUM-only)
- `aiAnalysisUpdatedAt` (DateTime?) — timestamp da última análise IA
- `aiConcentracaoPenaltyOverride` (Boolean?) — quando true, a penalidade de concentração não é aplicada
- `etfClass` (String?) — classe do ETF (ex: "Renda Variável BR", "Internacional", "Renda Fixa", "Cripto", etc.)
- `lastScrapedAt` (DateTime?) — timestamp do último scraping do etf1.com.br
- `dataSource` (String?) — "brapi-only", "etf1", "brapi+etf1"

Novo model `EtfIngestionLog`:
- `id` (Int, PK)
- `phase` (Int) — fase executada (1 ou 2)
- `processedCount` (Int) — total de ETFs processados com sucesso
- `failedCount` (Int) — total de falhas
- `durationMs` (Int) — duração em milissegundos
- `status` (String) — "success", "partial", "failed"
- `createdAt` (DateTime)

Campos do model `EtfHolding`:
- `id` (Int, PK)
- `etfDataId` (Int, FK → EtfData)
- `ticker` (String?) — ticker do ativo subjacente
- `name` (String) — nome do ativo
- `weight` (Decimal) — percentual do portfólio (ex: 0.08 = 8%)
- `companyId` (Int?, FK → Company) — preenchido se o ticker existir no banco
- `updatedAt` (DateTime)

#### Scenario: Migration sem breaking change
- **WHEN** a migration Prisma é aplicada em produção
- **THEN** todos os registros existentes de `EtfData` permanecem intactos com os novos campos como null

#### Scenario: Registro de fonte de dados
- **WHEN** apenas o script de fase 1 (BRAPI) foi executado para um ETF
- **THEN** `EtfData.dataSource = "brapi-only"`

#### Scenario: Registro com dados completos
- **WHEN** ambos os scripts de fase 1 e fase 2 foram executados para um ETF
- **THEN** `EtfData.dataSource = "brapi+etf1"`, holdings estão populados e todos os campos de retorno disponíveis estão preenchidos

---

### Requirement: Cron de Atualização de ETFs
O sistema SHALL expor a rota `/api/cron/fetch-etf` que orquestra as duas fases de coleta.
A fase 1 (BRAPI) SHALL executar diariamente. A fase 2 (etf1.com.br) SHALL executar semanalmente (domingos).
O cron SHALL ser protegido com o mesmo mecanismo de autenticação dos crons existentes.

#### Scenario: Execução diária fase 1
- **WHEN** o Vercel cron aciona `/api/cron/fetch-etf` diariamente
- **THEN** o script de fase 1 é executado e os dados de cotação são atualizados

#### Scenario: Execução semanal fase 2
- **WHEN** o Vercel cron aciona `/api/cron/fetch-etf?phase=2` aos domingos
- **THEN** o script de fase 2 é executado e os dados qualitativos são atualizados

#### Scenario: Cron não autenticado bloqueado
- **WHEN** uma requisição sem o header de autorização correto atinge `/api/cron/fetch-etf`
- **THEN** a rota retorna HTTP 401 sem executar nenhum script

---

### Requirement: Idempotência das Execuções
Cada fase do pipeline SHALL ser idempotente: executar o mesmo script múltiplas vezes no mesmo dia SHALL produzir o mesmo estado final no banco, sem duplicatas, sem sobrescrever dados válidos com dados piores e sem efeitos colaterais cumulativos.
A operação de persistência SHALL usar `upsert` (nunca `insert` puro) baseado em `companyId`.

#### Scenario: Fase 1 executada duas vezes no mesmo dia
- **WHEN** o cron de fase 1 dispara e logo em seguida é acionado manualmente uma segunda vez
- **THEN** o banco reflete apenas os dados mais recentes; nenhum registro duplicado é criado e o `updatedAt` reflete a segunda execução

#### Scenario: Fase 2 executada duas vezes na mesma semana
- **WHEN** o script de fase 2 roda na sexta e é reexecutado no sábado
- **THEN** os campos de `netExpenseRatio`, `benchmarkIndex` e retornos são sobrescritos com os valores mais recentes; nenhum valor anterior é preservado incorretamente

#### Scenario: Upsert em campo já preenchido com dado melhor
- **WHEN** a fase 2 retorna `netExpenseRatio = null` para um ETF que já tinha valor no banco
- **THEN** o valor existente no banco é preservado (não sobrescrito por null); apenas campos com valor não-nulo são atualizados

---

### Requirement: Tolerância a Falhas por ETF Individual
O pipeline SHALL processar cada ETF de forma isolada: a falha na coleta de um ETF específico SHALL ser registrada e ignorada, permitindo que o processamento dos demais ETFs continue normalmente.
Nenhuma falha individual SHALL causar rollback ou interrupção do lote inteiro.

#### Scenario: Erro de rede em um ETF durante fase 1
- **WHEN** a chamada BRAPI para um ticker específico retorna erro de rede (timeout, 500)
- **THEN** o erro é logado com o ticker afetado, o `EtfData` desse ticker não é alterado, e o script continua processando os ETFs restantes

#### Scenario: Scraper HTTP falha em um ETF durante fase 2
- **WHEN** o scraper HTTP não consegue extrair dados de um ETF específico no etf1.com.br (timeout, 404, erro de parse)
- **THEN** o erro é logado com o ticker afetado, o `lastScrapedAt` desse ticker não é atualizado, e o script continua com o próximo ETF

#### Scenario: Falha não impede cálculo de score
- **WHEN** 5 de 180 ETFs falham na coleta da fase 1
- **THEN** o score é calculado normalmente para os 175 ETFs com dados válidos; os 5 com falha mantêm `etfScore = null`

---

### Requirement: Resumabilidade por Cursor de Progresso
O pipeline de fase 2 (scraper HTTP, processado em lotes) SHALL ser resumível: ao ser interrompido, SHALL registrar o último ticker processado com sucesso (`lastScrapedAt`) e, na próxima execução, SHALL pular os ETFs já processados no ciclo atual.
Um "ciclo" é definido como a janela semanal corrente (segunda a domingo). ETFs com `lastScrapedAt` dentro do ciclo corrente SHALL ser considerados concluídos e ignorados na reexecução.

#### Scenario: Fase 2 interrompida e retomada
- **WHEN** o script de fase 2 processa 60 de 180 ETFs e é interrompido (timeout Vercel, erro fatal)
- **THEN** os 60 ETFs processados têm `lastScrapedAt` atualizado; na próxima execução do mesmo ciclo semanal, apenas os 120 ETFs restantes são processados

#### Scenario: Novo ciclo semanal reinicia o processamento
- **WHEN** a semana vira (segunda-feira) e o cron de fase 2 executa
- **THEN** todos os ETFs são elegíveis para atualização, independentemente do `lastScrapedAt` anterior

#### Scenario: Execução manual força reprocessamento completo
- **WHEN** o cron é acionado com o parâmetro `?force=true`
- **THEN** o critério de cursor é ignorado e todos os ETFs são reprocessados, mesmo os já atualizados no ciclo corrente

---

### Requirement: Log de Execução por Ciclo
O sistema SHALL registrar no banco um log de cada execução do cron com: fase executada, total de ETFs processados, total de falhas, duração, e status final (`success`, `partial`, `failed`).
Esse log SHALL ser acessível via painel admin para diagnóstico sem necessidade de consultar logs do Vercel.

#### Scenario: Execução com falhas parciais registrada como "partial"
- **WHEN** a fase 1 processa 175 ETFs com sucesso e falha em 5
- **THEN** um registro de log é criado com `status = "partial"`, `processed = 175`, `failed = 5`

#### Scenario: Execução sem falhas registrada como "success"
- **WHEN** todos os ETFs são processados sem erros
- **THEN** um registro de log é criado com `status = "success"` e `failed = 0`
