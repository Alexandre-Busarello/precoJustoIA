# Especificação Técnica: Sistema de Afiliados e Gestão de Pedidos

**Autor:** Arquiteto de Software & UX/UI  
**Data:** 11/12/2025  
**Contexto:** Aplicação Next.js (SSR/Client), Prisma ORM, PostgreSQL.  
**Integrações:** Stripe (Assinaturas), Mercado Pago (Pix).

---

## 1. Visão Geral

O objetivo é implementar um sistema de afiliação robusto que permita o rastreamento de leads e vendas, além de criar uma camada de persistência de "Pedidos" (*Orders*) interna, independente dos gateways de pagamento. Isso garantirá histórico de tentativas de compra, gestão de expiração de Pix, atribuição correta de comissões e gestão de saques.

### Premissas Principais

* **Centralização de Pedidos:** Toda intenção de compra gera um registro local.
* **Checkout Dinâmico:** O preço exibido depende da origem do usuário (Orgânico, Afiliado ou Promoção Relâmpago da Plataforma).
* **Ciclo Financeiro Completo:** Do rastreamento da venda até o pedido de saque e pagamento da comissão.

---

## 2. Arquitetura de Dados (Prisma Schema)

Todas as novas tabelas seguem o prefixo obrigatório `affiliate_`. A estrutura foi pensada para suportar a lógica de Price IDs fixos do Stripe e valores em centavos para o Pix.

    // --- SCHEMA EXTENSIONS ---

    // Tabela de Perfil do Afiliado
    model AffiliatePartner {
      id              String   @id @default(cuid())
      userId          String   @unique @map("user_id") // Vínculo com a tabela User existente
      slug            String   @unique // Ex: "influenciador-x" para URLs amigáveis
      code            String   @unique // Ex: "INFLUX" para cupons manuais
      isActive        Boolean  @default(true) @map("is_active")
      
      // Configuração Financeira
      commissionRate Decimal  @default(10.0) @map("commission_rate") // Porcentagem padrão
      pixKey         String?  @map("pix_key") // Para pagamento das comissões
      minimumPayout  Int      @default(5000) @map("minimum_payout") // Valor mínimo em centavos para saque (Ex: R$ 50,00)
      
      // Compliance / Termos de Uso
      termsAcceptedAt DateTime? @map("terms_accepted_at") // Data de aceite dos termos do programa de afiliados
      termsVersion    String?   @map("terms_version") // Versão dos termos aceitos (ex: "v1.0")

      // Metadados
      createdAt       DateTime @default(now()) @map("created_at")
      updatedAt       DateTime @updatedAt @map("updated_at")

      // Relações
      user            User               @relation(fields: [userId], references: [id])
      leads           AffiliateLead[]    // Usuários capturados por este afiliado
      orders          AffiliateOrder[]   // Pedidos gerados
      customPricing   AffiliatePricingRule[] // Preços específicos deste afiliado
      payouts         AffiliatePayout[] // Histórico de saques

      @@map("affiliate_partners")
    }

    // Tabela de Rastreamento de Leads (Vínculo Usuário <-> Afiliado)
    model AffiliateLead {
      id                  String   @id @default(cuid())
      affiliateId         String   @map("affiliate_id")
      userId              String   @unique @map("user_id") // O Lead
      
      attributionSource   String?  @map("attribution_source") // Ex: "link_bio_instagram"
      attributedAt        DateTime @default(now()) @map("attributed_at")
      expiresAt           DateTime? @map("expires_at") // Caso a afiliação tenha validade (cookies de 30/60 dias)

      affiliate           AffiliatePartner @relation(fields: [affiliateId], references: [id])
      user                User             @relation(fields: [userId], references: [id])

      @@map("affiliate_leads")
    }

    // Tabela de Regras de Preço (Mapping de Preços Fixos Stripe/Pix)
    // Serve para definir: "O Afiliado X vende o Plano ANUAL por tal preço"
    model AffiliatePricingRule {
      id              String   @id @default(cuid())
      affiliateId     String?  @map("affiliate_id") // Se null, pode ser uma regra global ou promo relâmpago
      offerType       OfferType // Enum existente (MONTHLY, ANNUAL)
      
      // Definições de Preço
      stripePriceId   String   @map("stripe_price_id") // ID fixo do preço com desconto no Stripe
      pixAmountCents  Int      @map("pix_amount_cents") // Valor correspondente em centavos para Pix
      
      description     String?  // Ex: "Desconto de 20% Parceiro X"
      isActive        Boolean  @default(true) @map("is_active")

      affiliate       AffiliatePartner? @relation(fields: [affiliateId], references: [id])
      orders          AffiliateOrder[]

      @@map("affiliate_pricing_rules")
    }

    // Tabela Central de Pedidos (A "Source of Truth" interna)
    model AffiliateOrder {
      id              String   @id @default(cuid())
      userId          String   @map("user_id") // Quem está comprando
      affiliateId     String?  @map("affiliate_id") // Quem recebe a comissão (snapshot do momento)
      pricingRuleId   String?  @map("pricing_rule_id") // Qual regra de preço foi usada

      // Valores Financeiros (Snapshot)
      totalAmountCents Int      @map("total_amount_cents")
      commissionAmountCents Int @default(0) @map("commission_amount_cents")
      currency         String   @default("BRL")

      // Status e Pagamento
      status          OrderStatus @default(PENDING)
      paymentProvider WebhookProvider // Enum existente (STRIPE, MERCADOPAGO)
      
      // Identificadores Externos
      externalId      String?  @unique @map("external_id") // ID do PaymentIntent (Stripe) ou ID do Pagamento (MP)
      externalRef     String?  @map("external_ref") // Reference ID (MP) ou Subscription ID (Stripe)
      
      // Datas Relevantes
      expiresAt       DateTime? @map("expires_at") // Crucial para Pix (ex: 30 min)
      paidAt          DateTime? @map("paid_at")
      createdAt       DateTime @default(now()) @map("created_at")
      updatedAt       DateTime @updatedAt @map("updated_at")

      // Relações
      user            User     @relation(fields: [userId], references: [id])
      affiliate       AffiliatePartner? @relation(fields: [affiliateId], references: [id])
      pricingRule     AffiliatePricingRule? @relation(fields: [pricingRuleId], references: [id])

      @@index([userId])
      @@index([affiliateId])
      @@index([status])
      @@index([externalId])
      @@map("affiliate_orders")
    }

    // Tabela de Solicitações de Saque (NOVO)
    model AffiliatePayout {
      id              String        @id @default(cuid())
      affiliateId     String        @map("affiliate_id")
      amountCents     Int           @map("amount_cents")
      status          PayoutStatus  @default(PENDING)
      
      // Dados Bancários (Snapshot do momento do pedido)
      pixKey          String        @map("pix_key")
      
      // Auditoria
      requestedAt     DateTime      @default(now()) @map("requested_at")
      processedAt     DateTime?     @map("processed_at")
      processedBy     String?       @map("processed_by") // ID do Admin que aprovou/pagou
      rejectionReason String?       @map("rejection_reason")
      
      // Comprovante
      receiptUrl      String?       @map("receipt_url") // URL do comprovante de pagamento (Upload)

      affiliate       AffiliatePartner @relation(fields: [affiliateId], references: [id])

      @@index([affiliateId])
      @@index([status])
      @@map("affiliate_payouts")
    }

    enum OrderStatus {
      PENDING
      PAID
      FAILED
      CANCELED
      EXPIRED
      REFUNDED
    }

    enum PayoutStatus {
      PENDING   // Solicitado
      APPROVED  // Aprovado pelo admin (aguardando pagto)
      PAID      // Pago (comprovante anexado)
      REJECTED  // Recusado (motivo preenchido)
    }

