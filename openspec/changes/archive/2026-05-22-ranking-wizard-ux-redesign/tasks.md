## 1. Tipos e estado do wizard

- [x] 1.1 Criar arquivo `src/components/ranking-wizard/types.ts` com tipos `WizardStep`, `WizardFlow`, `WizardState` e `AssetTypeOption`
- [x] 1.2 Criar hook `src/components/ranking-wizard/use-wizard-state.ts` com `useReducer` gerenciando step atual, fluxo ativo, assetType selecionado e rankingId carregado
- [x] 1.3 Adicionar lógica de inicialização por URL params (`useSearchParams`) no hook: `id` presente → step 4, `assetType` presente → step 3, sem params → step 1

## 2. Componente WizardStepper (barra de progresso)

- [x] 2.1 Criar `src/components/ranking-wizard/wizard-stepper.tsx` com renderização dos steps do fluxo ativo (ícone, label, estado: pendente / ativo / concluído)
- [x] 2.2 Implementar variante mobile: exibir apenas ícones e números quando `width < 640px` usando classes Tailwind responsivas
- [x] 2.3 Aplicar destaque visual ao step ativo (cor de acento, borda) e ícone de check nos steps concluídos

## 3. Step 1 — Escolha de destino

- [x] 3.1 Criar `src/components/ranking-wizard/steps/step-destination.tsx` com dois cards: "Criar novo ranking" e "Ver histórico de rankings"
- [x] 3.2 Implementar layout grid: coluna única em mobile, 2 colunas em md+
- [x] 3.3 Cada card deve ter ícone, título, descrição curta e área de toque mínima de 44x44px
- [x] 3.4 Ao clicar em "Criar novo ranking" despachar ação `SELECT_FLOW('new')` que avança para step 2b
- [x] 3.5 Ao clicar em "Ver histórico" despachar ação `SELECT_FLOW('history')` que avança para step 2a; exibir estado de gate para usuário não autenticado

## 4. Step 2a — Navegador de histórico

- [x] 4.1 Criar `src/components/ranking-wizard/steps/step-history.tsx` encapsulando a busca em `GET /api/ranking-history` com paginação (limit=10)
- [x] 4.2 Implementar cards de item do histórico com: data formatada (pt-BR), nome do modelo, badge de classe de ativo, contagem de resultados e botão "Ver ranking"
- [x] 4.3 Implementar estado vazio com ilustração e botão "Criar meu primeiro ranking" que redireciona para fluxo `new`
- [x] 4.4 Adicionar filtros: select de modelo e date picker de período; ao mudar filtro refetch a lista
- [x] 4.5 Ao clicar em um item despachar ação `LOAD_RANKING(id)` que avança para step configure e inicia fetch via QuickRanker
- [x] 4.6 Implementar layout responsivo: cards full-width em mobile, linha horizontal em sm+

## 5. Step 2b — Seleção de classe de ativo

- [x] 5.1 Criar `src/components/ranking-wizard/steps/step-asset-type.tsx` com quatro cards: Ações B3, BDRs, B3 + BDRs, FIIs
- [x] 5.2 Cada card deve ter ícone/emoji representativo, título e descrição de uma linha
- [x] 5.3 Implementar seleção com estado: card selecionado ganha borda colorida e ícone de check no canto
- [x] 5.4 Habilitar botão "Continuar" apenas quando um card estiver selecionado
- [x] 5.5 Implementar layout: grid 2x2 em mobile, 4 colunas em md+
- [x] 5.6 Ao clicar "Continuar" despachar ação `SELECT_ASSET_TYPE(assetType)` avançando para step configure

## 6. Step 3 — Configuração do modelo (QuickRanker)

- [x] 6.1 Adaptar `src/components/quick-ranker.tsx` para aceitar props `onBack()` (adicionado sem alterar lógica interna)
- [x] 6.2 QuickRanker recebe `assetTypeFilter` e `rankingId` via props do wizard (já funcionava assim)
- [x] 6.3 Criar `src/components/ranking-wizard/steps/step-configure.tsx` que renderiza `QuickRanker` com as props do wizard e botão "Voltar"
- [x] 6.4 `onRankingGenerated` atualiza o `historyRefreshTrigger` no wizard pai (QuickRanker já mostra resultados inline)

## 7. Step resultado — Unificado com Step Configure

- [x] 7.1 Resultado exibido inline pelo QuickRanker quando `rankingId` é passado (fetch via `GET /api/ranking/[id]`)
- [x] 7.2 Skeleton loader já implementado dentro do QuickRanker durante carregamento por ID
- [x] 7.3 Badge "Visualizando ranking salvo" exibido pelo QuickRanker quando `isViewingCached` está ativo
- [x] 7.4 Estado de erro tratado pelo QuickRanker
- [x] 7.5 Botão "Voltar" no `step-configure.tsx` permite retornar ao histórico ou seleção de ativo
- [x] 7.6 Resultado renderizado pelo sistema de cards já existente no QuickRanker

## 8. Componente raiz RankingWizard e animações

- [x] 8.1 Criar `src/components/ranking-wizard/ranking-wizard.tsx` como componente raiz que orquestra o estado do hook e renderiza `WizardStepper` + step ativo
- [x] 8.2 Implementar `AnimatePresence` do Framer Motion com variantes de slide horizontal (avanço: entrada da direita; retorno: entrada da esquerda)
- [x] 8.3 Adicionar suporte a `prefers-reduced-motion`: substituir slide por fade simples quando ativado
- [x] 8.4 Criar `src/components/ranking-wizard/index.ts` exportando `RankingWizard` e tipos públicos

## 9. Integração na página principal

- [x] 9.1 Substituir o corpo de `src/app/ranking/page.tsx` pelo componente `RankingWizard` mantendo `Suspense` e metadados SEO existentes
- [x] 9.2 Mover seções "Como Funciona" e "FAQ" para componente colapsável `RankingInfoSection` renderizado abaixo do wizard
- [x] 9.3 Remover componente `AssetTypeHubWrapper` e imports não utilizados após integração
- [x] 9.4 URL params `assetType` e `id` são lidos pelo `useWizardState` hook via `useSearchParams` na montagem

## 10. Testes visuais e responsividade

- [x] 10.1 Verificar fluxo completo "Criar novo ranking" em mobile (375px): step 1 → 2b → 3 → 4
- [x] 10.2 Verificar fluxo "Ver histórico" em mobile: step 1 → 2a — cards empilhados em tela cheia ✓
- [x] 10.3 Verificar deep-link `/ranking?assetType=b3` inicializa no step configure com B3 pré-selecionado ✓
- [x] 10.4 Verificar deep-link com `id` inicializa no step configure carregando ranking salvo (QuickRanker com rankingId) ✓
- [x] 10.5 Lógica `prefers-reduced-motion` implementada no hook `useReducedMotion` → substitui slide por fade ✓
- [x] 10.6 Gate de premium preservado dentro do QuickRanker (código não alterado) ✓
