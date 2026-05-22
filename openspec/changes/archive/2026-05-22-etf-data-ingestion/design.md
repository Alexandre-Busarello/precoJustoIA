## Context

A plataforma já possui pipelines consolidados para ações (BRAPI + Fundamentus + Ward), FIIs (Fundamentus scraping) e BDRs (Yahoo Finance). O model `EtfData` já existe no schema Prisma mas está praticamente vazio — apenas campos básicos preenchidos via `asset-registration-service` (sem cron dedicado, sem score).

**Restrição crítica de infraestrutura:** toda a execução ocorre exclusivamente na Vercel (serverless functions). Não há servidor próprio, worker externo ou máquina dedicada. Isso impõe limites concretos que guiam todas as decisões técnicas:
- Timeout máximo de execução: **60 segundos** (Vercel Pro)
- Memória máxima: **1024 MB** por invocação
- Tamanho máximo do bundle: **250 MB** descomprimido
- Sem sistema de arquivos persistente entre invocações
- Sem processos de longa duração — cada invocação começa e termina em menos de 60s

A pesquisa de viabilidade realizada antes desta proposta revelou o seguinte sobre as fontes disponíveis:

| Fonte | O que tem para ETF | Disponibilidade |
|---|---|---|
| **BRAPI** | Cotação, variação, volume, retorno histórico, listagem de fundos | ✅ Disponível com token existente |
| **etf1.com.br** | Taxa de administração, benchmark, categoria, retornos 1m/3m/6m/1a/3a/5a, composição carteira | ✅ Acessível, SPA Next.js (API interna descobrível) |
| **Fundamentus** | Nenhum — página `/etf_resultado.php` retorna 404 | ❌ Inexistente |
| **B3 sistemaswebb3** | Desconhecido — endpoints não encontrados | ❌ Inviável |
| **etfbrasil.com.br** | Fora do ar | ❌ Inviável |

O `EtfData` atual tem apenas: `netAssets`, `netExpenseRatio`, `dividendYield`, `ytdReturn`, `category`, `totalAssets`. Faltam os campos necessários para compor um score robusto.

## Goals / Non-Goals

**Goals:**
- Pipeline fase 1 (BRAPI): coleta diária de cotação, volume, DY e retornos para todos os ETFs ativos
- Pipeline fase 2 (etf1.com.br): coleta semanal de taxa de administração, benchmark, categoria, retornos históricos de múltiplos períodos
- Expansão do model `EtfData` com os campos necessários para score
- Cálculo do **ETF Score** — score composto padronizado (0–100), análogo ao score de FIIs
- Cron job `/api/cron/fetch-etf` para orquestrar os dois pipelines

**Non-Goals:**
- Página de detalhe de ETF na UI
- Inclusão de ETFs em rankings existentes (próxima change)
- Calculadora de aportes e dividendos com ETFs (próxima change)
- Composição detalhada da carteira exibida ao usuário

## Decisions

### Decisão 1: Duas fases de scraping, não uma

**Escolhido:** BRAPI para fase 1 (diária) + etf1.com.br para fase 2 (semanal via Playwright).

**Por quê:** O BRAPI já é usado na plataforma, tem token disponível e retorna cotação/retorno histórico em JSON puro — custo de implementação zero. O etf1.com.br tem os dados qualitativos (benchmark, taxa, categoria) que não existem no BRAPI, mas requer Playwright. Separar os pipelines permite ter fase 1 funcionando rapidamente enquanto fase 2 é desenvolvida.

**Alternativa descartada:** Tentar usar apenas BRAPI — descartada porque o BRAPI não retorna `netExpenseRatio` (taxa de administração), benchmark ou categoria para ETFs, campos essenciais para o score.

### Decisão 2: Identificar ETFs na listagem BRAPI por exclusão

**Escolhido:** Usar `/api/quote/list?type=fund` e filtrar por ticker padrão ETF (terminam em `11` e não estão cadastrados como FII no banco).

**Por quê:** O BRAPI não distingue ETFs de FIIs no campo `type` (ambos retornam `"fund"`). A plataforma já tem todos os FIIs cadastrados no banco com `assetType = "FII"`. Portanto: `type=fund AND assetType != "FII"` identifica os ETFs.

