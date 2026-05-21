# Spec: Authentication (Delta)

## ADDED Requirements

### Requirement: Campo `partnerId` imutável na entidade User
O sistema SHALL adicionar o campo `partnerId` (UUID, nullable, FK para `Partner.id`) ao modelo `User`. O campo MUST ser definido apenas durante a criação do usuário. Qualquer tentativa de update que tente modificar `partnerId` de um valor não-nulo para qualquer outro valor SHALL ser ignorada silenciosamente e um log de warning SHALL ser emitido.

#### Scenario: Novo usuário criado com partnerId
- **WHEN** `POST /api/auth/register` recebe `partnerId` válido e o usuário ainda não existe
- **THEN** `User.partnerId` é persistido com o valor fornecido

#### Scenario: Novo usuário criado sem partnerId
- **WHEN** `POST /api/auth/register` não recebe `partnerId`
- **THEN** `User.partnerId` é `null`

#### Scenario: Tentativa de update de partnerId preenchido é ignorada
- **WHEN** qualquer código tenta chamar `prisma.user.update({ data: { partnerId: novoValor } })` em um usuário com `partnerId` já preenchido
- **THEN** o campo não é atualizado e um warning é logado com `userId` e `tentativePartnerId`

---

### Requirement: `partnerId` exposto na sessão NextAuth
O sistema SHALL incluir `partnerId` no objeto `session.user` via callback `session` do NextAuth, lendo o valor do `User` no banco. O campo é `string | null`.

#### Scenario: Sessão de usuário com parceiro vinculado
- **WHEN** um usuário com `partnerId` preenchido está autenticado
- **THEN** `session.user.partnerId` retorna o UUID do parceiro

#### Scenario: Sessão de usuário sem parceiro
- **WHEN** um usuário com `partnerId = null` está autenticado
- **THEN** `session.user.partnerId` é `null`

---

### Requirement: Cadastro via Google OAuth captura partnerId do localStorage
O sistema SHALL, ao processar o primeiro login via Google OAuth (`POST /api/auth/process-oauth`), verificar se o cliente enviou `partnerId` no corpo da requisição. Se válido, SHALL gravar em `User.partnerId` com a mesma regra de imutabilidade.

#### Scenario: Primeiro login OAuth com partnerId no payload
- **WHEN** `POST /api/auth/process-oauth` recebe `partnerId` válido para um novo usuário OAuth
- **THEN** `User.partnerId` é persistido com o valor fornecido

#### Scenario: Login OAuth de usuário existente — partnerId ignorado
- **WHEN** `POST /api/auth/process-oauth` recebe `partnerId` para um usuário que já existe no banco
- **THEN** o `partnerId` do payload é ignorado e o valor do banco é mantido
