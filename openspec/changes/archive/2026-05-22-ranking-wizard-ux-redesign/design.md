## Context

A página `/ranking` hoje renderiza todos os blocos de conteúdo verticalmente: hub de seleção de ativo, histórico de rankings, formulário do QuickRanker e seções de SEO/FAQ. O resultado é uma tela de ~2 000 px de altura com múltiplos pontos de atenção competindo ao mesmo tempo. Em mobile, o usuário não consegue nem ver o botão de "Gerar Ranking" sem rolar metade da página.

A solução é substituir o layout monolítico por um **Wizard com 4 steps**, gerenciado por estado local no cliente (sem mudanças de rota intermediárias). O estado do wizard é gerenciado em `RankingWizard`, componente raiz que substitui o corpo atual de `page.tsx`.

## Goals / Non-Goals

**Goals:**
- Step 1: escolha entre "Criar novo ranking" e "Ver histórico" (ambos os tiers)
- Step 2a (histórico): listagem filtrável + abertura inline do ranking salvo
- Step 2b (novo): seleção de classe de ativo (B3 / BDR / Ambos / FII)
- Step 3: configuração e execução do modelo (QuickRanker encapsulado)
- Step 4: exibição do resultado com ações (salvar, compartilhar, novo ranking)
- Barra de progresso animada mostrando step atual
- Layout mobile-first com breakpoints sm/md/lg
- Animação de transição entre steps (slide ou fade)
- Compatibilidade com URL params existentes (`?assetType=`, `?id=`) para deep-linking

**Non-Goals:**
- Alterações em APIs de backend
- Novas estratégias de valuation
- Mudança de esquema do banco de dados
- Remoção de rotas existentes

## Decisions

### 1. Gerenciamento de estado: useState local no RankingWizard (sem Zustand/Context global)

**Decisão:** Todo o estado do wizard (step atual, assetType selecionado, rankingId carregado, resultados) vive em `useState` dentro do componente `RankingWizard`.

**Alternativas consideradas:**
- React Context: overhead desnecessário para estado confinado a uma única página
- URL params para cada transição: causaria re-renders de SSR e conflito com o roteamento do Next.js 14 App Router

**Rationale:** O wizard é uma funcionalidade totalmente client-side. Não há necessidade de sincronização cross-tab nem persistência de estado entre sessões. `useState` + `useReducer` são suficientes e mais simples.

### 2. Componentes reutilizados via adapter props

**Decisão:** `QuickRanker`, `RankingHistorySection` e `AssetTypeHub` são reutilizados sem refatoração interna. O wizard injeta props de callback (`onComplete`, `onBack`) para integrar os componentes ao fluxo.

**Rationale:** Minimiza risco de regressão. A lógica de negócio validada (geração de ranking, fetch de histórico) não é tocada.

### 3. Animações com Framer Motion (já no projeto) via `AnimatePresence`

**Decisão:** Transições entre steps usam `framer-motion` com variantes de slide horizontal.

**Alternativa considerada:** CSS transitions puras — menos controle sobre montagem/desmontagem de componentes.

### 4. Barra de progresso: stepper visual fixo no topo do wizard

**Decisão:** Componente `WizardStepper` renderiza ícone + label de cada step. Step atual destacado, steps anteriores marcados como concluídos. Em mobile (< sm): apenas números e ícone, sem labels.

### 5. Deep-linking: URL params inicializam o wizard no step correto

**Decisão:** Na montagem do `RankingWizard`, os params `assetType` e `id` são lidos via `useSearchParams`. Se `id` presente → step 4 (resultado). Se `assetType` presente sem `id` → step 3 (configuração). Sem params → step 1.

**API Routes afetadas (sem mudança de contrato):**
- `GET /api/ranking-history` — usado no Step 2a
- `GET /api/ranking/[id]` — usado no Step 4 (deep-link) e Step 2a (abrir item)
- `POST /api/rank-builder` — usado no Step 3 (QuickRanker)

**Modelos de DB:** nenhum alterado.

### 6. Cache e invalidação

Nenhuma estratégia de cache nova é necessária. O wizard delega fetch ao `QuickRanker` e `RankingHistorySection` que já gerenciam seus próprios estados de loading. O `historyRefreshTrigger` existente é mantido para forçar reload do histórico após novo ranking ser gerado.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| `QuickRanker` tem 800+ linhas e acoplamento com layout atual | Encapsulamos sem tocar internos; testamos visualmente antes de remover código legado |
| Deep-link por URL params pode colidir com estado do wizard | Inicialização declarativa no `useEffect` de montagem; params sobrescrevem estado default |
| Animações pesadas em mobile low-end | Usar `transform` + `opacity` (compositor thread); desabilitar via `prefers-reduced-motion` |
| Usuário perde estado do formulário ao voltar um step | Manter estado do wizard no componente pai; cada step recebe valores via props |
| SEO: conteúdo do hub e FAQs removidos do DOM principal | Mover para componente colapsável abaixo do wizard ou página `/ranking/como-funciona` separada |

## Migration Plan

1. Criar `RankingWizard` e sub-componentes sem remover código atual
2. Feature flag via variável de ambiente `NEXT_PUBLIC_RANKING_WIZARD=true` durante desenvolvimento
3. Testar em staging com URL params existentes para garantir deep-link
4. Substituir corpo de `page.tsx` pelo wizard
5. Mover seções de SEO/FAQ para componente separado abaixo do fold
6. Remover `AssetTypeHubWrapper` e código legado

**Rollback:** reverter `page.tsx` para versão anterior (mantida em git); zero impacto em DB ou APIs.

## Open Questions

- As seções "Como Funciona" e "FAQ" devem ser mantidas abaixo do wizard ou movidas para página dedicada? (decisão de produto)
- O Step 1 deve ser exibido para usuários não logados? Se não logado, podemos ir direto para Step 2b.
