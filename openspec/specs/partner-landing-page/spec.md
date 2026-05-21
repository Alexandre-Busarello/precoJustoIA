# Spec: Partner Landing Page (Clube dos Dividendos)

## Purpose
Define a estrutura, conteúdo, SEO e comportamento interativo da landing page dedicada ao parceiro Clube dos Dividendos (`/parceiros/clube-dos-dividendos`), garantindo alta conversão e rastreabilidade orgânica. Acesso à LP não requer autenticação (visitante/FREE/PREMIUM).

---

## Requirements

### Requirement: Hero section com proposta de valor e CTA principal
A página SHALL exibir uma seção hero acima da dobra com headline principal, subheadline e dois CTAs: "Criar conta grátis" (link para `/register`) e "Ver planos com desconto" (scroll até seção de preços). O hero SHALL incluir o logo ou nome do Preço Justo AI e uma referência ao Clube dos Dividendos como parceiro. Em mobile (< 768px), os dois botões de CTA SHALL estar empilhados verticalmente com largura 100% para facilitar o toque.

#### Scenario: Visitante acessa a LP em desktop
- **WHEN** um visitante sem autenticação acessa `/parceiros/clube-dos-dividendos` em viewport ≥ 768px
- **THEN** a hero section é exibida acima da dobra com headline, subheadline e os dois CTAs lado a lado horizontalmente

#### Scenario: Visitante acessa a LP em mobile
- **WHEN** um visitante acessa `/parceiros/clube-dos-dividendos` em viewport < 768px
- **THEN** hero section ocupa 100% da largura, os dois CTAs estão empilhados verticalmente com `width: 100%` e o texto não apresenta overflow horizontal

#### Scenario: CTA "Ver planos" faz scroll suave até a seção de preços
- **WHEN** o visitante clica no botão "Ver planos com desconto" no hero
- **THEN** a página faz scroll suave (`scroll-behavior: smooth`) até a seção de preços sem recarregar a página

---

### Requirement: Seções interativas por feature da plataforma
A página SHALL apresentar ao menos 8 seções de features, cada uma com título, descrição e componente interativo (Tabs ou Accordion via shadcn/ui). As features MUST cobrir: (1) Radar de Dividendos, (2) Projeção de Dividendos 12 meses, (3) Score de Sustentabilidade, (4) 8 Modelos de Valuation, (5) Ranking B3, (6) Screening Avançado, (7) Análise por IA, (8) Monitoramento de Ativos. Em mobile, os Tabs SHALL colapsar para Accordion ou scroll horizontal com indicador de swipe.

#### Scenario: Usuário interage com a seção de Modelos de Valuation
- **WHEN** o visitante clica em uma aba de modelo (ex: "Bazin") na seção de Modelos de Valuation
- **THEN** o painel correspondente é exibido com descrição do modelo, fórmula simplificada e exemplo ilustrativo; o painel anterior é ocultado

#### Scenario: Feature section em mobile colapsa corretamente
- **WHEN** a página é renderizada em viewport < 768px
- **THEN** as seções com Tabs exibem no máximo 2 tabs visíveis com overflow scroll horizontal ou colapsam para Accordion, sem quebra de layout

#### Scenario: Dados das seções são estáticos (sem requisição de API)
- **WHEN** a página é carregada por qualquer usuário
- **THEN** nenhuma requisição de API autenticada é feita para popular as seções de features; os dados ilustrativos são renderizados no servidor (RSC ou estático)

---

### Requirement: Seção de preços com cupom do Clube dos Dividendos
A página SHALL incluir uma seção de preços com os planos FREE e PREMIUM, destacando o desconto exclusivo do Clube dos Dividendos. O botão de assinatura MUST usar o `checkoutUrl` do parceiro lido do banco (via `useCheckoutUrl`). O cupom SHALL ser exibido como badge visual (ex: "CLUBE"). Em mobile, os cards de preço SHALL estar empilhados verticalmente.

#### Scenario: Visitante não autenticado clica em "Assinar com desconto"
- **WHEN** um visitante sem sessão clica no botão de assinatura na seção de preços
- **THEN** é redirecionado para a `checkoutUrl` do parceiro `clube-dos-dividendos` registrada no banco

#### Scenario: Usuário autenticado PREMIUM clica em assinar
- **WHEN** um usuário com sessão ativa e plano PREMIUM clica no botão de assinatura
- **THEN** o botão exibe "Você já é Premium" e fica desabilitado (sem redirecionar para checkout)

#### Scenario: Cards de preço em mobile
- **WHEN** a seção de preços é renderizada em viewport < 768px
- **THEN** os cards FREE e PREMIUM estão empilhados verticalmente, cada um com largura 100% do container

---

