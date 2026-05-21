## Why

A rota `/parceiros/[slug]` atual serve uma landing page genérica ("fake") sem identidade, sem apresentação das funcionalidades e sem estrutura de SEO — zero poder de conversão orgânica. O Clube dos Dividendos do Bruno Mazzoni precisa de uma LP dedicada, com alta conversão e capaz de rankear no orgânico para termos como "analisador de ações dividendos", enquanto apresenta as features da plataforma Preço Justo de forma interativa e confiável.

## What Changes

- Nova página estática em `/parceiros/clube-dos-dividendos` substituindo o placeholder atual
- Seções de hero, features interativas (accordion/tabs), demonstração visual de cada ferramenta PREMIUM, prova social e CTA estratégico com cupom do clube
- Structured data (JSON-LD: `Product`, `FAQPage`, `Organization`) para SEO orgânico
- `<head>` otimizado: title/description personalizados, Open Graph e canonical URL por parceiro
- Integração com o sistema de parceiros existente (gravação de `partner_id` no localStorage, fluxo de checkout pelo Cakto)
- Componente `PartnerLPShell` reutilizável para futuras LPs de outros parceiros

## Capabilities

### New Capabilities
- `partner-landing-page`: LP de alta conversão para parceiros, com seções interativas por feature, SEO on-page e integração com o fluxo de checkout e atribuição de parceiro existente. Afeta tiers FREE e PREMIUM (usuários sem conta veem proposta de valor antes de criar conta grátis; usuários PREMIUM são redirecionados ao checkout do parceiro com cupom pré-aplicado).

### Modified Capabilities
- `partner-management`: A rota `/parceiros/[slug]` deixa de ser um stub e passa a carregar o componente de LP rico. O servidor ainda faz lookup do slug e retorna 404 para slugs inválidos — requisito mantido. Nenhum campo novo no modelo `Partner` neste momento.

## Impact

- `src/app/parceiros/[slug]/page.tsx` — reescrito para renderizar o novo componente de LP
- `src/components/partners/` — novo diretório com `PartnerLPShell`, seções reutilizáveis e dados estáticos do Clube dos Dividendos
- Nenhuma migração de banco necessária
- SEO: sitemap.xml deve incluir `/parceiros/clube-dos-dividendos`

## Non-goals

- Painel de administração para criar/editar LPs via CMS (fora do escopo)
- A/B testing automatizado de variantes de CTA
- Vídeos hospedados na plataforma (links para YouTube são suficientes neste escopo)
- Novos campos no modelo `Partner` (slug/checkoutUrl existentes são suficientes)
