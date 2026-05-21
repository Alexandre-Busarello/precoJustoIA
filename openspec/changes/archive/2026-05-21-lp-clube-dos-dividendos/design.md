## Context

A rota `/parceiros/[slug]` já existe com server component (`page.tsx`) + client component (`PartnerLpClient`) que:
- Faz lookup do parceiro no banco por slug
- Salva `partner_id` no localStorage via `useEffect`
- Exibe dois botões: "Criar conta grátis" e "Assinar agora"

O `PartnerLpClient` atual é um placeholder — centralizado, sem identidade visual e sem apresentar as features da plataforma. O objetivo desta LP é substituí-lo por uma experiência de marketing completa, sem quebrar nenhuma das regras de atribuição de parceiro já especificadas.

## Goals / Non-Goals

**Goals:**
- LP rica em conteúdo para `/parceiros/clube-dos-dividendos` com seções interativas por feature
- SEO on-page: metadata personalizada, Open Graph, JSON-LD (`Product`, `FAQPage`)
- Manter a lógica de atribuição (localStorage) e checkout do parceiro intactas
- Componente `PartnerLpShell` reutilizável para futuras LPs de outros parceiros

**Non-Goals:**
- CMS ou painel admin para editar conteúdo da LP
- Migração de banco de dados
- Tradução para outros idiomas
- Testes A/B automáticos

## Decisions

### 1. Componente dedicado por slug vs. templates genéricos

**Decisão**: O `page.tsx` detecta o slug no servidor e renderiza um componente de LP específico (`ClubeDividendosLP`) quando slug === `'clube-dos-dividendos'`. Slugs sem LP rica caem no `PartnerLpClient` genérico existente.

**Por quê não** template genérico via banco: exigiria novo campo `lpTemplate` no `Partner`, migração de banco e editor. O modelo de "componente por slug" é zero DB, zero migração, aproveitável via `switch` ou mapa de componentes.

**Por quê não** um único componente parametrizado: O conteúdo da LP do Clube é específico demais (copy, seções, provas sociais, FAQ). Forçar tudo em props gera complexidade sem reuso real.

**Alternativa considerada**: Arquivos MDX por slug. Descartado — requer configuração adicional no Next.js e limita interatividade (componentes React nas seções).

---

### 2. Estrutura de seções e interatividade

**Decisão**: Seções estáticas em componentes React separados sob `src/components/parceiros/clube-dos-dividendos/`. Cada seção de feature usa Tabs ou Accordion do shadcn/ui para interatividade. Sem requisições de API em runtime — dados mockados/estáticos para demonstração visual.

**Por quê dados estáticos**: Dados reais de mercado exigiriam autenticação e poderiam expor informações sob licença das fontes. Capturas visuais / dados ilustrativos são o padrão das LPs de SaaS concorrentes.

**Por quê shadcn/ui**: Já é a UI library do projeto. Sem dependências novas.

---

### 3. SEO: metadata e JSON-LD

**Decisão**: O `generateMetadata` no `page.tsx` é sobrescrito para o slug `clube-dos-dividendos` com title/description/OG específicos. JSON-LD `Product` e `FAQPage` são injetados via `<script type="application/ld+json">` no componente servidor.

**Por quê não** `next-seo` ou outro pacote: o App Router do Next.js 14 tem `generateMetadata` nativo — zero dependência nova.

**Rota canônica**: `/parceiros/clube-dos-dividendos` (sem query strings). O sitemap deve incluir esta rota.

---

### 4. Fluxo de CTA e checkout

**Decisão**: O `PartnerLpShell` recebe `partnerId` e `partnerCheckoutUrl` como props (igual ao `PartnerLpClient` atual). A lógica de `useCheckoutUrl` e localStorage não muda. CTAs de cada seção disparam scroll até a seção de preços ou abrem o checkout diretamente.

**Erro handling**: Se o checkout URL for `null/undefined` (parceiro sem `checkoutUrl` no banco), os botões "Assinar agora" ficam desabilitados — comportamento já existente preservado.

---

### 5. Sitemap

**Decisão**: Adicionar `/parceiros/clube-dos-dividendos` ao `sitemap.ts` (ou equivalente) com `changefreq: 'monthly'` e `priority: 0.8`.

## Risks / Trade-offs

- **Copy estático envelhece**: Quando features mudarem, o texto da LP pode ficar desatualizado. → Mitigação: comentários no código marcando quais seções descrevem features específicas do spec.
- **Dados ilustrativos podem confundir**: Usuários atentos podem notar que os números da demo não são reais. → Mitigação: label "Dados ilustrativos" nas capturas/mockups interativos.
- **Layout complexo = mais CSS**: LPs longas com muitas seções são mais difíceis de manter responsivo. → Mitigação: Tailwind utility-first + breakpoints `md:` e `lg:` testados no Vercel Preview.
- **Nenhuma migração necessária**: Zero risco de regressão em banco de dados.

## Migration Plan

1. Deploy da nova LP é zero-downtime — é apenas uma nova renderização da rota existente
2. O `PartnerLpClient` genérico permanece intacto para outros parceiros
3. Rollback: reverter o `switch` no `page.tsx` para sempre usar `PartnerLpClient`

## Open Questions

- Quais depoimentos/provas sociais incluir? (Aguarda conteúdo do Bruno Mazzoni)
- O cupom do clube é fixo no código ou lido do campo `couponCode` do `Partner`? (Definir se precisamos adicionar campo ao banco em versão futura)
- Incluir contador de assinantes ou número de ações analisadas? (Dado estático vs. dinâmico)
