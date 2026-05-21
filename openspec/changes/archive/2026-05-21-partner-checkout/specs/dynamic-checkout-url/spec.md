# Spec: Dynamic Checkout URL (Delta)

## MODIFIED Requirements

### Requirement: Resolver URL de checkout a partir da oferta ativa no banco
O sistema SHALL buscar a URL de checkout considerando a seguinte ordem de prioridade: (1) `Partner.checkoutUrl` vinculado ao usuário logado via `User.partnerId` na sessão, (2) `Partner.checkoutUrl` vinculado ao `partner_id` no `localStorage` (visitante), (3) `checkout_url` da oferta ativa em `GET /api/v1/pricing/offers`, (4) variável de ambiente `NEXT_PUBLIC_CAKTO_PRODUCT_URL`. A URL final preserva os parâmetros UTM e email do usuário logado.

#### Scenario: Usuário logado com parceiro vinculado — usa checkout do parceiro
- **WHEN** o componente de CTA renderiza e o usuário logado tem `session.user.partnerId` preenchido
- **THEN** o link de checkout aponta para `Partner.checkoutUrl` com UTM e email appendados, ignorando a oferta padrão e o `localStorage`

#### Scenario: Visitante com marcador no localStorage — usa checkout do parceiro
- **WHEN** o componente de CTA renderiza, o usuário não está logado e `localStorage.getItem("partner_id")` retorna um UUID válido
- **THEN** o link de checkout aponta para `Partner.checkoutUrl` do parceiro correspondente com UTM appendados

#### Scenario: Oferta ativa com checkout_url disponível (sem parceiro)
- **WHEN** o componente de CTA renderiza, não há parceiro vinculado nem marcador no `localStorage`, e existe uma oferta ativa com `checkout_url` preenchido
- **THEN** o link de checkout aponta para essa URL com os parâmetros UTM e email da sessão atual appendados

#### Scenario: Fallback para variável de ambiente
- **WHEN** nenhum parceiro, nenhuma oferta ativa tem `checkout_url` preenchido, mas `NEXT_PUBLIC_CAKTO_PRODUCT_URL` está definida
- **THEN** o link de checkout usa o valor da variável de ambiente

#### Scenario: Nenhuma URL disponível
- **WHEN** nem parceiro, nem oferta no banco, nem variável de ambiente têm a URL de checkout
- **THEN** o botão de CTA é desabilitado (ou ocultado)

#### Scenario: Parâmetros UTM preservados
- **WHEN** a página foi acessada com `?utm_source=google&utm_campaign=promo`
- **THEN** a URL de checkout final inclui `utm_source=google&utm_campaign=promo` como query params

#### Scenario: Email do usuário logado pré-preenchido
- **WHEN** há sessão ativa com email do usuário
- **THEN** a URL de checkout inclui `email=<email_do_usuario>` como query param

---

### Requirement: Hook `useCheckoutUrl` retorna URL dinâmica com estado de loading
O sistema SHALL expor `useCheckoutUrl()` que: (1) lê `session.user.partnerId` se o usuário estiver logado, (2) caso contrário lê `localStorage.getItem("partner_id")`, (3) resolve a `checkoutUrl` do parceiro se aplicável, (4) faz fallback para a oferta padrão via `GET /api/v1/pricing/offers`. Retorna `{ url, loading }`.

#### Scenario: Loading state
- **WHEN** o hook está consultando a API
- **THEN** retorna `{ url: null, loading: true }`

#### Scenario: URL resolvida via parceiro do usuário logado
- **WHEN** a API responde e o usuário tem `partnerId` preenchido
- **THEN** retorna `{ url: "https://pay.cakto.com.br/PARCEIRO_XXXXX?email=...", loading: false }`

#### Scenario: URL resolvida via oferta padrão (sem parceiro)
- **WHEN** a API responde, o usuário não tem `partnerId` e não há marcador no `localStorage`
- **THEN** retorna `{ url: "https://pay.cakto.com.br/XXXXX?email=...", loading: false }`
