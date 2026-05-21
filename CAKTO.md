# Integração Cakto — Documentação Técnica

Guia técnico completo da integração com a plataforma de pagamentos [Cakto](https://cakto.com.br), descrevendo o fluxo de compra, processamento de webhooks, modelos de dados e como replicar em outro projeto.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack e Dependências](#2-stack-e-dependências)
3. [Variáveis de Ambiente](#3-variáveis-de-ambiente)
4. [Modelos de Dados (Prisma)](#4-modelos-de-dados-prisma)
5. [Webhook Principal](#5-webhook-principal)
6. [Eventos Processados](#6-eventos-processados)
7. [Fluxo Detalhado: `purchase_approved`](#7-fluxo-detalhado-purchase_approved)
8. [Fluxo Detalhado: `subscription_renewed`](#8-fluxo-detalhado-subscription_renewed)
9. [Fluxo Detalhado: Remoção de Premium](#9-fluxo-detalhado-remoção-de-premium)
10. [Rota de Teste](#10-rota-de-teste)
11. [Frontend: Captura de Lead e Redirecionamento](#11-frontend-captura-de-lead-e-redirecionamento)
12. [Fila de Webhooks (KiwifyWebhookQueue)](#12-fila-de-webhooks-kiwifywebhookqueue)
13. [Tratamento de Erros](#13-tratamento-de-erros)
14. [Configuração no Painel Cakto](#14-configuração-no-painel-cakto)
15. [Fluxo Completo do Usuário](#15-fluxo-completo-do-usuário)
16. [Guia para Replicar em Outro Projeto](#16-guia-para-replicar-em-outro-projeto)

---

## 1. Visão Geral

A Cakto é a plataforma de checkout e gestão de assinaturas. Quando um usuário conclui a compra na Cakto, ela dispara um **webhook HTTP POST** para o endpoint configurado. O sistema recebe esse webhook, cria (ou atualiza) o usuário no banco e no Supabase Auth, marca o usuário como premium e envia um magic link de acesso.

```
Usuário → Cakto (checkout) → Webhook POST → /api/webhooks/cakto → Prisma/Supabase → Magic Link
```

---

## 2. Stack e Dependências

| Tecnologia | Uso |
|-----------|-----|
| Next.js 14 (App Router) | API Routes (`route.ts`) |
| TypeScript | Tipagem |
| Prisma ORM | Banco de dados (PostgreSQL) |
| Supabase Auth | Autenticação de usuários |
| PostgreSQL | Persistência |

Não há SDK da Cakto. A integração é feita **puramente via HTTP** (webhook recebido + redirect para URL de checkout).

---

## 3. Variáveis de Ambiente

```bash
# Cakto
CAKTO_WEBHOOK_SECRET=seu_secret_aqui          # Validação de autenticidade do webhook
NEXT_PUBLIC_CAKTO_PRODUCT_URL=https://pay.cakto.com.br/XXXXXXX  # URL do checkout

# Supabase (obrigatório para criar usuários)
NEXT_PUBLIC_SUPABASE_URL=https://SEU_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...       # Service role — necessário para admin API

# Database
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...

# App
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
APP_URL=https://seu-dominio.com

# Desenvolvimento
NODE_ENV=development
ALLOW_TEST_WEBHOOK=true                       # Habilita /api/webhooks/cakto/test
```

**Observações:**
- Se `CAKTO_WEBHOOK_SECRET` não estiver configurado, a validação do secret é **ignorada** (com warning no log). Em produção isso não deve ocorrer.
- A variável `SUPABASE_SERVICE_ROLE_KEY` é obrigatória para criar e listar usuários via Admin API.

---

## 4. Modelos de Dados (Prisma)

### 4.1 User

```prisma
model User {
  id           String    @id @default(uuid())
  authUserId   String    @unique   // ID do usuário no Supabase Auth
  name         String
  email        String?   @unique
  avatarUrl    String?
  isPremium    Boolean   @default(false)  // true = assinatura ativa
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  slug         String?   @unique
  lastAccessAt DateTime?
  subscription Subscription?
  // ... outras relações
}
```

### 4.2 Subscription

```prisma
model Subscription {
  id               String    @id @default(uuid())
  userId           String    @unique
  kiwifyId         String?   @unique   // Reutilizado: armazena subscription.id da Cakto
  kiwifyOrderId    String?   @unique   // Reutilizado: armazena order ID da Cakto
  status           String              // "active" | "canceled"
  currentPeriodEnd DateTime?           // Próxima cobrança / data de expiração
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([kiwifyId])
  @@index([status])
  @@index([status, currentPeriodEnd])
}
```

> **Nota histórica:** os campos `kiwifyId` e `kiwifyOrderId` foram herdados de uma integração anterior com a Kiwify. Na integração atual com a Cakto, eles armazenam `data.subscription.id` e `data.id` (order ID) respectivamente. Em um projeto novo, renomeie para `caktoSubscriptionId` e `caktoOrderId`.

### 4.3 Lead

```prisma
model Lead {
  id             String    @id @default(uuid())
  email          String    @unique
  name           String?
  source         String?
  checkoutStarted Boolean  @default(false)
  converted      Boolean   @default(false)
  convertedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  bannerClickId  String?   @unique
  conversionEvents ConversionEvent[]
  // ...relações de banner
}
```

### 4.4 KiwifyWebhookQueue (fila de processamento)

```prisma
model KiwifyWebhookQueue {
  id               String    @id @default(uuid())
  webhookEventType String              // ex: "purchase_approved"
  orderId          String?             // data.id do payload
  customerEmail    String?
  payload          Json                // Payload completo do webhook
  status           String    @default("pending")  // pending|processing|completed|error
  errorMessage     String?
  processedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([status])
  @@index([status, createdAt])
  @@index([webhookEventType])
  @@index([orderId])
  @@index([customerEmail])
  @@index([createdAt])
}
```

> Em um projeto novo, chame esse modelo de `WebhookQueue` ou `CaktoWebhookQueue`.

---

## 5. Webhook Principal

**Arquivo:** `src/app/api/webhooks/cakto/route.ts`

**Endpoint:** `POST /api/webhooks/cakto`

### Estrutura do Payload Recebido da Cakto

```typescript
{
  event: string,            // Tipo do evento
  secret: string,           // Secret para validação
  data: {
    id: string,             // Order ID / Transaction ID
    status: string,         // "paid" | "pending" | outros
    customer: {
      email: string,
      name: string
    },
    subscription?: {
      id: string,           // ID da subscription na Cakto
      next_payment: string  // ISO 8601 — data do próximo pagamento
    },
    subscription_period?: "weekly" | "monthly" | "yearly"
  }
}
```

### Validação do Secret

```typescript
function validateCaktoSecret(bodySecret: string | null, envSecret: string): boolean {
  if (!bodySecret || !envSecret) return false;
  return bodySecret === envSecret;  // Comparação simples de string
}
```

A Cakto envia o campo `secret` diretamente no body JSON (não como header). A comparação é feita contra `process.env.CAKTO_WEBHOOK_SECRET`.

### Eventos Reconhecidos

```typescript
const PROCESSED_EVENTS = [
  'purchase_approved',
  'refund',
  'chargeback',
  'subscription_canceled',
  'subscription_renewed',
  'subscription_renewal_refused',
];
```

Qualquer outro evento (ex: `checkout_abandonment`) é recebido com status 200 mas **não é processado**.

### Lógica de Despacho (route.ts resumido)

```typescript
export async function POST(request: NextRequest) {
  // 1. Parse JSON
  const body = JSON.parse(await request.text());

  // 2. Validar secret (exceto em modo dev/test)
  if (!isTestMode) {
    if (!validateCaktoSecret(body.secret, process.env.CAKTO_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Secret inválido' }, { status: 401 });
    }
  }

  // 3. Filtrar eventos não processados
  if (!shouldProcessEvent(body.event)) {
    return NextResponse.json({ success: true, message: 'Evento não processado' });
  }

  // 4. Registrar na fila com status "pending" → "processing"
  const queueItem = await prisma.kiwifyWebhookQueue.create({ ... });
  await prisma.kiwifyWebhookQueue.update({ status: 'processing' });

  // 5. Despachar por tipo de evento
  try {
    switch (body.event) {
      case 'purchase_approved': ...
      case 'refund':
      case 'chargeback':
      case 'subscription_canceled': await removePremiumFromUser(email);
      case 'subscription_renewed': ...
      case 'subscription_renewal_refused': // log only
    }
    // 6. Marcar como "completed"
    await prisma.kiwifyWebhookQueue.update({ status: 'completed', processedAt: new Date() });
  } catch (err) {
    // 7. Marcar como "error"
    await prisma.kiwifyWebhookQueue.update({ status: 'error', errorMessage: err.message });
    throw err;
  }
}
```

---

## 6. Eventos Processados

| Evento | Ação |
|--------|------|
| `purchase_approved` | Cria/atualiza usuário + subscription + envia magic link |
| `refund` | Remove premium (`status: canceled`, `isPremium: false`) |
| `chargeback` | Remove premium (mesmo que refund) |
| `subscription_canceled` | Remove premium (mesmo que refund) |
| `subscription_renewed` | Atualiza `currentPeriodEnd` + confirma `isPremium: true` |
| `subscription_renewal_refused` | Log apenas, sem ação |
| Qualquer outro | Retorna 200 sem processar |

---

## 7. Fluxo Detalhado: `purchase_approved`

Executa apenas quando `data.status === 'paid'`.

```
purchase_approved + status=paid
│
├── 1. Verificar/criar Lead
│      └── Se lead.converted === false → marcar converted=true + convertedAt
│
├── 2. Buscar usuário no Prisma (por email)
│
├── 3. Sincronizar com Supabase Auth
│      ├── Buscar por email via admin.listUsers()
│      ├── Se não existe → admin.createUser({ email, password: random, email_confirm: true })
│      └── Se authUserId diverge → reconciliar referência no Prisma
│
├── 4. Criar usuário no Prisma (se não existe)
│      ├── avatarUrl = generateAvatarUrlWithFallback(email, name)
│      ├── name = name da Cakto || generateInvestorName(email)
│      └── generateSlugAfterUserCreation(user.id)
│
├── 5. Calcular data de expiração
│      ├── Prioridade 1: data.subscription.next_payment (ISO 8601)
│      ├── Prioridade 2: data.subscription_period
│      │    ├── "weekly"  → +7 dias
│      │    ├── "monthly" → +1 mês
│      │    └── "yearly"  → +1 ano
│      └── Padrão: +12 meses
│
├── 6. Upsert Subscription
│      └── status: "active", currentPeriodEnd: calculado, kiwifyId/OrderId = IDs da Cakto
│
├── 7. Atualizar User.isPremium = true
│
├── 8. Rastrear conversão (se lead tem bannerClick)
│      ├── Criar FeedBannerConversion (se ainda não existe)
│      └── Atualizar ConversionEvent (clickedAt != null AND convertedAt == null)
│
└── 9. Enviar magic link (Supabase signInWithOtp)
       ├── Apenas para emails válidos (regex + não é @example.com, @test.com etc)
       └── Redirect URL: ${APP_URL}/auth/callback
```

### Código da criação de usuário no Supabase

```typescript
const randomPassword =
  Math.random().toString(36).slice(-12) +
  Math.random().toString(36).slice(-12) +
  'A1!';

const { data: newUser } = await supabase.auth.admin.createUser({
  email: emailLower,
  email_confirm: true,
  password: randomPassword,
  user_metadata: { name: userName },
});
```

### Código do upsert de Subscription

```typescript
const subscription = await prisma.subscription.upsert({
  where: { userId: user.id },
  update: {
    kiwifyId: caktoId?.toString(),        // subscription.id da Cakto
    kiwifyOrderId: caktoOrderId?.toString(), // order ID da Cakto
    status: 'active',
    currentPeriodEnd: expirationDate,
    updatedAt: new Date(),
  },
  create: {
    userId: user.id,
    kiwifyId: caktoId?.toString(),
    kiwifyOrderId: caktoOrderId?.toString(),
    status: 'active',
    currentPeriodEnd: expirationDate,
  },
});
```

### Código do magic link

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: emailLower,
  options: { emailRedirectTo: `${appUrl}/auth/callback` },
});
```

---

## 8. Fluxo Detalhado: `subscription_renewed`

```typescript
// Busca usuário pelo email do customer
const user = await prisma.user.findUnique({
  where: { email: emailLower },
  include: { subscription: true },
});

if (user && user.subscription) {
  // Mesma lógica de cálculo de expiração:
  // Prioridade: subscription.next_payment → subscription_period → +1 mês (padrão)
  
  await prisma.subscription.update({
    where: { id: user.subscription.id },
    data: { status: 'active', currentPeriodEnd: expirationDate },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { isPremium: true },
  });
}
```

---

## 9. Fluxo Detalhado: Remoção de Premium

Usado para `refund`, `chargeback` e `subscription_canceled`.

```typescript
async function removePremiumFromUser(email: string) {
  const emailLower = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: emailLower },
    include: { subscription: true },
  });

  if (user) {
    if (user.subscription) {
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { status: 'canceled', updatedAt: new Date() },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isPremium: false },
    });

    return true;
  }

  return false;
}
```

---

## 10. Rota de Teste

**Arquivo:** `src/app/api/webhooks/cakto/test/route.ts`

**Endpoint:** `POST /api/webhooks/cakto/test`

Disponível apenas quando `NODE_ENV === 'development'` e `ALLOW_TEST_WEBHOOK === 'true'`.

Simula internamente o fluxo de `purchase_approved` sem precisar receber webhook real.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/cakto/test \
  -H "Content-Type: application/json" \
  -d '{ "email": "teste@gmail.com", "name": "Usuário Teste" }'
```

**Response:**
```json
{
  "success": true,
  "message": "Usuário de teste criado com sucesso",
  "user": {
    "id": "uuid",
    "email": "teste@gmail.com",
    "name": "Usuário Teste",
    "isPremium": true,
    "authUserId": "uuid"
  },
  "subscription": {
    "id": "uuid",
    "status": "active"
  },
  "magicLinkSent": true
}
```

---

## 11. Frontend: Captura de Lead e Redirecionamento

### Função de redirecionamento para checkout

**Arquivo:** `src/lib/utils/checkout.ts`

```typescript
export function redirectToCheckout(email?: string, source?: string) {
  const checkoutUrl = process.env.NEXT_PUBLIC_CAKTO_PRODUCT_URL;

  if (!checkoutUrl) {
    // Fallback para checkout fake (apenas dev)
    window.location.href = `/checkout/fake?email=${email}&source=${source}`;
    return;
  }

  const url = new URL(checkoutUrl);
  if (email) url.searchParams.set('email', email);
  if (source) url.searchParams.set('source', source);

  window.location.href = url.toString();
}
```

O email pré-preenche o formulário do checkout na Cakto. O usuário é alertado para **usar o mesmo email** que usou no app.

### API de Leads

**Endpoint:** `POST /api/leads`

**Body:**
```typescript
{
  email: string,
  name?: string,
  source?: string,
  bannerClickId?: string
}
```

**Response:**
```typescript
{
  success: true,
  lead: Lead,
  userExists: boolean,
  isPremium: boolean,
  action: 'send_magic_link' | 'redirect_checkout',
  message: string
}
```

O frontend usa essa API para decidir:
- Se o usuário já é premium → enviar magic link
- Se é novo lead → redirecionar para checkout Cakto

### Componente LeadCaptureModal

**Arquivo:** `src/components/checkout/LeadCaptureModal.tsx`

1. Coleta email e nome
2. Chama `POST /api/leads`
3. Conforme `action` retornado:
   - `send_magic_link` → informa que um link foi enviado
   - `redirect_checkout` → chama `redirectToCheckout(email, source)`

---

## 12. Fila de Webhooks (KiwifyWebhookQueue)

Todo webhook recebido é **persistido no banco antes de ser processado**. Isso garante:
- Rastreabilidade de todos os eventos recebidos
- Possibilidade de reprocessar em caso de erro
- Timeout da Cakto (5 segundos) não afeta o processamento

**Ciclo de vida:**
```
CRIADO com status="pending"
     ↓
status="processing"  (antes de executar a lógica de negócio)
     ↓
status="completed"   (sucesso)
     ou
status="error"       (exceção capturada — errorMessage preenchido)
```

**Campos importantes:**
- `payload: Json` — guarda o body completo do webhook
- `webhookEventType` — tipo do evento (ex: `purchase_approved`)
- `orderId` — `data.id` do webhook
- `customerEmail` — email do customer para consulta rápida

---

## 13. Tratamento de Erros

| Situação | HTTP Status | Ação |
|----------|-------------|------|
| JSON inválido | 400 | Retorna erro imediatamente |
| Secret inválido | 401 | Retorna erro imediatamente |
| Evento sem tipo (`event: null`) | 200 | Ignora silenciosamente (checkout abandonment) |
| Evento não reconhecido | 200 | Ignora com log |
| `purchase_approved` mas `status !== 'paid'` | 200 | Ignora sem processar |
| Email ausente no payload | 500 | Marca fila como `error` |
| Erro em qualquer etapa | 500 | Marca fila como `error` + errorMessage |
| Erro no Supabase createUser | 500 | Propaga exceção |

**Emails de teste não recebem magic link** (mas o usuário é criado normalmente):
```typescript
const testEmailDomains = ['example.com', 'test.com', 'example.org', 'test.org'];
const isTestEmail = testEmailDomains.some(domain => email.includes(`@${domain}`));
const isValidEmail = emailRegex.test(email) && !isTestEmail;
```

---

## 14. Configuração no Painel Cakto

1. Acessar o produto no painel da Cakto
2. Ir em **Configurações → Webhooks**
3. Adicionar URL: `https://seu-dominio.com/api/webhooks/cakto`
4. Configurar o **secret** (mesmo valor de `CAKTO_WEBHOOK_SECRET` no `.env`)
5. Selecionar eventos:
   - `purchase_approved`
   - `refund`
   - `chargeback`
   - `subscription_canceled`
   - `subscription_renewed`
   - `subscription_renewal_refused`

**Timeout:** A Cakto aguarda resposta por até **5 segundos**. O sistema responde rapidamente (salva na fila e retorna; não espera o processamento completo em casos lentos).

---

## 15. Fluxo Completo do Usuário

```
1. Usuário clica em "Upgrade para Pro"
         ↓
2. LeadCaptureModal coleta email + nome
         ↓
3. POST /api/leads
   ├── Se já é premium → envia magic link → FIM
   └── Se não → continua
         ↓
4. redirectToCheckout(email, source)
   → window.location.href = https://pay.cakto.com.br/XXXXXXX?email=user@email.com
         ↓
5. Usuário preenche dados de pagamento na Cakto
   ⚠️  IMPORTANTE: deve usar o MESMO email
         ↓
6. Cakto processa pagamento
         ↓
7. Cakto dispara webhook:
   POST https://dominio.com/api/webhooks/cakto
   { event: "purchase_approved", secret: "...", data: { status: "paid", customer: { email, name }, ... } }
         ↓
8. Sistema:
   a. Valida secret
   b. Salva na fila (pending → processing)
   c. Cria/sincroniza usuário (Prisma + Supabase Auth)
   d. Cria subscription (status: active, currentPeriodEnd: calculado)
   e. User.isPremium = true
   f. Rastreia conversão
   g. Envia magic link via Supabase
   h. Marca fila como completed
         ↓
9. Usuário recebe email com magic link
         ↓
10. Clica no link → autenticado no app com conta Pro
```

---

## 16. Guia para Replicar em Outro Projeto

### Passo 1 — Schema Prisma

Adicione ao `schema.prisma`:

```prisma
model Subscription {
  id                  String    @id @default(uuid())
  userId              String    @unique
  caktoSubscriptionId String?   @unique
  caktoOrderId        String?   @unique
  status              String    @default("active")  // "active" | "canceled"
  currentPeriodEnd    DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([status, currentPeriodEnd])
}

model WebhookQueue {
  id               String    @id @default(uuid())
  webhookEventType String
  orderId          String?
  customerEmail    String?
  payload          Json
  status           String    @default("pending")
  errorMessage     String?
  processedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([status])
  @@index([webhookEventType])
  @@index([customerEmail])
  @@index([createdAt])
}
```

Adicione `isPremium Boolean @default(false)` e `subscription Subscription?` ao modelo `User`.

### Passo 2 — Variáveis de Ambiente

```bash
CAKTO_WEBHOOK_SECRET=gere_um_secret_forte
NEXT_PUBLIC_CAKTO_PRODUCT_URL=https://pay.cakto.com.br/SEU_ID
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=https://seu-dominio.com
```

### Passo 3 — Endpoint do Webhook

Crie `src/app/api/webhooks/cakto/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PROCESSED_EVENTS = [
  'purchase_approved', 'refund', 'chargeback',
  'subscription_canceled', 'subscription_renewed', 'subscription_renewal_refused',
];

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validar secret
  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  if (secret && body.secret !== secret) {
    return NextResponse.json({ error: 'Secret inválido' }, { status: 401 });
  }

  const event = body.event as string;
  const data = body.data || {};

  if (!PROCESSED_EVENTS.includes(event)) {
    return NextResponse.json({ success: true, message: 'Evento ignorado' });
  }

  // Registrar na fila
  const queueItem = await prisma.webhookQueue.create({
    data: {
      webhookEventType: event,
      orderId: data.id,
      customerEmail: data.customer?.email,
      payload: body,
      status: 'processing',
    },
  });

  try {
    if (event === 'purchase_approved' && data.status === 'paid') {
      await handlePurchaseApproved(data);
    } else if (['refund', 'chargeback', 'subscription_canceled'].includes(event)) {
      await removePremium(data.customer?.email);
    } else if (event === 'subscription_renewed') {
      await handleRenewal(data);
    }

    await prisma.webhookQueue.update({
      where: { id: queueItem.id },
      data: { status: 'completed', processedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    await prisma.webhookQueue.update({
      where: { id: queueItem.id },
      data: {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Erro desconhecido',
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
  }
}

async function handlePurchaseApproved(data: any) {
  const email = data.customer.email.toLowerCase().trim();
  const name = data.customer.name;
  const supabase = createServerClient(true);

  // Criar/buscar usuário no Supabase Auth
  const { data: users } = await supabase.auth.admin.listUsers();
  let authUser = users?.users?.find(u => u.email === email);

  if (!authUser) {
    const randomPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const { data: created } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomPassword,
      user_metadata: { name },
    });
    authUser = created.user;
  }

  // Criar/buscar usuário no Prisma
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { authUserId: authUser!.id, email, name: name || email, isPremium: false },
    });
  }

  // Calcular expiração
  const expirationDate = calcExpiration(data);

  // Upsert subscription
  const sub = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      caktoSubscriptionId: data.subscription?.id,
      caktoOrderId: data.id,
      status: 'active',
      currentPeriodEnd: expirationDate,
    },
    create: {
      userId: user.id,
      caktoSubscriptionId: data.subscription?.id,
      caktoOrderId: data.id,
      status: 'active',
      currentPeriodEnd: expirationDate,
    },
  });

  // Marcar premium
  await prisma.user.update({
    where: { id: user.id },
    data: { isPremium: sub.status === 'active' },
  });

  // Enviar magic link
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const testDomains = ['example.com', 'test.com'];
  if (emailRegex.test(email) && !testDomains.some(d => email.endsWith(`@${d}`))) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });
  }
}

async function removePremium(email: string) {
  const emailLower = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: emailLower },
    include: { subscription: true },
  });
  if (!user) return;

  if (user.subscription) {
    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: { status: 'canceled' },
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { isPremium: false } });
}

async function handleRenewal(data: any) {
  const email = data.customer.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true },
  });
  if (!user?.subscription) return;

  const expirationDate = calcExpiration(data);
  await prisma.subscription.update({
    where: { id: user.subscription.id },
    data: { status: 'active', currentPeriodEnd: expirationDate },
  });
  await prisma.user.update({ where: { id: user.id }, data: { isPremium: true } });
}

function calcExpiration(data: any): Date {
  if (data.subscription?.next_payment) {
    return new Date(data.subscription.next_payment);
  }
  const date = new Date();
  const period = data.subscription_period;
  if (period === 'weekly') date.setDate(date.getDate() + 7);
  else if (period === 'monthly') date.setMonth(date.getMonth() + 1);
  else if (period === 'yearly') date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 12);
  return date;
}
```

### Passo 4 — Função de Redirecionamento (frontend)

```typescript
// src/lib/checkout.ts
export function redirectToCheckout(email?: string) {
  const url = new URL(process.env.NEXT_PUBLIC_CAKTO_PRODUCT_URL!);
  if (email) url.searchParams.set('email', email);
  window.location.href = url.toString();
}
```

### Passo 5 — Configuração no Painel Cakto

1. Acesse o produto na Cakto
2. Vá em **Configurações → Webhooks**
3. URL: `https://seu-dominio.com/api/webhooks/cakto`
4. Secret: mesmo valor de `CAKTO_WEBHOOK_SECRET`
5. Ative os eventos listados na [seção 6](#6-eventos-processados)

### Passo 6 — Roda migrations e testa

```bash
npx prisma migrate dev
# Simule um webhook localmente:
curl -X POST http://localhost:3000/api/webhooks/cakto \
  -H "Content-Type: application/json" \
  -d '{
    "event": "purchase_approved",
    "secret": "SEU_SECRET",
    "data": {
      "id": "ORDER_TEST_001",
      "status": "paid",
      "customer": { "email": "user@gmail.com", "name": "Teste" },
      "subscription": { "id": "SUB_001", "next_payment": "2026-06-20T00:00:00Z" }
    }
  }'
```

---

## Pontos Críticos

- **Email consistente:** o email usado no checkout Cakto deve ser o mesmo do sistema. A UI avisa o usuário.
- **Service Role Key:** o Supabase `admin.createUser` e `admin.listUsers` exigem a service role key — nunca exponha ela no frontend.
- **Secret obrigatório em produção:** sem `CAKTO_WEBHOOK_SECRET`, qualquer pessoa pode disparar webhooks falsos.
- **Timeout de 5 segundos:** a Cakto espera resposta em até 5s. Salve na fila e responda rápido; processe em background se necessário.
- **Idempotência:** o `subscription.upsert` garante que um segundo webhook do mesmo pedido não duplica dados.
- **Campos renomeados:** em produção nova, prefira `caktoSubscriptionId`/`caktoOrderId` em vez de `kiwifyId`/`kiwifyOrderId`.
