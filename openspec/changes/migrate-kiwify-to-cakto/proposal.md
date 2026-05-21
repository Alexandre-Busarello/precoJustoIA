## Why

A Kiwify está sendo substituída pela Cakto como plataforma de checkout e gestão de assinaturas. A URL de checkout está hardcoded no código (`kiwify-checkout-link.tsx`), o que exige redeploy a cada mudança de produto — e não suportará configuração por parceiro (Partner) que vem na sequência.

## What Changes

- **Novo endpoint de webhook** `POST /api/webhooks/cakto` com validação de `secret` no body (diferente do HMAC SHA1 da Kiwify via querystring)
- **Novo serviço** `cakto-user-service.ts` adaptado para o payload e eventos da Cakto (`purchase_approved`, `subscription_renewed`, `refund`, `chargeback`, `subscription_canceled`, `subscription_renewal_refused`)
- **WebhookProcessor** atualizado com método `processCaktoEvent`
- **WebhookProvider enum** ampliado com valor `CAKTO`
- **EmailType enum** atualizado: adiciona `CAKTO_WELCOME` (mantém `KIWIFY_WELCOME` para compatibilidade)
- **Schema Prisma**: campo `caktoId` + `caktoOrderId` no model `User`; `Offer` recebe campo `checkout_url String?` e `price_in_cents` torna-se nullable — ofertas Cakto usam a URL em vez de `stripe_price_id`
- **Checkout URL via banco**: a oferta ativa com `checkout_url` preenchido já **é** a configuração do checkout Cakto — sem tabela adicional
- **`kiwify-checkout-link.tsx` refatorado**: busca `checkout_url` da oferta ativa via `GET /api/v1/pricing/offers` em vez de constante hardcoded; mantém fallback para `env` e depois para string vazia
- **Non-goals**: remover o endpoint `/api/webhooks/kiwify` agora (fica como fallback enquanto a migração não é 100%); criar UI admin de ofertas; implementar lógica de Partner nesta entrega

## Capabilities

### New Capabilities

- `cakto-webhook`: Recebe e processa webhooks da Cakto — autenticação, fila, despacho de eventos e atualização de usuário/subscription
- `dynamic-checkout-url`: Hook/componente frontend que resolve a URL de checkout a partir da oferta ativa com `checkout_url` em vez de hardcode; suporta parâmetros UTM e email

### Modified Capabilities

- `authentication`: campo de aquisição pode receber `"cakto"` além de `"kiwify"`; fluxo de primeiro acesso (password reset token) permanece igual — apenas o `emailType` muda para `CAKTO_WELCOME`

## Impact

- **Prisma schema**: novo enum `CAKTO` em `WebhookProvider`; novo enum `CAKTO_WELCOME` em `EmailType`; campos `caktoId` e `caktoOrderId` em `User`; campo `checkout_url String?` e `price_in_cents Int?` (nullable) no model `Offer`; nova migration necessária
- **API routes**: novo `src/app/api/webhooks/cakto/route.ts`; `GET /api/v1/pricing/offers` atualizado para incluir `checkout_url` na resposta
- **Libs**: novo `src/lib/cakto-user-service.ts`; atualização em `src/lib/webhook-processor.ts`
- **Env vars**: adiciona `CAKTO_WEBHOOK_SECRET`; `NEXT_PUBLIC_CAKTO_PRODUCT_URL` vira fallback (não mais obrigatória)
- **Frontend**: `src/components/kiwify-checkout-link.tsx` (renomear para `checkout-link.tsx` ou manter nome por compatibilidade de importações)
- **Tiers afetados**: PREMIUM (criação e renovação de assinatura via Cakto)
