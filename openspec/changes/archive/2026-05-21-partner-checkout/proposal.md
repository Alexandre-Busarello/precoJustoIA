## Why

O sistema não possui suporte a modelos de parceria com split de receita, impedindo acordos comerciais com canais como o "Clube dos Dividendos". A implementação desse fluxo abre um canal de aquisição pago com rastreabilidade permanente do parceiro de origem, sem depender de cookies ou sessões voláteis.

## What Changes

- **Novo modelo `Partner`** no banco: slug, URL da LP, URL de checkout exclusiva (Cakto com split configurado).
- **Campo `partnerId` no `User`**: opcional, imutável após preenchimento — representa a atribuição permanente ao parceiro.
- **Marcação de sessão via localStorage**: ao acessar a LP de um parceiro, o `partnerId` é salvo no navegador e persiste durante a navegação pelas páginas institucionais.
- **Lógica de checkout bifurcada**:
  - Visitante não logado: verifica `localStorage` → redireciona para checkout do parceiro ou padrão.
  - Usuário logado: ignora `localStorage`, consulta `partnerId` no banco → usa checkout do parceiro ou padrão.
- **LP fake para `clube-dos-dividendos`**: página simples em `/parceiros/clube-dos-dividendos` para capturar o marcador de sessão e redirecionar para o cadastro/checkout.
- **Imutabilidade garantida**: `partnerId` nunca pode ser atualizado ou removido uma vez gravado (proteção no backend).

## Capabilities

### New Capabilities

- `partner-management`: Entidade `Partner` no banco (slug, lp_url, checkout_url), endpoints de leitura interna, e LP fake para clube-dos-dividendos.
- `partner-attribution`: Marcação de sessão no navegador ao acessar LP, vinculação permanente do parceiro no cadastro do usuário, e regra de decisão de checkout (visitante vs. logado).

### Modified Capabilities

- `dynamic-checkout-url`: Extensão da lógica de resolução de URL para considerar o `partnerId` do usuário logado ou o marcador de sessão, priorizando o checkout do parceiro quando aplicável.
- `authentication`: Adição do campo `partnerId` (FK para `Partner`, nullable, imutável) na entidade `User`; captura do marcador na criação de conta.

## Impact

- **DB**: nova tabela `Partner`; nova coluna `partner_id` em `User` (migration Prisma).
- **API**: novo endpoint interno para resolver checkout_url considerando parceiro; proteção contra update de `partner_id`.
- **Frontend**: hook `useCheckoutUrl` estendido; nova rota `/parceiros/[slug]` (LP fake); leitura/escrita de `localStorage` no flow de navegação.
- **Tiers afetados**: PREMIUM (o checkout do parceiro é para assinatura PREMIUM com desconto pré-configurado no Cakto).

## Non-goals

- Design elaborado da LP do parceiro (será apenas uma página funcional de rastreamento por enquanto).
- Painel administrativo para cadastro de novos parceiros (o primeiro parceiro será inserido diretamente no banco).
- Dashboard de analytics de conversão por parceiro.
- Suporte a múltiplos planos/ofertas por parceiro (apenas o checkout exclusivo configurado no Cakto).