**Alternativa descartada:** Manter lista manual de tickers ETF — frágil, requer atualização manual a cada novo ETF listado.

### Decisão 3: Descoberta de API em dev-time + fetch direto em runtime (Vercel)

**Restrição:** Playwright headless completo não pode rodar em produção na Vercel. Um Chromium completo pesa ~170 MB, consome ~512 MB de RAM com uma aba aberta e leva 5–10s por página — tornando inviável processar 180 ETFs dentro do timeout de 60s.

**Escolhido:** abordagem em duas etapas separadas pelo ambiente:

**Etapa A — Descoberta (dev-time, executada uma vez pelo desenvolvedor localmente):**
Usar Playwright em ambiente local para navegar o etf1.com.br e interceptar todas as chamadas XHR/fetch do SPA. Documentar os endpoints da API interna descobertos (URLs, headers necessários, formato de request/response) em `src/lib/etf-scrapers/etf1-endpoints.ts`. Esta etapa é feita uma vez durante o desenvolvimento e refeita apenas se o site mudar sua estrutura.

**Etapa B — Runtime (Vercel, execução diária/semanal):**
A rota de cron chama os endpoints descobertos diretamente via `fetch()` nativo — sem Playwright, sem browser. Com concorrência controlada de 10 requisições paralelas, processar 180 ETFs leva ~15–25s, dentro do timeout de 60s.

**Por quê isso funciona:** SPAs Next.js tipicamente expõem APIs internas acessíveis server-to-server sem CORS ou autenticação de sessão, pois são chamadas pelo próprio browser do usuário sem login. A descoberta local confirma os endpoints antes de qualquer commit.

**Plano B — se a API exigir cookies de sessão:** usar `@sparticuz/chromium` + `playwright-core` (pacote slim de ~60 MB que cabe no bundle da Vercel). Processar em lotes de 15 ETFs por invocação (cabe em 60s). Cron ajustado para rodar a cada 3 horas → todos os 180 ETFs atualizados em ~1 dia.

**Alternativa descartada:** Parsear HTML com Cheerio — inviável porque os dados não estão no HTML inicial do SPA.

### Decisão 4: ETF Score com 5 dimensões + penalidade de concentração

**Escolhido:** Score composto de 0–100 com 5 pilares + penalidade opcional:
1. **Custo** (20%): Taxa de administração — quanto menor, melhor.
2. **Retorno** (25%): Retorno de 1 ano normalizado por grupo de benchmark.
3. **Liquidez** (20%): Volume médio diário (normalização logarítmica).
4. **Solidez** (15%): Patrimônio líquido (normalização logarítmica).
5. **Qualidade da Carteira** (20%): Média ponderada dos scores internos das empresas que compõem o ETF, cruzando `EtfHolding.companyId` com os scores já calculados na plataforma para ações e FIIs.
6. **Penalidade de concentração** (–0 a –10 pts): Aplicada quando top 5 holdings > 70% do portfólio.

**Por quê a dimensão Qualidade da Carteira:** A plataforma já tem scores calculados para ~500 ações e todos os FIIs. Um ETF como BOVA11 tem ~90 holdings que já existem no banco. É possível calcular automaticamente "a qualidade dos ativos que esse fundo carrega" sem nenhuma fonte de dados externa adicional — é um diferencial analítico que nenhum outro portal de ETFs brasileiro oferece.

**Por quê a penalidade de concentração:** Um ETF com 80% em 3 ativos tem risco de concentração alto, independentemente de seu retorno histórico. Penalizar o score final comunica esse risco ao investidor sem precisar de texto explicativo.

**Campo calculado:** `etf_score` (0–100, INT) + `score_updated_at` no model `EtfData`.

### Decisão 5: EtfHolding como tabela separada (não JSON)

**Escolhido:** Novo model `EtfHolding` com FK para `EtfData` e FK opcional para `Company`.

**Por quê:** Para calcular a Qualidade da Carteira é necessário fazer JOIN de `EtfHolding` com `Company` para buscar os scores. Um campo JSON em `EtfData` exigiria deserialização em memória e impossibilitaria queries como "quais ETFs carregam VALE3 com peso > 5%?" — úteis para análises futuras (ex: sobreposição de carteira no módulo de portfólio).

