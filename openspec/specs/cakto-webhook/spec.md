# Spec: Cakto Webhook

## Purpose
Define the integration with Cakto payment platform via webhooks, including event reception and validation, event queue management, and business logic for purchase lifecycle events (activation, renewal, refund, cancellation).

## Requirements

### Requirement: Receber e validar webhook da Cakto
O sistema SHALL expor `POST /api/webhooks/cakto` que receba o payload JSON da Cakto, valide o `secret` presente no body e retorne 200 para eventos processados ou ignorados.

#### Scenario: Secret válido — evento processado
- **WHEN** a Cakto envia `POST /api/webhooks/cakto` com `body.secret` igual a `CAKTO_WEBHOOK_SECRET` e `body.event === "purchase_approved"`
- **THEN** o sistema retorna HTTP 200 com `{ success: true }`

#### Scenario: Secret inválido
- **WHEN** a Cakto envia `POST /api/webhooks/cakto` com `body.secret` incorreto
- **THEN** o sistema retorna HTTP 401 com `{ error: "Secret inválido" }` e NÃO processa o evento

#### Scenario: JSON malformado
- **WHEN** o body recebido não é JSON válido
- **THEN** o sistema retorna HTTP 400 com `{ error: "Invalid JSON" }`

#### Scenario: Evento não reconhecido
- **WHEN** `body.event` não está na lista de eventos suportados (ex: `checkout_abandonment`)
- **THEN** o sistema retorna HTTP 200 com `{ success: true, message: "Evento ignorado" }` sem registrar na fila

#### Scenario: Modo desenvolvimento sem secret configurado
- **WHEN** `NODE_ENV=development`, `ALLOW_TEST_WEBHOOK=true` e `CAKTO_WEBHOOK_SECRET` não está definido
- **THEN** a validação de secret é ignorada e o evento é processado normalmente

---

### Requirement: Registrar evento na fila antes do processamento
O sistema SHALL criar um registro em `WebhookEvent` com `provider: CAKTO` e `status: PROCESSING` antes de executar a lógica de negócio, e atualizar para `DONE` ou `FAILED` após o término.

#### Scenario: Evento salvo com sucesso
- **WHEN** o endpoint recebe um evento reconhecido e válido
- **THEN** um registro `WebhookEvent` é criado com `provider: CAKTO`, `eventType` com o valor de `body.event`, `rawData` com o payload completo e `status: PROCESSING`

#### Scenario: Processamento com sucesso
- **WHEN** a lógica de negócio executa sem erro
- **THEN** o registro `WebhookEvent` é atualizado para `status: DONE` com `processedAt` preenchido

#### Scenario: Erro durante processamento
- **WHEN** ocorre uma exceção na lógica de negócio
- **THEN** o registro `WebhookEvent` é atualizado para `status: FAILED` com `errorMessage` preenchido, e o endpoint retorna HTTP 500

---

### Requirement: Processar evento `purchase_approved`
O sistema SHALL, ao receber `purchase_approved` com `data.status === "paid"`, criar ou atualizar o usuário no banco, ativar o tier PREMIUM e enviar email de boas-vindas com link de primeiro acesso.

#### Scenario: Novo usuário
- **WHEN** `purchase_approved` chega com email que não existe no banco
- **THEN** um novo `User` é criado com `subscriptionTier: PREMIUM`, `premiumExpiresAt` calculado, `caktoId` e `caktoOrderId` preenchidos, `acquisition: "cakto"`, e um email `CAKTO_WELCOME` é enfileirado via `EmailQueueService`

#### Scenario: Usuário existente já FREE
- **WHEN** `purchase_approved` chega com email de usuário FREE existente
- **THEN** o usuário tem `subscriptionTier` atualizado para `PREMIUM`, `premiumExpiresAt` atualizado, `caktoId` e `caktoOrderId` preenchidos, e email `CAKTO_WELCOME` é enviado

#### Scenario: Usuário existente já PREMIUM
- **WHEN** `purchase_approved` chega para usuário que já é PREMIUM
- **THEN** `premiumExpiresAt` é atualizado para a data mais distante entre a atual e a nova, sem duplicar envio de email

#### Scenario: Status diferente de `paid`
- **WHEN** `purchase_approved` chega com `data.status !== "paid"` (ex: `pending`)
- **THEN** o evento é registrado na fila mas NÃO executa lógica de negócio; retorna 200

#### Scenario: Cálculo de expiração via `next_payment`
- **WHEN** `data.subscription.next_payment` está presente no payload
- **THEN** `premiumExpiresAt` é definido com esse valor (ISO 8601 → Date)

#### Scenario: Cálculo de expiração via `subscription_period`
- **WHEN** `data.subscription.next_payment` está ausente mas `data.subscription_period === "monthly"`
- **THEN** `premiumExpiresAt` é hoje + 1 mês

#### Scenario: Cálculo de expiração padrão
- **WHEN** nem `next_payment` nem `subscription_period` estão presentes
- **THEN** `premiumExpiresAt` é hoje + 12 meses

---

### Requirement: Processar eventos de remoção de premium
O sistema SHALL, ao receber `refund`, `chargeback` ou `subscription_canceled`, remover o acesso PREMIUM do usuário.

#### Scenario: Usuário tem PREMIUM
- **WHEN** `refund` (ou `chargeback` ou `subscription_canceled`) chega para email de usuário PREMIUM
- **THEN** `subscriptionTier` é atualizado para `FREE` e `premiumExpiresAt` é anulado

#### Scenario: Usuário não encontrado
- **WHEN** o evento de remoção chega com email que não existe no banco
- **THEN** o evento é registrado como `DONE` sem erro (idempotência)

---

### Requirement: Processar evento `subscription_renewed`
O sistema SHALL, ao receber `subscription_renewed`, atualizar `premiumExpiresAt` e confirmar `subscriptionTier: PREMIUM`.

#### Scenario: Renovação bem-sucedida
- **WHEN** `subscription_renewed` chega para usuário PREMIUM existente
- **THEN** `premiumExpiresAt` é atualizado com a nova data de expiração e `subscriptionTier` permanece `PREMIUM`

#### Scenario: Evento `subscription_renewal_refused`
- **WHEN** `subscription_renewal_refused` chega
- **THEN** o evento é registrado na fila como `DONE` sem modificar o usuário (apenas log)