### Requirement: SEO on-page com metadata personalizada e JSON-LD
O `generateMetadata` do `page.tsx` SHALL retornar, para o slug `clube-dos-dividendos`:
- `title`: "Preço Justo AI para o Clube dos Dividendos | Análise de Ações B3"
- `description`: 150–160 caracteres descrevendo a plataforma para investidores de dividendos
- `openGraph.title`, `openGraph.description`, `openGraph.url` preenchidos
- `alternates.canonical` apontando para `/parceiros/clube-dos-dividendos`

A página SHALL incluir um `<script type="application/ld+json">` com schemas `Product` e `FAQPage` válidos segundo schema.org. O sitemap SHALL incluir a rota com `priority: 0.8`.

#### Scenario: Metadata correta para o slug clube-dos-dividendos
- **WHEN** Next.js chama `generateMetadata` para a rota `/parceiros/clube-dos-dividendos`
- **THEN** o objeto retornado contém `title`, `description`, `openGraph` e `alternates.canonical` preenchidos conforme especificado

#### Scenario: JSON-LD presente na página
- **WHEN** um crawler ou o Lighthouse analisa o HTML da página
- **THEN** existe um `<script type="application/ld+json">` com `@type: "Product"` e outro (ou mesmo objeto) com `@type: "FAQPage"`, ambos com campos obrigatórios preenchidos

#### Scenario: Rota no sitemap
- **WHEN** o sitemap do site é gerado
- **THEN** `/parceiros/clube-dos-dividendos` aparece com `priority: 0.8` e `changefreq: monthly`

---

### Requirement: Seção de FAQ com schema.org FAQPage
A página SHALL exibir ao menos 6 perguntas e respostas frequentes sobre a plataforma, formatadas em Accordion. O conteúdo do FAQ MUST estar refletido no JSON-LD `FAQPage`. Em mobile, cada item do Accordion SHALL ser facilmente tocável (min-height 44px na área clicável).

#### Scenario: Accordion FAQ abre e fecha
- **WHEN** o visitante toca/clica em uma pergunta do FAQ
- **THEN** a resposta correspondente é expandida; outras respostas podem permanecer abertas (multi-open permitido)

#### Scenario: FAQ em mobile tem área de toque adequada
- **WHEN** a página é renderizada em viewport < 768px
- **THEN** cada trigger do Accordion do FAQ tem altura mínima de 44px para conformidade com WCAG 2.5.5

---

### Requirement: Prova social (depoimentos e estatísticas)
A página SHALL exibir ao menos uma seção de prova social com: (a) 2–3 depoimentos de usuários (texto + nome/perfil, dados estáticos), (b) estatísticas da plataforma (ex: "X+ ações analisadas", "Y modelos de valuation", dados estáticos ilustrativos). Em mobile, os cards de depoimento SHALL usar scroll horizontal com snap (CSS scroll-snap) para evitar coluna muito estreita.

#### Scenario: Depoimentos em mobile com scroll horizontal
- **WHEN** a seção de depoimentos é renderizada em viewport < 768px
- **THEN** os cards de depoimento estão em um container com `overflow-x: auto` e `scroll-snap-type: x mandatory`, visualmente indicando que há mais cards para a direita

---

### Requirement: Layout mobile-first e acessibilidade
Todos os componentes da LP SHALL ser desenvolvidos mobile-first: estilos base definem o layout mobile e breakpoints `md:` e `lg:` aplicam ajustes para telas maiores. Nenhum elemento SHALL apresentar overflow horizontal em viewport de 320px. Todos os botões e links interativos SHALL ter `min-height: 44px`. Imagens SHALL ter atributo `alt` descritivo.

#### Scenario: Sem overflow horizontal em 320px
- **WHEN** a LP é renderizada em viewport de 320px de largura
- **THEN** nenhum elemento causa overflow horizontal (sem scroll horizontal na página)

#### Scenario: Botões com área de toque mínima
- **WHEN** qualquer botão ou link de CTA é inspecionado
- **THEN** a área clicável tem altura e largura mínimas de 44px

#### Scenario: Imagens com alt text
- **WHEN** a página é auditada pelo Lighthouse
- **THEN** todas as tags `<img>` e componentes `<Image>` do Next.js possuem atributo `alt` não vazio

---

### Requirement: Integração com sistema de atribuição de parceiro
O componente client da LP SHALL salvar o `partnerId` no `localStorage` com chave `partner_id` ao montar, sobrescrevendo qualquer valor anterior. Este comportamento MUST ser idêntico ao do `PartnerLpClient` existente para manter compatibilidade com o fluxo de checkout e cadastro.

#### Scenario: localStorage é gravado ao acessar a LP
- **WHEN** o componente client da LP do Clube dos Dividendos monta no navegador
- **THEN** `localStorage.getItem("partner_id")` retorna o UUID do parceiro `clube-dos-dividendos`

#### Scenario: Falha silenciosa quando localStorage está bloqueado
- **WHEN** o `localStorage` está indisponível (modo privado restrito)
- **THEN** a página renderiza normalmente sem lançar exceção nem exibir mensagem de erro ao usuário
