## MODIFIED Requirements

### Requirement: Registrar fonte de aquisição no cadastro de usuário
O sistema SHALL registrar a fonte de aquisição (`acquisition`) no momento da criação do usuário para rastreamento de origem de conversão. O campo aceita os valores `"kiwify"`, `"cakto"`, `"stripe"`, `"mercadopago"` e outros valores futuros.

#### Scenario: Usuário criado via webhook Cakto
- **WHEN** `purchase_approved` cria um novo usuário
- **THEN** `User.acquisition` é definido como `"cakto"`

#### Scenario: Usuário criado via webhook Kiwify (comportamento existente mantido)
- **WHEN** `order_approved` Kiwify cria um novo usuário
- **THEN** `User.acquisition` permanece `"kiwify"` (sem alteração)

---

### Requirement: Email de boas-vindas para novos assinantes Cakto
O sistema SHALL enfileirar um email do tipo `CAKTO_WELCOME` via `EmailQueueService` para novos usuários criados via webhook Cakto, contendo link de primeiro acesso (password reset token com validade de 7 dias).

#### Scenario: Email enfileirado para novo usuário Cakto
- **WHEN** `purchase_approved` cria um novo usuário
- **THEN** `EmailQueueService.queueEmail` é chamado com `emailType: "CAKTO_WELCOME"`, `priority: 1` e `emailData.resetUrl` com token válido por 7 dias

#### Scenario: Email não enviado para usuário existente já PREMIUM
- **WHEN** `purchase_approved` chega para usuário que já era PREMIUM
- **THEN** `EmailQueueService.queueEmail` NÃO é chamado novamente

#### Scenario: Email enviado para usuário existente que migrou de FREE para PREMIUM
- **WHEN** `purchase_approved` chega para usuário FREE existente
- **THEN** `EmailQueueService.queueEmail` é chamado com `emailType: "CAKTO_WELCOME"`
