# Endpoints Removidos na Refatoração

## Data: 2024

## Endpoints Removidos

Os seguintes endpoints foram removidos porque não são mais usados no frontend refatorado:

### 1. POST `/api/portfolio/[id]/transactions/suggestions/rebalancing`
- **Motivo**: Não cria mais transações PENDING. Sugestões são dinâmicas via `/api/portfolio/[id]/suggestions?type=rebalancing`
- **Substituído por**: GET `/api/portfolio/[id]/suggestions?type=rebalancing`

### 2. POST `/api/portfolio/[id]/transactions/suggestions/contributions`
- **Motivo**: Não cria mais transações PENDING. Sugestões são dinâmicas via `/api/portfolio/[id]/suggestions?type=contribution`
- **Substituído por**: GET `/api/portfolio/[id]/suggestions?type=contribution`

### 3. POST `/api/portfolio/[id]/transactions/suggestions/dividends`
- **Motivo**: Não cria mais transações PENDING. Sugestões devem ser dinâmicas (ainda não implementado)
- **Substituído por**: GET `/api/portfolio/[id]/suggestions?type=dividends` (quando implementado)

### 4. POST `/api/portfolio/[id]/transactions/suggestions/confirm`
- **Motivo**: Não há mais transações PENDING para confirmar. Usuário confirma diretamente via formulário pré-preenchido
- **Substituído por**: POST `/api/portfolio/[id]/transactions` (criação direta de transação CONFIRMED/EXECUTED)

## Endpoints Mantidos

### GET `/api/portfolio/[id]/transactions/suggestions/rebalancing/check`
- **Motivo**: Ainda usado pelo componente `PortfolioRebalancingSuggestions` refatorado para verificar necessidade de rebalanceamento
- **Status**: Mantido

### GET `/api/portfolio/[id]/transactions/suggestions/status`
- **Motivo**: Usado apenas por componentes antigos (`portfolio-transaction-suggestions.tsx`, `portfolio-pending-transactions-cta.tsx`)
- **Status**: Mantido temporariamente para compatibilidade com sistema antigo
- **Nota**: Pode ser removido quando os componentes antigos forem completamente substituídos

## Nova Arquitetura

### Endpoint Principal de Sugestões
- **GET** `/api/portfolio/[id]/suggestions?type=rebalancing|contribution|dividends`
- Retorna sugestões calculadas dinamicamente (não salvas no banco)
- Usado pelos componentes refatorados

### Fluxo de Confirmação
1. Frontend busca sugestões via `/api/portfolio/[id]/suggestions`
2. Usuário clica em sugestão → abre formulário pré-preenchido
3. Usuário confirma → POST `/api/portfolio/[id]/transactions` cria transação direto como CONFIRMED/EXECUTED

## Impacto

- **Redução de código**: ~400 linhas de código removidas
- **Simplificação**: Menos endpoints para manter
- **Performance**: Sugestões sempre atualizadas (calculadas em tempo real)
- **UX**: Fluxo mais direto (sem etapa intermediária de PENDING)

