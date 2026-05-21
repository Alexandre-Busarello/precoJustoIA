## 1. Estrutura base e roteamento

- [x] 1.1 Criar diretório `src/components/parceiros/clube-dos-dividendos/` e arquivo `index.tsx` exportando `ClubeDividendosLP`
- [x] 1.2 Atualizar `src/app/parceiros/[slug]/page.tsx`: adicionar lógica de switch por slug para renderizar `ClubeDividendosLP` quando slug === `'clube-dos-dividendos'`
- [x] 1.3 Atualizar `generateMetadata` no mesmo `page.tsx` para retornar title, description, openGraph e `alternates.canonical` específicos para o slug `clube-dos-dividendos`
- [x] 1.4 Criar `src/components/parceiros/clube-dos-dividendos/lp-data.ts` com todos os dados estáticos da LP (copy, features, FAQ, depoimentos, estatísticas)

## 2. SEO e JSON-LD

- [x] 2.1 Adicionar componente `JsonLd` (RSC) em `src/components/parceiros/clube-dos-dividendos/json-ld.tsx` com schemas `Product` e `FAQPage` renderizados via `<script type="application/ld+json">`
- [x] 2.2 Incluir `<JsonLd>` no componente `ClubeDividendosLP` (server component wrapper)
- [x] 2.3 Adicionar `/parceiros/clube-dos-dividendos` ao `src/app/sitemap.ts` (ou equivalente) com `priority: 0.8` e `changefreq: 'monthly'`

## 3. Hero Section

- [x] 3.1 Criar `src/components/parceiros/clube-dos-dividendos/sections/hero.tsx` com headline, subheadline, dois CTAs e logo/badge do parceiro
- [x] 3.2 Implementar CTA "Ver planos com desconto" com scroll suave via `href="#planos"` e `scroll-behavior: smooth` no CSS global ou via `scrollIntoView`
- [x] 3.3 Layout mobile-first: CTAs empilhados verticalmente com `w-full` em < 768px, lado a lado em `md:`

## 4. Seção de Features Interativas

- [x] 4.1 Criar `src/components/parceiros/clube-dos-dividendos/sections/features-radar.tsx` — Radar de Dividendos e Projeção 12 meses (Tabs shadcn/ui com dados ilustrativos)
- [x] 4.2 Criar `sections/features-valuation.tsx` — 8 Modelos de Valuation com Tabs (Graham, Bazin, P/L Justo, Gordon, DCF, EV/EBITDA, ROE, Net Asset Value), cada aba com descrição do modelo, fórmula simplificada e exemplo ilustrativo
- [x] 4.3 Criar `sections/features-ranking.tsx` — Ranking B3 com tabela ilustrativa e badge FREE/PREMIUM
- [x] 4.4 Criar `sections/features-screening.tsx` — Screening Avançado com filtros mockados interativos (select/checkbox sem lógica real)
- [x] 4.5 Criar `sections/features-ai.tsx` — Análise por IA: card com exemplo de output da IA (texto estático ilustrativo)
- [x] 4.6 Criar `sections/features-monitoring.tsx` — Monitoramento de Ativos: card com exemplo de alerta ilustrativo
- [x] 4.7 Em viewport < 768px: garantir que Tabs colapsem para scroll horizontal com `overflow-x: auto` ou Accordion; validar sem overflow

## 5. Score de Sustentabilidade de Dividendos

- [x] 5.1 Criar `sections/features-sustainability.tsx` com explicação do score (componente visual de gauge/barra de progresso estática em 3 níveis: baixo/médio/alto) e critérios (payout ratio, cobertura de lucro, dívida, crescimento)

## 6. Seção de Preços com Cupom do Clube

- [x] 6.1 Criar `sections/pricing.tsx` com id="planos", cards FREE e PREMIUM, badge de cupom "CLUBE" e botão de assinatura usando `useCheckoutUrl`
- [x] 6.2 Receber `partnerId` e `partnerCheckoutUrl` via props no componente client e plugar no `useCheckoutUrl` (mesmo padrão do `PartnerLpClient` existente)
- [x] 6.3 Condicional: se usuário PREMIUM, botão exibe "Você já é Premium" e fica desabilitado
- [x] 6.4 Layout mobile: cards FREE e PREMIUM empilhados verticalmente com `w-full`

## 7. Prova Social

- [x] 7.1 Criar `sections/social-proof.tsx` com estatísticas da plataforma (dados estáticos: ex. "8 modelos de valuation", "500+ ações analisadas")
- [x] 7.2 Adicionar 3 cards de depoimentos estáticos (nome, perfil de investidor, texto curto)
- [x] 7.3 Mobile: depoimentos em container com `overflow-x: auto`, `scroll-snap-type: x mandatory` e cards com `scroll-snap-align: start`

## 8. Seção de FAQ

- [x] 8.1 Criar `sections/faq.tsx` com Accordion shadcn/ui e mínimo 6 pares pergunta/resposta
- [x] 8.2 Garantir que o conteúdo do FAQ no TSX seja idêntico ao FAQ no JSON-LD `FAQPage` em `json-ld.tsx`
- [x] 8.3 Mobile: cada trigger do Accordion com `min-h-[44px]` para conformidade de área de toque

## 9. Integração com atribuição de parceiro

- [x] 9.1 Criar `src/components/parceiros/clube-dos-dividendos/partner-tracker.tsx` — componente client responsável exclusivamente pelo `localStorage.setItem('partner_id', partnerId)` no `useEffect`, com try/catch silencioso
- [x] 9.2 Incluir `<PartnerTracker partnerId={partner.id} />` no server component wrapper de `ClubeDividendosLP`

## 10. Acessibilidade e qualidade mobile

- [x] 10.1 Auditar todos os CTAs e botões: garantir `min-h-[44px]` e `min-w-[44px]`
- [x] 10.2 Garantir que todas as `<Image>` do Next.js tenham prop `alt` descritivo
- [x] 10.3 Testar em viewport 320px: confirmar ausência de overflow horizontal
- [x] 10.4 Rodar `next build` sem erros de TypeScript ou lint

## 11. Verificação final

- [ ] 11.1 Confirmar que o parceiro `clube-dos-dividendos` existe no banco (seed ou insert manual) com `checkoutUrl` preenchida
- [ ] 11.2 Testar fluxo completo: acesso à LP → localStorage gravado → clique em "Assinar agora" → redireciona para `checkoutUrl` do parceiro
- [ ] 11.3 Validar JSON-LD com Google Rich Results Test
- [ ] 11.4 Rodar Lighthouse na URL de preview do Vercel e confirmar Performance ≥ 85 e SEO = 100 em mobile
