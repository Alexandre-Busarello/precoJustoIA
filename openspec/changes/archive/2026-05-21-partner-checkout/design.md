## Context

O sistema atual não tem suporte a parceiros. O modelo de checkout (`dynamic-checkout-url`) resolve a URL a partir da oferta ativa no banco, mas não considera origem/atribuição do usuário. O `User` não possui vínculo com nenhum canal de aquisição externo com split de pagamento.

O primeiro parceiro a ser suportado é o **Clube dos Dividendos**, cuja URL de Checkout no Cakto já possui o split 50/50 e desconto configurados. A LP do parceiro é uma página fake em `/parceiros/clube-dos-dividendos` — funcional para rastreamento, sem design elaborado por ora.

## Goals / Non-Goals

**Goals:**
- Criar o modelo `Partner` e a FK imutável `partnerId` em `User`.
- Gravar o `partnerId` no `localStorage` ao acessar a LP de qualquer parceiro.
- Vincular o parceiro no momento do cadastro do usuário.
- Bifurcar a lógica de checkout: visitante usa `localStorage`, logado usa BD.
- Garantir que `partnerId` nunca seja sobrescrito após a primeira atribuição.

**Non-Goals:**
- Painel de administração de parceiros.
- Dashboard de conversão/analytics por parceiro.
- Múltiplas ofertas por parceiro.
- LP com design elaborado (fase futura).

## Decisions

### Decisão 1: Persistência no cliente via `localStorage` (não `sessionStorage`)

**Escolha:** `localStorage` com chave `partner_id`.

**Alternativas consideradas:**
- `sessionStorage`: descartado porque fecha ao fechar a aba — o usuário poderia acessar a LP, fechar o navegador e criar a conta dias depois sem o marcador.
- Cookie HTTP-only: mais complexo de implementar no edge e não há necessidade de segurança server-side nesse ponto.

**Rationale:** O `localStorage` persiste indefinidamente até que o usuário limpe os dados do navegador, o que é o comportamento desejado. A soberania permanente é garantida pelo BD, não pelo browser — o `localStorage` é apenas o vetor de captura inicial.

---

### Decisão 2: Imutabilidade de `partnerId` implementada na camada de serviço, não via constraint de BD

**Escolha:** Proteção no backend (nunca fazer `UPDATE user SET partner_id = ...` se o campo já estiver preenchido).

**Alternativas consideradas:**
- Trigger PostgreSQL: mais robusto contra acesso direto ao BD, mas adiciona complexidade e dificulta migrações.
- Constraint de BD (check): não existe constraint padrão para "campo só pode ser escrito uma vez" em Postgres sem triggers.

**Rationale:** A proteção via serviço é suficiente para o caso de uso. A regra fica explícita no código e documentada no spec. Uma linha de log de warning ao tentar sobrescrever ajuda no debug.

---

### Decisão 3: LP fake como rota Next.js (`/parceiros/[slug]`)

**Escolha:** Rota dinâmica `src/app/parceiros/[slug]/page.tsx` que:
1. Carrega os dados do parceiro pelo slug via BD (server component).
2. Renderiza um client component que grava o `partner_id` no `localStorage`.
3. Exibe CTA simples ("Criar conta" / "Assinar agora").

**Rationale:** Reutilizável para futuros parceiros sem criar uma página por slug. O slug é validado no servidor — se não existir, retorna 404.

---

### Decisão 4: Resolução de checkout URL — sem nova API, extensão do hook existente

**Escolha:** Estender `useCheckoutUrl` para receber o `partnerId` do usuário (vindo da sessão NextAuth) ou do `localStorage` (para visitantes), e consultar `GET /api/v1/pricing/offers?partnerId=<id>` ou uma nova query interna.

**Alternativas consideradas:**
- Novo endpoint `/api/v1/partners/[slug]/checkout-url`: mais limpo em termos de separação, mas duplica a lógica de append de UTM/email.
- Passar a URL do parceiro diretamente da sessão NextAuth via custom session field: elimina um fetch, mas polui a sessão com dados de checkout.

**Rationale:** Estender o hook mantém um único ponto de construção da URL final (com UTM, email etc.). O backend resolve qual URL usar com base na prioridade: parceiro > oferta padrão > env var.

---

### Decisão 5: `partnerId` na sessão NextAuth via `session.user.partnerId`

**Escolha:** Adicionar `partnerId` ao objeto de sessão via callback `session` do NextAuth, lendo do `User` no banco.

**Rationale:** Isso permite que o hook `useCheckoutUrl` (client) leia o `partnerId` do usuário logado sem fazer um fetch adicional. O campo já é carregado junto com os outros campos de sessão existentes (`subscriptionTier`, `isAdmin`, etc.).

## Risks / Trade-offs

- **[Risco] Race condition no cadastro**: Se o usuário cria a conta em múltiplas abas simultaneamente, `partnerId` pode ser gravado duas vezes.
  → Mitigação: o `upsert` no Prisma com `where: { id }` garante que a segunda escrita apenas ignora o campo se já preenchido (proteção de serviço).

- **[Risco] `localStorage` bloqueado**: Alguns browsers em modo privado bloqueiam `localStorage`.
  → Mitigação: Usar `try/catch` na escrita/leitura. Se bloqueado, o fluxo segue sem o marcador (usuário não será vinculado ao parceiro — aceitável para casos edge).

- **[Trade-off] Soberania absoluta pode frustrar o usuário**: Um usuário que se cadastrou via parceiro nunca poderá usar um cupom de desconto de outro canal.
  → Aceitável: é o comportamento de negócio desejado. Não há suporte a overrides.

- **[Risco] LP fake sem SEO/design pode prejudicar conversão inicial**.
  → Mitigação: é intencional e temporário. O objetivo inicial é apenas o rastreamento.

## Migration Plan

1. Criar migration Prisma: nova tabela `Partner` + coluna `partner_id` em `User` (nullable, sem default).
2. Inserir manualmente o registro do Clube dos Dividendos no banco (slug, lp_url, checkout_url Cakto).
3. Deploy do backend (API + session callback).
4. Deploy do frontend (LP route, hook atualizado, lógica de `localStorage`).
5. Rollback: remover a coluna `partner_id` (sem dados críticos perdidos nos primeiros dias).

**Sem zero-downtime concerns**: a coluna é nullable e o novo código é aditivo.

## Open Questions

- A URL de Checkout do Cakto para o Clube dos Dividendos já está configurada com o split? (Confirmar antes do deploy em produção.)
- O `partnerId` deve ser incluído como query param no checkout URL para rastreamento no lado do Cakto? (Ex: `?ref=clube-dos-dividendos`)
