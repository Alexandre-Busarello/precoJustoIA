## Context

O projeto usa NextAuth.js + bcrypt (não Supabase Auth). O fluxo de primeiro acesso é via password reset token enviado por email. A fila de webhooks já existe como `WebhookEvent` com enum `WebhookProvider {STRIPE, MERCADOPAGO, KIWIFY}` e é processada pelo `WebhookProcessor`. A URL de checkout está hardcoded em `src/components/kiwify-checkout-link.tsx` como constante de string.

A Cakto difere da Kiwify em três pontos críticos:
1. **Validação**: Kiwify usa HMAC SHA1 na querystring; Cakto envia `secret` diretamente no body JSON
2. **Nomes de eventos**: `order_approved` → `purchase_approved`, `order_refunded` → `refund`, etc.
3. **Estrutura do payload**: `{ Customer, Subscription, webhook_event_type }` → `{ event, secret, data: { customer, subscription } }`

## Goals / Non-Goals

**Goals:**
- Adicionar suporte completo ao webhook da Cakto sem quebrar o endpoint Kiwify existente
- Remover o hardcode da URL de checkout; tornar configurável via banco
- Estrutura extensível: o model `PlatformConfig` suportará URLs por Partner no futuro
- Manter o fluxo de email de boas-vindas idêntico (password reset token via `EmailQueueService`)

**Non-Goals:**
- Remover o endpoint `/api/webhooks/kiwify` nesta entrega
- Criar UI admin para editar configurações (apenas API)
- Implementar lógica de Partner/multi-tenant nesta entrega
- Trocar NextAuth por outro sistema de autenticação

## Decisions

### 1. Reutilizar `WebhookEvent` com novo enum `CAKTO`

**Decisão:** adicionar `CAKTO` ao enum `WebhookProvider` em vez de criar um novo model.

**Alternativa considerada:** criar `CaktoWebhookQueue` separado (como sugerido no CAKTO.md). Rejeitado porque o projeto já tem `WebhookEvent` com campos genéricos (`rawData`, `processedData`, `retryCount`, status PENDING/PROCESSING/DONE/FAILED) que atendem exatamente ao mesmo caso de uso.

### 2. Validação de secret no body (não header, não querystring)

**Decisão:** comparar `body.secret === process.env.CAKTO_WEBHOOK_SECRET` antes de qualquer processamento.

A Cakto não usa HMAC; o secret vem em texto claro no JSON. Em produção, `CAKTO_WEBHOOK_SECRET` é obrigatório — sem ele, o endpoint retorna 401. Em `NODE_ENV=development` com `ALLOW_TEST_WEBHOOK=true`, a validação é ignorada (consistente com o comportamento do endpoint Kiwify existente).

### 3. Checkout URL armazenada na tabela `Offer` (sem tabela nova)

**Decisão:** adicionar campo `checkout_url String?` ao model `Offer` existente e tornar `price_in_cents` nullable (`Int?`). Uma oferta Cakto é identificada por ter `checkout_url` preenchido; uma oferta Stripe/PIX tem `stripe_price_id` ou `price_in_cents`.

**Alternativa considerada:** criar `PlatformConfig` key-value separado. Rejeitado porque a URL de checkout Cakto já é uma propriedade natural de uma oferta (tem tipo, duração, vigência). Reutilizar `Offer` evita uma tabela nova e centraliza a configuração de preços/produtos em um único lugar — útil quando Partners tiverem suas próprias ofertas no futuro.

**Alternativa considerada:** campo `payment_provider` enum (`STRIPE | CAKTO`). Evitado para não criar mais um enum. A presença de `checkout_url` (não nulo) é condição suficiente para identificar uma oferta Cakto.

**`price_in_cents` nullable:** para ofertas Cakto o preço é gerenciado pela Cakto; o campo pode ser preenchido opcionalmente para exibição no frontend. A migration tornará o campo nullable — breaking change no schema mas não nos dados existentes (os registros atuais têm valor).

### 4. Resolver URL de checkout via `GET /api/v1/pricing/offers` existente

**Decisão:** atualizar o endpoint existente para incluir `checkout_url` na resposta; `useCheckoutUrl` lê de lá em vez de um endpoint dedicado.

**Alternativa considerada:** criar `GET /api/platform-config/checkout-url` dedicado. Rejeitado porque o endpoint de offers já é carregado pelos componentes de pricing, evitando uma segunda request para a mesma renderização.