---

## 3. Fluxo de UX/UI e Lógica de Negócio

### 3.1. Rastreamento de Origem (Middleware & Onboarding)

Quando um usuário acessa a plataforma via `meusite.com?ref=afiliado_x`:

1.  **Middleware Next.js:** Intercepta o parâmetro `ref`.
2.  **Cookie:** Grava um cookie seguro `affiliate_ref` com validade definida (ex: 30 dias).
3.  **Registro de Lead:**
    * Se o usuário se cadastrar, o backend verifica o cookie.
    * Cria-se um registro em `affiliate_leads` vinculando o novo User ao `AffiliatePartner`.
    * *Nota:* Se o usuário já existe e não tem vínculo, cria-se o vínculo (modelo de atribuição Last-Click para novos leads, imutável para leads antigos).

### 3.2. Lógica do Checkout (`/checkout`)

Esta é a parte crítica onde a colisão de preços é resolvida.

**Algoritmo de Decisão de Preço:**

1.  **Verificação de Oferta da Plataforma (Prioridade Alta):**
    * O endpoint verifica se existe query param na URL (ex: `?offer=black_friday`).
    * Se válido e ativo em `affiliate_pricing_rules` (com `affiliateId: null`), aplica este preço. Ignora o afiliado.
2.  **Verificação de Afiliado (Prioridade Média):**
    * Se NÃO há oferta da plataforma, o sistema verifica se o usuário logado possui registro em `affiliate_leads`.
    * Se sim, busca em `affiliate_pricing_rules` a regra ativa para aquele `affiliateId`.
    * Aplica o `stripePriceId` e `pixAmountCents` definidos para o parceiro.
