## Why

ETFs brasileiros são um segmento em crescimento na B3, mas a plataforma não possui pipeline de dados nem score para essa classe de ativo. Usuários da plataforma já investem em ETFs (NSDV11, UTLL11, RAYS, POSB11) e demandam análise equivalente ao que existe para ações e FIIs — rankings, calculadora de dividendos e score fundamentalista. Esta mudança cria a infraestrutura de dados que viabiliza tudo isso.

## What Changes

- Novo script de ingestão de ETFs via **BRAPI** para cotação, volume e dados básicos (fase 1)
- Novo script de ingestão via **scraping do etf1.com.br** (Playwright) para taxa de administração, benchmark, composição da carteira e retornos históricos (fase 2)
- Enriquecimento do model `EtfData` no banco com os campos específicos necessários para score
- Novo **ETF Score** composto (quantitativo + qualitativo), análogo ao score de FIIs e ações
- Cron job diário de atualização dos dados de ETF
- Separação clara entre ETFs, FIIs e ações nos pipelines existentes

## Capabilities

### New Capabilities

- `etf-data-ingestion`: Pipeline de coleta diária de dados de ETFs brasileiros via BRAPI (cotação, volume, retorno histórico) e scraping do etf1.com.br (taxa de administração, benchmark, composição, retornos de múltiplos períodos).
- `etf-scoring`: Cálculo de score composto para ETFs com dimensões quantitativas (retorno, custo, liquidez, DY) e qualitativas (benchmark relevante, gestora, patrimônio), gerando um ETF Score padronizado para uso em rankings futuros.

### Modified Capabilities

- `data-ingestion`: Adição do pipeline de ETFs (BRAPI + etf1.com.br) e do cron de atualização diária. Nenhuma mudança de requisito nas pipelines existentes de ações, FIIs ou BDRs.

## Impact

- **Banco de dados**: Migração Prisma para expandir `etf_data` com novos campos (expense_ratio, benchmark, category, returns_1m/3m/6m/1y/3y, score, score_updated_at).
- **Scripts novos**: `scripts/fetch-etf-brapi.ts` e `scripts/fetch-etf-etf1.ts` (Playwright).
- **Cron**: Nova rota `/api/cron/fetch-etf` chamada diariamente.
- **Dependências**: Playwright como nova dependência de dev/scripts (já pode existir no projeto).
- **Tiers afetados**: PREMIUM (rankings e score completo); FREE (dados básicos de cotação de ETF).

## Non-goals

- Página individual de ETF (`/etf/[ticker]`) — fora do escopo desta mudança.
- Calculadora de aportes de ETFs — fora do escopo desta mudança.
- Inclusão de ETFs na calculadora de dividendos — fora do escopo desta mudança.
- Ranking público de ETFs — viabilizado por esta mudança, mas implementado em change separado.
- Composição detalhada da carteira (top holdings) — coletada mas não exibida neste escopo.
