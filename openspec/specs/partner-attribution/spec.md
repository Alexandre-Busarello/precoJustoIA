# Spec: Partner Attribution

## Purpose
Define as regras de marcação de sessão no navegador, atribuição permanente do parceiro ao usuário no cadastro, e a árvore de decisão de checkout (visitante vs. logado).

## Requirements

### Requirement: Marcação de parceiro no localStorage ao acessar a LP
O sistema SHALL gravar o `id` do parceiro no `localStorage` com a chave `partner_id` imediatamente quando o componente client da LP renderizar. O valor MUST sobrescrever qualquer valor anterior na mesma chave (um visitante que acessa outra LP antes de se cadastrar adota o parceiro mais recente no `localStorage` — a soberania final é do BD após o cadastro).

#### Scenario: Primeiro acesso à LP grava o marcador
- **WHEN** um visitante acessa `/parceiros/clube-dos-dividendos` pela primeira vez
- **THEN** `localStorage.getItem("partner_id")` retorna o UUID do parceiro `clube-dos-dividendos`

#### Scenario: Acesso subsequente a outra LP sobrescreve o marcador (visitante)
- **WHEN** um visitante (sem conta criada) que já tem `partner_id` no `localStorage` acessa a LP de outro parceiro
- **THEN** `localStorage.getItem("partner_id")` retorna o UUID do novo parceiro

#### Scenario: Usuário logado e vinculado visita LP de outro parceiro — localStorage atualiza, conta não muda
- **WHEN** um usuário autenticado com `User.partnerId = parceiro-A` acessa a LP do `parceiro-B`
- **THEN** `localStorage.getItem("partner_id")` passa a retornar o UUID do `parceiro-B`, mas `User.partnerId` no banco permanece `parceiro-A` e o checkout do usuário logado continua usando `parceiro-A`

#### Scenario: Usuário logado e vinculado faz logout, cria nova conta — nova conta usa último parceiro do localStorage
- **WHEN** um usuário com `User.partnerId = parceiro-A` faz logout, acessa a LP do `parceiro-B` (localStorage atualiza para `parceiro-B`) e cria uma nova conta com outro email
- **THEN** a nova conta é gravada com `User.partnerId = parceiro-B` (último valor do `localStorage` no momento do cadastro)

#### Scenario: Navegação para outras páginas não apaga o marcador
- **WHEN** um visitante que acessou a LP navega para `/`, `/recursos` ou `/precos`
- **THEN** `localStorage.getItem("partner_id")` ainda retorna o UUID do parceiro

---

### Requirement: Vínculo permanente do parceiro no cadastro do usuário
O sistema SHALL, ao processar o cadastro de um novo usuário (`POST /api/auth/register`), verificar se existe `partner_id` válido no corpo da requisição. Se existir e corresponder a um `Partner.id` no banco, o campo `User.partnerId` SHALL ser gravado com esse valor. Se não existir ou for inválido, `User.partnerId` é `null`. O campo MUST ser definido apenas na criação e NEVER atualizado após preenchido.

#### Scenario: Cadastro com marcador válido
- **WHEN** `POST /api/auth/register` é enviado com `partnerId` correspondente a um parceiro existente
- **THEN** `User.partnerId` é persistido com o UUID do parceiro e não pode ser alterado por nenhuma operação posterior

#### Scenario: Cadastro sem marcador
- **WHEN** `POST /api/auth/register` é enviado sem `partnerId` ou com valor nulo
- **THEN** `User.partnerId` é `null`

#### Scenario: Cadastro com partnerId inválido (não existe no banco)
- **WHEN** `POST /api/auth/register` é enviado com um `partnerId` que não corresponde a nenhum `Partner`
- **THEN** `User.partnerId` é gravado como `null` (sem erro retornado ao cliente)

#### Scenario: Tentativa de atualizar partnerId de usuário existente é ignorada
- **WHEN** qualquer operação de update tenta modificar `User.partnerId` de um usuário que já possui o campo preenchido
- **THEN** o valor original é mantido e um log de warning é emitido

---

### Requirement: Árvore de decisão de checkout para visitante não logado (Fluxo A)
O sistema SHALL, quando um visitante não autenticado clicar em "Assinar" ou "Fazer Upgrade", verificar `localStorage.getItem("partner_id")`. Se houver valor, o sistema SHALL redirecionar para a `checkoutUrl` do parceiro correspondente. Se não houver, redirecionar para a URL de checkout padrão. Esta lógica está no hook `useCheckoutUrl`.

#### Scenario: Visitante com marcador clica em assinar
- **WHEN** um visitante com `partner_id` válido no `localStorage` clica no botão de CTA de assinatura
- **THEN** é redirecionado para a `checkoutUrl` do parceiro (com UTM e email appendados se disponíveis)

#### Scenario: Visitante sem marcador clica em assinar
- **WHEN** um visitante sem `partner_id` no `localStorage` clica no botão de CTA
- **THEN** é redirecionado para a URL de checkout padrão do site

---

### Requirement: Árvore de decisão de checkout para usuário logado (Fluxo B)
O sistema SHALL, quando um usuário autenticado clicar em "Assinar", "Fazer Upgrade" ou "Renovar Planos", ignorar completamente o `localStorage` e consultar `User.partnerId` via sessão NextAuth. Se `partnerId` estiver preenchido, o sistema SHALL usar a `checkoutUrl` do parceiro. Se `partnerId` for `null`, usar o checkout padrão.

#### Scenario: Usuário logado com parceiro vinculado acessa checkout semanas depois
- **WHEN** um usuário com `partnerId` preenchido no BD clica em "Assinar" estando logado
- **THEN** o checkout aponta para a `checkoutUrl` do parceiro, independentemente do estado do `localStorage`

#### Scenario: Usuário logado sem parceiro acessa checkout
- **WHEN** um usuário com `partnerId = null` clica em "Assinar" estando logado
- **THEN** o checkout aponta para a URL padrão do site

#### Scenario: Usuário logado que limpou cookies e acessou LP de outro parceiro
- **WHEN** um usuário previamente vinculado ao parceiro A acessa a LP do parceiro B e depois clica em "Renovar Plano"
- **THEN** o checkout usa a `checkoutUrl` do parceiro A (BD tem soberania sobre o `localStorage`)

---

### Requirement: Propagação de partnerId do localStorage no formulário de cadastro
O sistema SHALL, no formulário de cadastro (`/cadastro`), ler `localStorage.getItem("partner_id")` e incluí-lo como campo oculto ou como parte do payload de `POST /api/auth/register`. A leitura ocorre no momento do submit, não no carregamento da página.

#### Scenario: Formulário de cadastro inclui partnerId no payload
- **WHEN** usuário submete o formulário de cadastro com `partner_id` presente no `localStorage`
- **THEN** `POST /api/auth/register` contém `partnerId` com o valor do `localStorage`

#### Scenario: Formulário de cadastro sem marcador não envia partnerId
- **WHEN** usuário submete o formulário de cadastro sem `partner_id` no `localStorage`
- **THEN** `POST /api/auth/register` não inclui `partnerId` ou inclui como `null`
