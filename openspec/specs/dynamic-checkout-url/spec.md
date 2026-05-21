# Spec: Dynamic Checkout URL

## Purpose
Define the dynamic resolution of checkout URLs from the database, replacing hardcoded environment variables. This enables multi-provider checkout support (Cakto, Stripe, etc.) by storing checkout URLs per offer and exposing them via the pricing offers API.

## Requirements

### Requirement: Resolver URL de checkout a partir da oferta ativa no banco
O sistema SHALL buscar a URL de checkout via `GET /api/v1/pricing/offers` e usar o campo `checkout_url` da oferta ativa relevante (MONTHLY por padrão), preservando os parâmetros UTM e email do usuário logado.

#### Scenario: Oferta ativa com checkout_url disponível
- **WHEN** o componente de CTA renderiza e existe uma oferta ativa com `checkout_url` preenchido
- **THEN** o link de checkout aponta para essa URL com os parâmetros UTM e email da sessão atual appendados

#### Scenario: Fallback para variável de ambiente
- **WHEN** nenhuma oferta ativa tem `checkout_url` preenchido mas `NEXT_PUBLIC_CAKTO_PRODUCT_URL` está definida
- **THEN** o link de checkout usa o valor da variável de ambiente

#### Scenario: Nenhuma URL disponível
- **WHEN** nem oferta no banco nem variável de ambiente têm a URL de checkout
- **THEN** o botão de CTA é desabilitado (ou ocultado)

#### Scenario: Parâmetros UTM preservados
- **WHEN** a página foi acessada com `?utm_source=google&utm_campaign=promo`
- **THEN** a URL de checkout final inclui `utm_source=google&utm_campaign=promo` como query params

#### Scenario: Email do usuário logado pré-preenchido
- **WHEN** há sessão ativa com email do usuário
- **THEN** a URL de checkout inclui `email=<email_do_usuario>` como query param

---

### Requirement: `GET /api/v1/pricing/offers` inclui `checkout_url` na resposta
O sistema SHALL retornar o campo `checkout_url` (string ou null) para cada oferta no endpoint de listagem de ofertas, permitindo que o frontend determine o provedor de checkout sem lógica adicional.

#### Scenario: Oferta Cakto retorna checkout_url
- **WHEN** uma oferta com `checkout_url` definido é retornada por `GET /api/v1/pricing/offers`
- **THEN** a resposta JSON inclui `checkout_url: "https://pay.cakto.com.br/..."` para essa oferta

#### Scenario: Oferta Stripe retorna checkout_url nulo
- **WHEN** uma oferta com `stripe_price_id` e sem `checkout_url` é retornada
- **THEN** a resposta JSON inclui `checkout_url: null` para essa oferta

---

### Requirement: Hook `useCheckoutUrl` retorna URL dinâmica com estado de loading
O sistema SHALL expor `useCheckoutUrl()` que consulta o endpoint de offers no mount e retorna a URL com estado de loading, mantendo compatibilidade de interface com os componentes existentes.

#### Scenario: Loading state
- **WHEN** o hook está consultando a API
- **THEN** retorna `{ url: null, loading: true }`

#### Scenario: URL resolvida
- **WHEN** a API responde com uma oferta com `checkout_url`
- **THEN** retorna `{ url: "https://pay.cakto.com.br/XXXXX?email=...", loading: false }`

---

### Requirement: Componente `CheckoutLink` compatível com usos existentes
O sistema SHALL manter a interface do componente `CheckoutLink` e da função `buildCheckoutUrl` para não quebrar os pontos de uso existentes (`oferta-checkout-buttons.tsx`, `dynamic-cta-section.tsx`).

#### Scenario: Renderização sem quebras de importação
- **WHEN** componentes que importam `CheckoutLink` de `kiwify-checkout-link` renderizam
- **THEN** o checkout link funciona normalmente sem erros de importação (re-export ou renomeação transparente)
