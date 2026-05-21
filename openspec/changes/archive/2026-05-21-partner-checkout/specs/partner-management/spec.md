# Spec: Partner Management

## Purpose
Define o modelo de dados do parceiro, a rota de landing page fake e as regras de acesso à entidade `Partner`.

## ADDED Requirements

### Requirement: Entidade Partner no banco de dados
O sistema SHALL persistir parceiros na tabela `Partner` com os campos: `id` (UUID), `slug` (string única, kebab-case), `name` (nome de exibição), `lpUrl` (URL da landing page), `checkoutUrl` (URL de checkout exclusiva no Cakto), `createdAt`. A coluna `slug` MUST ter constraint UNIQUE.

#### Scenario: Slug duplicado é rejeitado
- **WHEN** uma tentativa de inserir um `Partner` com `slug` já existente é feita
- **THEN** o banco rejeita com constraint violation e o serviço retorna erro 409

#### Scenario: Busca por slug retorna dados do parceiro
- **WHEN** `GET /api/v1/partners/[slug]` é chamado com um slug válido
- **THEN** a resposta inclui `id`, `slug`, `name`, `lpUrl`, `checkoutUrl`

#### Scenario: Slug inexistente retorna 404
- **WHEN** `GET /api/v1/partners/[slug]` é chamado com um slug que não existe no banco
- **THEN** a resposta é HTTP 404 sem dados sensíveis

---

### Requirement: Landing page fake para parceiros (`/parceiros/[slug]`)
O sistema SHALL servir uma página em `/parceiros/[slug]` que: (a) valida o slug no servidor, (b) instrui o cliente a salvar o `partner_id` no `localStorage`, (c) exibe CTA para cadastro ou assinatura. Acesso à LP não requer autenticação (FREE/PREMIUM/visitante).

#### Scenario: Acesso com slug válido
- **WHEN** um visitante acessa `/parceiros/clube-dos-dividendos`
- **THEN** a página renderiza sem erro, o `partner_id` é gravado no `localStorage` com chave `partner_id` e valor igual ao `id` do parceiro, e exibe botões "Criar conta grátis" e "Assinar agora"

#### Scenario: Acesso com slug inválido
- **WHEN** um visitante acessa `/parceiros/parceiro-inexistente`
- **THEN** a página retorna HTTP 404 (Next.js `notFound()`)

#### Scenario: Gravação no localStorage falha silenciosamente
- **WHEN** o `localStorage` está bloqueado (ex: modo privado restrito)
- **THEN** a página ainda renderiza normalmente sem lançar exceção visível ao usuário

---

### Requirement: Endpoint interno de resolução de checkout por parceiro
O sistema SHALL expor `GET /api/v1/partners/[slug]/checkout-url` que retorna a `checkoutUrl` do parceiro identificado pelo slug. Este endpoint é interno (não documentado publicamente) e usado pelo hook de checkout.

#### Scenario: Parceiro com checkout configurado
- **WHEN** `GET /api/v1/partners/[slug]/checkout-url` é chamado com slug válido
- **THEN** retorna `{ checkoutUrl: "https://pay.cakto.com.br/..." }`

#### Scenario: Slug sem parceiro
- **WHEN** `GET /api/v1/partners/[slug]/checkout-url` é chamado com slug inválido
- **THEN** retorna HTTP 404