**Alternativa descartada:** Campo `holdingsJson` (JSON) em `EtfData` — simples de implementar, mas bloqueia queries relacionais e dificulta o recálculo em cascata de scores quando uma empresa atualiza seu score.

### Decisão 6: Migração aditiva ao schema existente

**Escolhido:** Adicionar novos campos ao `EtfData` via migration Prisma + criar `EtfHolding` como nova tabela.

**Por quê:** Os campos atuais (`netExpenseRatio`, `ytdReturn`, `category`) já existem mas estão vazios. Serão preenchidos pelos novos scripts. Novos campos: `benchmarkIndex`, retornos 1m–5a, `returnSinceInception`, `maxDrawdown`, `volatility12m`, `holdingsConcentrationTop5`, `holdingsUpdatedAt`, `etfScore`, `scoreUpdatedAt`, `lastScrapedAt`, `dataSource`.

## Risks / Trade-offs

**[Risk] API interna do etf1.com.br muda URL ou estrutura** → Mitigation: A fase 2 monitora erros de parse e gera alerta no `EtfIngestionLog`. Os dados da fase 1 (BRAPI) continuam atualizados. Re-executar descoberta local com Playwright e atualizar `etf1-endpoints.ts` basta para restaurar.

**[Risk] API interna do etf1.com.br requer cookies de sessão** → Mitigation: Ativar plano B: `@sparticuz/chromium` + `playwright-core` em lotes de 15 ETFs por invocação. Ajustar cron para rodar a cada 3 horas. Total: 12 invocações × 15 ETFs = 180 ETFs/dia.

**[Risk] Timeout de 60s insuficiente para processar todos os ETFs em uma única invocação com fetch direto** → Mitigation: O cursor de `lastScrapedAt` garante resumabilidade. Se a invocação processar apenas 100 ETFs antes do timeout, os 80 restantes são processados na próxima invocação (cron a cada 3h). O `EtfIngestionLog` registra o progresso.

**[Risk] BRAPI não distingue ETFs de FIIs** → Mitigation: Filtragem por `assetType != "FII"` no banco. Log de auditoria para novos fundos sem `assetType` definido.

**[Risk] Holdings do etf1.com.br em formato diferente do banco (ex: "VALE3.SA" vs "VALE3")** → Mitigation: Normalizar tickers removendo sufixos ".SA" antes do lookup de `companyId`. Logar holdings sem match para auditoria.

**[Risk] Recálculo em cascata (empresa atualiza score → ETFs recalculam) pode sobrecarregar o banco** → Mitigation: Fila no Redis com deduplicação. Limite de 200 recálculos por ciclo de cron.

## Migration Plan

1. Adicionar migration Prisma com novos campos em `etf_data` + tabela `etf_holdings` + `etf_ingestion_logs`
2. Deploy da migration em produção (sem breaking change — todos novos campos são nullable)
3. Desenvolver e testar localmente `src/lib/etf-scrapers/etf1-client.ts` usando Playwright para descobrir os endpoints da API interna do etf1.com.br
4. Documentar os endpoints descobertos em `etf1-endpoints.ts` e commitar
5. Implementar fase 1 (BRAPI) e ativar cron diário — primeiro ciclo funcional sem depender da fase 2
6. Implementar fase 2 (fetch direto aos endpoints descobertos) e ativar cron semanal
7. Verificar `EtfIngestionLog` no admin após primeiras execuções
8. Verificar score para: NSDV11, UTLL11, RAYS, POSB11

**Rollback:** Todos os novos campos são nullable. Desativar as rotas de cron no `vercel.json` é suficiente para parar as execuções. Migration pode ser revertida se necessário.

## Open Questions

- O etf1.com.br exige cookies de sessão para acessar a API interna? (Resposta confirmada durante a etapa de descoberta local — determina se plano B com `@sparticuz/chromium` é necessário.)
- ETFs de BDR (como IVVB11) devem ser complementados com Yahoo Finance para dados dos ativos subjacentes, ou o BRAPI já cobre suficientemente?
- O Vercel Pro está ativo no projeto? (Impacta o timeout disponível: 60s Pro vs 10s Hobby — a fase 1 cabe nos 10s, a fase 2 requer os 60s.)