**Fallback chain:** `offer.checkout_url` (banco) → `process.env.NEXT_PUBLIC_CAKTO_PRODUCT_URL` → `null` (checkout desabilitado).

### 5. Não criar `PlatformConfig` — sem API admin de configurações

**Decisão:** como a URL de checkout agora é um campo da oferta, o gerenciamento é feito direto na tabela `offers`. Um admin pode atualizar via painel de banco (Supabase/Neon) ou via endpoint futuro de gerenciamento de ofertas. Nesta entrega, nenhuma API admin nova é necessária.

### 6. Novo serviço `cakto-user-service.ts` (não modificar o Kiwify existente)

**Decisão:** criar arquivo separado em vez de modificar `kiwify-user-service.ts`.

Razão: manter o endpoint Kiwify funcional durante a transição. A lógica do serviço Cakto é quase idêntica mas com campo `acquisition: 'cakto'` e `emailType: 'CAKTO_WELCOME'`.

### 7. Campos `caktoId` + `caktoOrderId` no model `User`

**Decisão:** adicionar os campos ao model `User` ao invés de criar um model `Subscription` separado (como no CAKTO.md).

O projeto já usa `kiwifyId` e `kiwifyOrderId` diretamente no `User`. A data de expiração vai em `premiumExpiresAt` (já existente). Criar um model `Subscription` separado seria uma mudança maior sem benefício direto nesta entrega.

## Risks / Trade-offs

- **Dois webhooks ativos simultaneamente** → Risco de duplo processamento se a Kiwify ainda disparar eventos durante a transição. Mitigação: a desativação do webhook Kiwify no painel é feita manualmente; os dois endpoints são independentes e não interferem.

- **`price_in_cents` nullable** → Código que acessa `offer.price_in_cents` diretamente sem null-check (ex: `formatPrice(offer.price_in_cents)`) vai quebrar em TypeScript. Mitigação: durante a implementação, auditar todos os usos de `price_in_cents` e adicionar guarda `?? 0` ou condicionais onde necessário.

- **URL de checkout via `fetch` no cliente** → Adiciona uma request extra ao carregar componentes de CTA. Mitigação: o endpoint `/api/v1/pricing/offers` já é chamado por outros componentes de pricing; pode ser consolidado numa única chamada com `SWR` ou `React.cache`.

- **`@@unique([type, is_active])`** → A constraint atual impede ter dois registros ativos do mesmo tipo (ex: MONTHLY Stripe e MONTHLY Cakto ativos simultaneamente). Mitigação: na migração, a oferta Cakto substitui a Kiwify; a constraint permanece válida.

- **`CAKTO_WELCOME` emailType** → O template de email precisa existir no `EmailQueueService`. Mitigação: na task de implementação, verificar se o serviço aceita o novo tipo ou se precisa de um novo template.

## Migration Plan

1. Adicionar `CAKTO` ao enum `WebhookProvider` e `CAKTO_WELCOME` ao enum `EmailType` no schema
2. Adicionar campos `caktoId` e `caktoOrderId` ao model `User`
3. Criar model `PlatformConfig`
4. Rodar `prisma migrate dev` (non-breaking: apenas adições)
5. Deploy do novo endpoint `/api/webhooks/cakto`
6. Configurar `CAKTO_WEBHOOK_SECRET` no ambiente de produção
7. Inserir/atualizar oferta Cakto diretamente no banco: `UPDATE offers SET checkout_url='https://pay.cakto.com.br/...', price_in_cents=NULL WHERE type='MONTHLY' AND is_active=true` (ou criar novo registro)
8. No painel Cakto, configurar webhook apontando para o novo endpoint
9. Validar com um evento de teste
10. (Futuramente) desativar o webhook Kiwify no painel Kiwify

**Rollback:** o endpoint Kiwify continua funcional; basta reconfigurar o painel Kiwify se necessário. A URL de checkout fallback (`NEXT_PUBLIC_CAKTO_PRODUCT_URL`) mantém o checkout funcionando mesmo se o banco não tiver a key.

## Open Questions

- O template de email `CAKTO_WELCOME` deve ser diferente do `KIWIFY_WELCOME` ou reutilizar o mesmo template com nome diferente? Assumimos templates idênticos por ora.
- O endpoint de admin `/api/admin/platform-config` precisa de autenticação por role ADMIN? Assumimos que sim (verificar `subscriptionTier === 'ADMIN'` no middleware).
