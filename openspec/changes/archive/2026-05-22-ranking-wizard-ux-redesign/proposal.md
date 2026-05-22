## Why

A página de Ranking atual sofre de sobrecarga cognitiva severa: todos os fluxos (seleção de classe de ativo, configuração do modelo, execução e histórico) são empilhados verticalmente em uma única tela longa, exigindo scroll excessivo e deixando o usuário sem clareza sobre em qual etapa está. A adoção de um fluxo wizard por etapas elimina a desorientação, reduz o time-to-first-ranking e melhora a experiência em mobile — dispositivo dominante entre investidores de varejo.

## What Changes

- **Novo fluxo Wizard multi-step** substitui o layout vertical monolítico da página `/ranking`
- **Step 1 – Escolha de Destino**: cartões de ação "Criar novo ranking" vs. "Ver histórico"
- **Step 2a – Histórico**: listagem paginada e filtrada dos rankings salvos; clicar em um item carrega o resultado completo inline
- **Step 2b – Seleção de Classe de Ativo**: seletor visual com cards (B3, BDR, Ambos, FII) substituindo o hub atual
- **Step 3 – Configuração do Modelo**: seleção do modelo de valuation + parâmetros (conteúdo atual do `QuickRanker`)
- **Step 4 – Resultado**: exibição do ranking gerado com opções de salvar/compartilhar
- **Barra de progresso / breadcrumb** persistente indicando o step atual
- **Responsividade mobile-first**: layout em coluna única com navegação por botões grandes e touch-friendly
- Remoção das seções de SEO, "Como funciona" e FAQs do fluxo principal (movidas para landing page ou modal separado)

## Capabilities

### New Capabilities

- `ranking-wizard`: Fluxo wizard multi-step para criação e visualização de rankings; controla navegação entre steps, estado global do wizard e transições animadas
- `ranking-history-browser`: Listagem navegável do histórico de rankings com filtros (modelo, data), paginação e abertura de ranking salvo inline dentro do wizard

### Modified Capabilities

- `ranking-asset-selection`: Seleção de classe de ativo passa a ser o Step 2b do wizard em vez de hub de página independente (`/ranking` sem params); mesma lógica, novo container

## Impact

- `src/app/ranking/page.tsx` — refatoração estrutural: o conteúdo é redistribuído entre os novos componentes do wizard
- `src/components/quick-ranker.tsx` — permanece como Step 3, encapsulado dentro do wizard; sem alteração na lógica de negócio
- `src/components/ranking-history-section.tsx` — reusado/adaptado para Step 2a (histórico)
- `src/components/asset-type-hub.tsx` — reusado/adaptado para Step 2b (seleção de ativo)
- Novos componentes: `RankingWizard`, `WizardStep`, `RankingHistoryBrowser`
- Rotas inalteradas (`/ranking`, `/api/rank-builder`, `/api/ranking-history`, `/api/ranking/[id]`)
- Afeta todos os tiers (FREE e PREMIUM); comportamento de gate de premium mantido dentro do Step 3

## Non-goals

- Não altera lógica de estratégias ou APIs de backend
- Não cria novas estratégias de valuation
- Não modifica o sistema de autenticação ou pagamento
- Não remove as rotas existentes (compatibilidade com links externos/SEO mantida)
- Não migra dados históricos existentes
