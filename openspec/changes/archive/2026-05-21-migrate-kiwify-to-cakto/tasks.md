## 1. Schema Prisma — Adições não-breaking e alterações no Offer

- [x] 1.1 Adicionar `CAKTO` ao enum `WebhookProvider` em `prisma/schema.prisma`
- [x] 1.2 Adicionar `CAKTO_WELCOME` ao enum `EmailType` em `prisma/schema.prisma`
- [x] 1.3 Adicionar campos `caktoId String? @unique @map("cakto_id")` e `caktoOrderId String? @map("cakto_order_id")` ao model `User`
- [x] 1.4 Tornar `price_in_cents` nullable no model `Offer`: alterar de `Int` para `Int?`
- [x] 1.5 Adicionar campo `checkout_url String? @map("checkout_url")` ao model `Offer`
- [x] 1.6 Rodar `npx prisma migrate dev --name add-cakto-integration` e verificar migration gerada

## 2. Auditoria de usos de `price_in_cents` (impacto do nullable)

- [x] 2.1 Buscar todos os acessos a `offer.price_in_cents` em `src/` e verificar se algum quebra com null
- [x] 2.2 Ajustar `src/app/api/checkout/create-pix/route.ts`: adicionar guard para `price_in_cents` nulo (ex: retornar erro se oferta não tem preço)
- [x] 2.3 Ajustar `src/app/api/v1/pricing/offers/route.ts`: tratar `price_in_cents` nulo no `formatPrice` (passar `0` ou omitir `price_formatted` para ofertas Cakto)
- [x] 2.4 Ajustar `src/lib/offer-utils.ts` se houver uso de `price_in_cents`

## 3. Atualizar endpoint de ofertas para incluir `checkout_url`

- [x] 3.1 Atualizar `src/app/api/v1/pricing/offers/route.ts`: adicionar campo `checkout_url: string | null` no tipo de resposta de cada oferta (monthly, annual, special)
- [x] 3.2 Verificar que `src/app/api/checkout/create-session/route.ts` não tenta criar sessão Stripe para ofertas com `checkout_url` (deve retornar erro ou redirecionar)

## 4. Serviço de usuário Cakto

- [x] 4.1 Criar `src/lib/cakto-user-service.ts` com função `createOrUpdateCaktoUser(email, name, caktoId, caktoOrderId, nextPaymentDate)` — baseado em `kiwify-user-service.ts` com `acquisition: "cakto"` e sem reenviar email para usuários já PREMIUM
- [x] 4.2 Implementar `calcCaktoExpiration(data)` em `cakto-user-service.ts`: prioridade `data.subscription.next_payment` → `data.subscription_period` (weekly/monthly/yearly) → +12 meses padrão
- [x] 4.3 Implementar `sendCaktoWelcomeEmail(email, userName)` em `cakto-user-service.ts` usando `EmailQueueService.queueEmail` com `emailType: "CAKTO_WELCOME"` e password reset token de 7 dias
- [x] 4.4 Implementar `removePremiumFromUser(email)` em `cakto-user-service.ts`: setar `subscriptionTier: FREE`, `premiumExpiresAt: null`

## 5. Webhook Cakto — Endpoint principal

- [x] 5.1 Criar `src/app/api/webhooks/cakto/route.ts` com `export const dynamic = "force-dynamic"` e função `POST(request: NextRequest)`
- [x] 5.2 Implementar parse do body com try/catch retornando 400 em caso de JSON inválido
- [x] 5.3 Implementar validação de secret: comparar `body.secret === process.env.CAKTO_WEBHOOK_SECRET`; retornar 401 se inválido; ignorar em `NODE_ENV=development && ALLOW_TEST_WEBHOOK=true`
- [x] 5.4 Implementar filtro de eventos: lista `PROCESSED_EVENTS` com os 6 eventos suportados; retornar 200 silencioso para eventos fora da lista
- [x] 5.5 Implementar criação de `WebhookEvent` no banco com `provider: "CAKTO"`, `eventType`, `rawData`, `status: "PROCESSING"` antes do despacho
- [x] 5.6 Implementar switch de despacho: `purchase_approved` → `handlePurchaseApproved`; `refund/chargeback/subscription_canceled` → `removePremiumFromUser`; `subscription_renewed` → `handleRenewal`; `subscription_renewal_refused` → apenas log
- [x] 5.7 Atualizar `WebhookEvent` para `DONE` (com `processedAt`) ou `FAILED` (com `errorMessage`) ao final
- [x] 5.8 Implementar `handlePurchaseApproved(data)`: validar `data.status === "paid"`, chamar `createOrUpdateCaktoUser` e `sendCaktoWelcomeEmail` apenas se usuário for novo ou estava FREE
- [x] 5.9 Implementar `handleRenewal(data)`: buscar usuário por email, chamar `calcCaktoExpiration`, atualizar `premiumExpiresAt` e confirmar `subscriptionTier: PREMIUM`

## 6. WebhookProcessor — Adicionar suporte Cakto

- [x] 6.1 Adicionar método estático `processCaktoEvent({ eventType, rawData })` em `src/lib/webhook-processor.ts` que despacha para os handlers do `cakto-user-service.ts`
- [x] 6.2 Verificar que o cron job `src/app/api/cron/process-payments/route.ts` reprocessa eventos Cakto com status `FAILED` (ajustar filtro de provider se necessário)

## 7. Frontend — URL de checkout dinâmica via oferta ativa

- [x] 7.1 Atualizar `src/components/kiwify-checkout-link.tsx`: remover constante `KIWIFY_CHECKOUT_URL` hardcoded; buscar `checkout_url` da oferta ativa via `GET /api/v1/pricing/offers` no hook `useCheckoutUrl` com estado `{ url, loading }`
- [x] 7.2 Ajustar `buildCheckoutUrl` para aceitar `baseUrl: string | null` como primeiro parâmetro
- [x] 7.3 Atualizar `CheckoutLink` para desabilitar/ocultar quando `url === null`
- [x] 7.4 Verificar que `oferta-checkout-buttons.tsx` e `dynamic-cta-section.tsx` continuam funcionando sem alteração de importação

## 8. Variáveis de ambiente

- [x] 8.1 Adicionar `CAKTO_WEBHOOK_SECRET=` ao arquivo de documentação de env vars do projeto
- [x] 8.2 Documentar que `NEXT_PUBLIC_CAKTO_PRODUCT_URL` é fallback opcional (a URL primária vem da oferta ativa no banco)

## 9. Verificação e testes manuais

- [ ] 9.1 Inserir oferta Cakto no banco: registro com `type=MONTHLY`, `is_active=true`, `checkout_url='https://pay.cakto.com.br/...'`, `price_in_cents=NULL` (ou valor de exibição) — **executar manualmente após db push**
- [ ] 9.2 Verificar que o botão de CTA na home usa a URL da oferta do banco — **manual**
- [ ] 9.3 Testar `POST /api/webhooks/cakto` com payload `purchase_approved` + `status: paid` e verificar criação de usuário PREMIUM — **manual**
- [ ] 9.4 Testar `POST /api/webhooks/cakto` com secret inválido e verificar retorno 401 — **manual**
- [ ] 9.5 Verificar que `GET /api/v1/pricing/offers` retorna `checkout_url` no payload — **manual**
- [ ] 9.6 Verificar que o endpoint `/api/webhooks/kiwify` continua respondendo normalmente (sem regressão) — **manual**