3.  **Preço Base (Fallback):**
    * Se nenhuma das anteriores, usa o preço padrão da tabela `Offer` (já existente no sistema).

**UX na Tela de Checkout:**

* **Feedback Visual:** Se um cupom de afiliado ou oferta relâmpago estiver ativo, mostrar: *"Oferta especial de [Nome Afiliado/Evento] aplicada: De R$ XX por R$ YY"*.
* **Recuperação:** Se o usuário tentar pagar e falhar, o registro em `affiliate_orders` já existe, permitindo emails de recuperação de carrinho (Abandoned Cart).

---

## 4. Integração de Pagamentos e Webhooks

### 4.1. Fluxo de Criação de Pedido (Server Actions)

**A. Via PIX (Mercado Pago):**
1.  Usuário clica em "Gerar PIX".
2.  Backend cria registro em `affiliate_orders` com status `PENDING` e `expiresAt = now() + 30min`.
3.  Backend chama API do Mercado Pago passando o `order.id` como `external_reference`.
4.  Retorna QR Code para o frontend.
5.  *Cronjob ou Verificação Lazy:* Se o Pix não for pago em 30 min, o status muda para `EXPIRED`.

**B. Via Stripe (Cartão):**
1.  Backend cria Checkout Session no Stripe.
2.  No metadata da sessão, insere `{ internal_order_id: "novo_id_gerado", affiliate_id: "..." }`.
3.  Cria registro em `affiliate_orders` como `PENDING`.
4.  Redireciona usuário para o Stripe ou abre Elementos Embedded.

### 4.2. Processamento de Webhooks

O `webhook_events` existente receberá os eventos, mas precisaremos de um processador específico para atualizar a tabela de pedidos.

Ao receber `payment_intent.succeeded` (Stripe) ou `payment.updated` (MP):
1.  Localiza o `affiliate_orders` correspondente (via `external_id` ou `metadata`).
2.  Atualiza status para `PAID`.
3.  Dispara provisionamento de acesso (liberação do Premium via tabela User).
4.  Calcula comissão baseada na regra snapshotada no pedido e prepara dados para pagamento futuro.

---

## 5. Requisitos de Frontend (Interfaces de Gestão)

