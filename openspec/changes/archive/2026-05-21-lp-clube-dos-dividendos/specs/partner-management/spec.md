## MODIFIED Requirements

### Requirement: Landing page fake para parceiros (`/parceiros/[slug]`)
O sistema SHALL servir uma página em `/parceiros/[slug]` que: (a) valida o slug no servidor via `prisma.partner.findUnique`, (b) instrui o cliente a salvar o `partner_id` no `localStorage`, (c) exibe CTA para cadastro ou assinatura. Acesso à LP não requer autenticação (FREE/PREMIUM/visitante).

Para o slug `clube-dos-dividendos`, o sistema SHALL renderizar o componente `ClubeDividendosLP` (LP rica com seções interativas, SEO personalizado e prova social) em vez do `PartnerLpClient` genérico. Para todos os demais slugs válidos, o `PartnerLpClient` genérico continua sendo renderizado.

O `generateMetadata` SHALL retornar metadados específicos para slugs que possuem LP rica dedicada (title, description, Open Graph e canonical personalizados), e metadados genéricos `"${partner.name} × Preço Justo AI"` para demais slugs.

#### Scenario: Acesso com slug válido (parceiro genérico)
- **WHEN** um visitante acessa `/parceiros/[slug]` para um slug válido sem LP rica dedicada
- **THEN** a página renderiza o `PartnerLpClient` genérico sem erro, o `partner_id` é gravado no `localStorage` e exibe botões "Criar conta grátis" e "Assinar agora"

#### Scenario: Acesso com slug `clube-dos-dividendos`
- **WHEN** um visitante acessa `/parceiros/clube-dos-dividendos`
- **THEN** a página renderiza o componente `ClubeDividendosLP` com todas as seções de features, SEO personalizado e prova social; o `partner_id` é gravado no `localStorage` com o UUID do parceiro

#### Scenario: Acesso com slug inválido
- **WHEN** um visitante acessa `/parceiros/parceiro-inexistente`
- **THEN** a página retorna HTTP 404 via Next.js `notFound()`

#### Scenario: Gravação no localStorage falha silenciosamente
- **WHEN** o `localStorage` está bloqueado (ex: modo privado restrito)
- **THEN** a página ainda renderiza normalmente sem lançar exceção visível ao usuário

#### Scenario: Metadata personalizada para LP rica
- **WHEN** Next.js chama `generateMetadata` para `/parceiros/clube-dos-dividendos`
- **THEN** o metadata retornado contém title, description, openGraph e canonical específicos para o Clube dos Dividendos (não o genérico `"${partner.name} × Preço Justo AI"`)
