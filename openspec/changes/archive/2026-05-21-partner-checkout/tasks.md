## 1. Banco de Dados — Migration e Seed

- [x] 1.1 Adicionar modelo `Partner` no `schema.prisma` (id, slug único, name, lpUrl, checkoutUrl, createdAt)
- [x] 1.2 Adicionar campo `partnerId` (nullable, FK para `Partner`) no modelo `User` do `schema.prisma`
- [x] 1.3 Adicionar campo `partnerId` ao tipo `session.user` em `next-auth.d.ts`
- [ ] 1.4 Executar `npx prisma db push` para aplicar o schema (sem migration — controlado manualmente)
- [x] 1.5 Criar script de seed para inserir o parceiro `clube-dos-dividendos` com slug, lpUrl e checkoutUrl reais do Cakto

## 2. Backend — API de Parceiros

- [x] 2.1 Criar `src/app/api/v1/partners/[slug]/route.ts` — GET que retorna dados do parceiro pelo slug (404 se não existir)
- [x] 2.2 Criar `src/app/api/v1/partners/[slug]/checkout-url/route.ts` — GET que retorna `checkoutUrl` do parceiro (404 se não existir)
- [x] 2.3 Adicionar proteção de imutabilidade em `src/lib/services/user.service.ts`: ao fazer update de usuário, se `partnerId` já está preenchido no banco, remover o campo do payload de update e emitir `console.warn`

## 3. Backend — Sessão NextAuth

- [x] 3.1 Incluir `partnerId` no callback `session` em `src/lib/auth.ts` (ler do `user.partnerId` via banco ou token JWT)
- [x] 3.2 Incluir `partnerId` no callback `jwt` para que o campo persista no token entre requests

## 4. Backend — Cadastro com Atribuição de Parceiro

- [x] 4.1 Atualizar `POST /api/auth/register` para aceitar `partnerId` opcional no body e, se válido, gravar em `User.partnerId` na criação
- [x] 4.2 Atualizar `POST /api/auth/process-oauth` (primeiro login Google) para aceitar e gravar `partnerId` apenas em usuários novos

## 5. Frontend — Landing Page de Parceiros

- [x] 5.1 Criar `src/app/parceiros/[slug]/page.tsx` (Server Component): buscar dados do parceiro via `prisma`; retornar `notFound()` se slug inválido
- [x] 5.2 Criar `src/components/parceiros/partner-lp-client.tsx` (Client Component): gravar `partner_id` no `localStorage` com `try/catch`; renderizar CTA "Criar conta grátis" e "Assinar agora"
- [x] 5.3 Garantir que os botões de CTA da LP redirecionem corretamente: "Criar conta" → `/cadastro`, "Assinar agora" → fluxo de checkout com marcador

## 6. Frontend — Hook de Checkout Atualizado

- [x] 6.1 Atualizar `useCheckoutUrl` em `src/hooks/use-checkout-url.ts` para implementar a prioridade: (1) `session.user.partnerId`, (2) `localStorage.getItem("partner_id")`, (3) oferta padrão, (4) env var
- [x] 6.2 Adicionar lógica para buscar `checkoutUrl` do parceiro via `GET /api/v1/partners/[slug]/checkout-url` quando `partnerId` está presente
- [x] 6.3 Garantir que UTM params e email continuam sendo appendados à URL final do parceiro

## 7. Frontend — Formulário de Cadastro com Propagação do Marcador

- [x] 7.1 Atualizar o formulário de cadastro (`src/components/auth/register-form.tsx` ou equivalente) para ler `localStorage.getItem("partner_id")` no momento do submit
- [x] 7.2 Incluir `partnerId` no payload de `POST /api/auth/register`
- [x] 7.3 Para o fluxo OAuth, passar `partnerId` do `localStorage` no body de `POST /api/auth/process-oauth`

## 8. Validação e Testes Manuais

- [ ] 8.1 Testar fluxo completo: acessar `/parceiros/clube-dos-dividendos` → verificar `localStorage` → cadastrar → confirmar `User.partnerId` no banco
- [ ] 8.2 Testar checkout de visitante: acessar LP → clicar "Assinar agora" → confirmar redirecionamento para URL do parceiro
- [ ] 8.3 Testar checkout de usuário logado com parceiro: logar com conta vinculada → clicar "Upgrade" no dashboard → confirmar URL do parceiro
- [ ] 8.4 Testar soberania do BD: usuário com parceiro limpa `localStorage` → acessa LP de outro parceiro → clica "Renovar" → confirma uso do parceiro original
- [ ] 8.5 Testar slug inválido em `/parceiros/inexistente` → confirmar 404
- [x] 8.6 Executar `npx prisma generate` e verificar que não há erros de tipagem TypeScript (`tsc --noEmit`)