### 5.1. Painel do Afiliado (Rota: `/affiliate/dashboard`)

Uma área exclusiva para o parceiro acompanhar seu desempenho.

* **Cards de Resumo (KPIs):**
    * *Clicks Únicos:* Total de visitas via link de afiliado (requer analytics simples ou contador no middleware).
    * *Leads Cadastrados:* Contagem da tabela `AffiliateLead`.
    * *Vendas Realizadas:* Contagem de `AffiliateOrder` com status `PAID`.
    * *Taxa de Conversão:* (Vendas / Leads) %.
    * *Saldo Disponível:* Soma de comissões de vendas PAID (menos saques já feitos).
* **Área de Saque (Wallet):**
    * Botão "Solicitar Saque": Habilitado apenas se Saldo >= `minimumPayout` e `pixKey` estiver preenchida.
    * Modal de confirmação exibindo o valor e a chave Pix de destino.
    * Criação de registro em `AffiliatePayout` com status `PENDING`.
* **Histórico Financeiro:** Tabela listando todas as solicitações de saque (Data, Valor, Status, Link do Comprovante).
* **Gerador de Links:** Input para copiar o link `meusite.com?ref=SEU_CODIGO`.

### 5.2. Backoffice Administrativo (Rota: `/admin/affiliates`)

Visão para o dono da plataforma gerenciar a operação.

* **Listagem de Afiliados:** Tabela com todos os parceiros (`AffiliatePartner`). Ações: Editar taxa de comissão, banir parceiro (`isActive: false`), ver detalhes.
* **Gestão de Saques (Payouts):**
    * *Aba "Pendentes":* Lista solicitações com status `PENDING`.
    * *Ação Aprovar/Pagar:* Admin realiza o PIX manual no banco dele, faz upload do comprovante (ou insere ID da transação) e o sistema muda status para `PAID`.
    * *Ação Rejeitar:* Abre modal para inserir `rejectionReason`. Estorna o saldo (logicamente, pois o saque é cancelado).
* **Auditoria de Vendas:** Visualizar todas as `AffiliateOrders` para conferir se a atribuição está correta antes de liberar pagamentos suspeitos.

---

## 6. Segurança e Compliance

* **Imutabilidade Financeira:** Uma vez que um pedido é `PAID`, os valores de comissão são travados.
* **Trava de Saque:** O sistema deve impedir saques se o saldo for insuficiente (validação backend rigorosa: `TotalCommissions - TotalPayouts >= RequestAmount`).
* **LGPD:** Transparência no uso de dados do afiliado.

---

## 7. Próximos Passos de Implementação

1.  Rodar migração do Prisma com as novas tabelas `affiliate_*` (incluindo payouts).
2.  Implementar Server Actions para `requestPayout` (Afiliado) e `processPayout` (Admin).
3.  Desenvolver as telas de Dashboard usando componentes de gráficos (ex: Recharts) e tabelas (ex: TanStack Table).

---

## 8. Matriz de Cobertura de Requisitos

| Requisito do Cliente | Solução Técnica Adotada | Status |
| :--- | :--- | :---: |
| **Centralização de Pedidos** | Tabela `AffiliateOrder`. | ✅ Coberto |
| **Checkout Dinâmico** | Lógica de prioridade de preços. | ✅ Coberto |
| **Painel do Afiliado** | Dashboard com KPIs e botão de saque. | ✅ Coberto |
| **Gestão de Saques (Admin)** | Tabela `AffiliatePayout` e fluxo de aprovação manual com comprovante. | ✅ Coberto |
| **Pedido de Saque** | Modelo `AffiliatePayout` com status e regra de saldo mínimo. | ✅ Coberto |
| **Compliance (Termos)** | Campo `termsAcceptedAt`. | ✅ Coberto |
| **Expiração de PIX** | Campo `expiresAt` + Cronjob/Lazy Check. | ✅ Coberto |