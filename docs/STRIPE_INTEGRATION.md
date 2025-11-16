# Integração Stripe - Preço Justo AI

Este documento descreve como configurar e usar a integração completa com Stripe para pagamentos de assinatura.

## 🚀 Recursos Implementados

- ✅ Checkout transparente com PIX e Cartão
- ✅ Assinaturas recorrentes (mensal e anual)
- ✅ Webhooks para ativação automática
- ✅ Portal do cliente para gerenciar assinatura
- ✅ Atualização automática do status premium
- ✅ Páginas de sucesso e cancelamento
- ✅ Componente de gerenciamento de assinatura

## 📋 Pré-requisitos

1. Conta no Stripe (https://stripe.com)
2. Produtos e preços criados no Stripe Dashboard
3. Webhook endpoint configurado

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key_here"
STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Stripe Product IDs (created in Stripe Dashboard)
STRIPE_PREMIUM_MONTHLY_PRICE_ID="price_your_monthly_price_id"
STRIPE_PREMIUM_ANNUAL_PRICE_ID="price_your_annual_price_id"

# Stripe Public Keys (for client-side)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key_here"
NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID="price_your_monthly_price_id"
NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID="price_your_annual_price_id"
```

### 2. Criar Produtos no Stripe

1. Acesse o Stripe Dashboard
2. Vá para **Products** > **Add Product**
3. Crie dois produtos:

#### Premium Mensal
- Nome: "Premium Mensal"
- Preço: R$ 19,90
- Cobrança: Recorrente, mensal
- Moeda: BRL

#### Premium Anual
- Nome: "Premium Anual"  
- Preço: R$ 189,90
- Cobrança: Recorrente, anual
- Moeda: BRL

4. Copie os Price IDs e adicione às variáveis de ambiente

### 3. Configurar Webhook

1. No Stripe Dashboard, vá para **Developers** > **Webhooks**
2. Clique em **Add endpoint**
3. URL: `https://seu-dominio.com/api/webhooks/stripe`
4. Eventos para escutar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Copie o webhook secret e adicione à variável `STRIPE_WEBHOOK_SECRET`

### 4. Migração do Banco de Dados

Execute a migração para adicionar os campos do Stripe:

```bash
npx prisma migrate dev --name add_stripe_fields
```

## 🔄 Fluxo de Pagamento

### 1. Seleção do Plano
- Usuário acessa `/planos` ou landing page
- Clica em "Começar Premium" (mensal) ou "Economizar 12%" (anual)
- Redirecionado para `/checkout?plan=monthly` ou `/checkout?plan=annual`

### 2. Checkout
- Página de checkout mostra resumo do plano
- Usuário escolhe método: PIX ou Cartão
- Clica em "Finalizar Pagamento"
- Redirecionado para Stripe Checkout

### 3. Pagamento
- **PIX**: QR Code ou código para copiar
- **Cartão**: Formulário interativo seguro
- Processamento em tempo real

### 4. Confirmação
- **Sucesso**: Redirecionado para `/checkout/success`
- **Cancelamento**: Redirecionado para `/checkout/cancel`
- Webhook ativa conta automaticamente

## 🔧 APIs Implementadas

### `/api/checkout/create-session`
Cria sessão de checkout do Stripe
- **Método**: POST
- **Body**: `{ priceId: string }`
- **Retorna**: `{ sessionId: string, url: string }`

### `/api/webhooks/stripe`
Processa eventos do Stripe
- **Método**: POST
- **Headers**: `stripe-signature`
- **Eventos**: checkout, subscription, invoice

### `/api/subscription/status`
Verifica status da assinatura
- **Método**: GET
- **Retorna**: Status atualizado da assinatura

### `/api/subscription/portal`
Cria sessão do portal do cliente
- **Método**: POST
- **Body**: `{ returnUrl: string }`
- **Retorna**: `{ url: string }`

## 🎨 Componentes

### `<CheckoutForm>`
Formulário de checkout com seleção de método de pagamento

### `<SubscriptionManager>`
Componente para gerenciar assinatura no dashboard
- Mostra status atual
- Botão para portal do cliente
- Informações de renovação/cancelamento

## 🔐 Segurança

- ✅ Verificação de assinatura do webhook
- ✅ Validação de usuário autenticado
- ✅ Processamento seguro via Stripe
- ✅ Dados sensíveis apenas no servidor

## 📱 Métodos de Pagamento

### PIX
- Pagamento instantâneo
- QR Code ou código para copiar
- Sem taxas adicionais
- Ativação imediata

### Cartão de Crédito/Débito
- Formulário interativo seguro
- Suporte a Visa, Mastercard, Elo
- Processamento em tempo real
- Cobrança recorrente automática

## 🔄 Gerenciamento de Assinatura

Os usuários podem:
- Ver status da assinatura
- Atualizar método de pagamento
- Cancelar assinatura
- Baixar faturas
- Ver histórico de pagamentos

Acesso via portal do cliente do Stripe.

## 🚨 Tratamento de Erros

### Pagamento Falhado
- Webhook `invoice.payment_failed`
- Usuário mantém acesso até fim do período
- Notificação por email (configurar no Stripe)

### Assinatura Cancelada
- Webhook `customer.subscription.deleted`
- Downgrade para plano gratuito
- Dados preservados

### Webhook Falhado
- Retry automático pelo Stripe
- Logs detalhados no console
- Fallback para sincronização manual

## 🧪 Testes

### Cartões de Teste
```
Sucesso: 4242 4242 4242 4242
Falha: 4000 0000 0000 0002
3D Secure: 4000 0000 0000 3220
```

### PIX de Teste
- Use ambiente de teste do Stripe
- PIX será simulado automaticamente

## 📊 Monitoramento

### Métricas Importantes
- Taxa de conversão checkout
- Churn rate mensal/anual
- Revenue por usuário
- Falhas de pagamento

### Logs
- Eventos de webhook
- Erros de pagamento
- Ativações/cancelamentos

## 🔧 Manutenção

### Sincronização Manual
```typescript
import { syncUserSubscription } from '@/lib/subscription-service'
await syncUserSubscription(userId)
```

### Atualizar Assinaturas Expiradas
```typescript
import { updateExpiredSubscriptions } from '@/lib/subscription-service'
await updateExpiredSubscriptions()
```

### Portal do Cliente
```typescript
import { createCustomerPortal } from '@/lib/subscription-service'
const url = await createCustomerPortal(userId, returnUrl)
```

## 🚀 Deploy

1. Configure variáveis de ambiente na Vercel/produção
2. Atualize webhook URL para produção
3. Execute migrações do banco
4. Teste fluxo completo

## 📞 Suporte

Para dúvidas sobre a integração:
1. Verifique logs do Stripe Dashboard
2. Consulte documentação do Stripe
3. Teste em ambiente de desenvolvimento primeiro

---

**Nota**: Esta integração está pronta para produção e segue as melhores práticas de segurança do Stripe.
