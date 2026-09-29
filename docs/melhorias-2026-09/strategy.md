# Preço Justo AI: estratégia de produto e plano de execução

Data: 29/09/2026 · Branch: `melhorias/ux-ui-mobile` · Autor: Head de Produto (consolidação de 4 auditorias: UX/UI, Mobile, Mercado financeiro/compliance e Simplificação/Arquitetura)

Documentos de apoio (na mesma pasta `scratchpad/`):
- `reports/ux-ui.md`: design system completo (tokens, tipografia, componentes). É a referência obrigatória dos programadores.
- `reports/mobile.md`, `reports/mercado-financeiro.md`, `reports/simplificacao.md`
- `backlog.json`: os lotes de trabalho executáveis, por onda.

Tudo foi analisado localmente (banco Docker e dev server `:3100`). **Nada tocou o banco de produção**, e o backlog proíbe explicitamente build, `prisma db push/migrate` e scripts contra o `.env`.

---

## 1. Resumo executivo

O Preço Justo AI tem **mais amplitude que qualquer concorrente na sua faixa de preço**: 8 modelos de valuation, score, IA (Ben), backtest, carteira, radar de dividendos, FIIs, ETFs e BDRs. Três problemas, porém, impedem que essa amplitude vire confiança e receita recorrente:

1. **Os números têm erros que um analista percebe em minutos.**
   - O FCD não desconta a dívida líquida.
   - O Gordon usa uma parcela avulsa como se fosse o dividendo anual.
   - O backtest conta os dividendos duas vezes.
   - A "Fórmula Mágica" usa 1/P/L.
   - As taxas de desconto (10–11%) estão abaixo da Selic (13,75%).
   - O ranking de dividendos exclui bancos e seguradoras.
   - O Sharpe usa taxa livre de risco zero.
   - A página de FII mostra DY de "0,09%" e um preço-teto que contradiz o próprio cabeçalho.
   - Credibilidade é o ativo central de um produto de valuation, e hoje ela está exposta.
2. **A apresentação parece "site gerado por IA" e esconde o valor.**
   - Há 683 gradientes, 359 linhas com emoji e sinais de confiança inventados ("4,8 · 1.250 avaliações", "87% dos investidores").
   - A fonte da marca nem carrega.
   - Popups aparecem em série.
   - No mobile, **25% da tela fica presa no topo** e o preço justo só aparece depois de ~1.300 px.
3. **Há risco regulatório barato de resolver.**
   - A UI usa "Compra", "Região segura para entrada", "Rentabilidade mínima garantida" e "Análise preditiva".
   - O prompt do Ben pede para dar "a recomendação".
   - Isso contradiz o disclaimer do rodapé e expõe a empresa às Res. CVM 20 e 19.

Além disso, a auditoria de arquitetura encontrou quatro problemas silenciosos:
- **O `src/middleware.ts` não roda.** Um arquivo no-op na raiz tem precedência, e com isso ficam desligados o rate-limit das APIs, o gate de `/admin` e o 410 do `/fundador` (o último commit não está valendo).
- **Dois endpoints públicos chamam o Gemini sem autenticação.**
- **`/ranking` e mais 8 páginas publicam a home como canonical.**
- **`/backtest` redireciona o Googlebot para o login.**

**A direção:** transformar o produto num **"terminal de análise sóbrio"**.
- Números corretos e auditáveis, com metodologia pública.
- Visual neutro, com uma cor de marca e **dark mode completo** (decisão do dono).
- Nenhuma interrupção automática.
- Mobile com a resposta principal na primeira dobra.
- Linguagem de dados, não de recomendação.

Em seguida, entram as features que fazem o investidor renovar:
- filtro de liquidez;
- método Bazin de verdade;
- Peter Lynch e valuation de bancos;
- alertas de preço-teto e de desconto;
- agenda de proventos;
- carteira que compara com CDI e IPCA.

---

## 2. Decisões do dono (respeitadas integralmente)

| Decisão | Como está no plano |
|---|---|
| **Dark mode completo é requisito** | Fundação na onda 0 (next-themes, tokens claro/escuro, toggle Claro/Escuro/Sistema). Cada lote migra seus arquivos para tokens e é testado em claro **e** escuro. O último lote (onda 3) verifica todas as rotas em escuro. Só então o toggle é exposto e o padrão passa a "Sistema". Até lá, o tema padrão é claro e o escuro só é ativado nos testes. |
| **Trial continua de 1 dia** | Nenhum lote altera o prazo. A recomendação do especialista de 7–14 dias foi descartada. Em troca, o onboarding do trial leva direto às features premium de maior impacto. |

---

## 3. Conflitos entre especialistas e o que decidi

| Tema | Posições | Decisão e motivo |
|---|---|---|
| Modal de e-mail "Avise-me" | UX: desligar o disparo automático. Mobile: disparar com 60% de scroll e bottom sheet | **Desligar o disparo automático.** Fica o card inline "Acompanhar PETR4" na página e o modal só abre por clique. É mais simples, evita a penalização do Google para interstitial no mobile e não bloqueia a página de maior tráfego orgânico. |
| Popup proativo do Ben | UX: remover. Mobile: pílula após 30 s | **Remover o popup proativo.** Fica só o botão flutuante, montado no layout apenas para quem está logado (isso elimina o 401 do anônimo). O Ben é apresentado uma única vez por um card inline no dashboard. |
| Ticker de índices | UX: só /dashboard e /indices. Mobile: home e /indices | **Estático (sem marquee), sem sticky, só em /dashboard e /indices.** Sai do layout global, então nunca aparece em login ou checkout. |
| Header mobile | Mobile: esconder ao rolar. UX: 56 px sólido | **56 px sólido, sem auto-hide.** Com o ticker e a faixa de busca fora, o topo já cai de 182 para 56 px. Auto-hide traz complexidade e imprevisibilidade. |
| Barra de ações fixa na página de ativo (mobile) | Mobile: barra fixa no rodapé. UX: ações no cabeçalho | **Ações no cabeçalho do ativo**, numa linha compacta. Para quem está logado já existe a bottom nav, e empilhar duas barras fixas consome a tela. |
| Bottom navigation | Proposta do Mobile | **Adotada** para quem está logado no mobile: Início · Radar · Buscar · Carteira · Mais. |
| Variante "premium" com gradiente no Button | Simplificação: criar. UX: proibir gradientes | **Não criar.** Os 40 botões com gradiente viram `default` (cor da marca). |
| "Margem de segurança" | Finanças: é 1 − P/VJ (hoje o app chama o upside de margem) | **Corrigido na UI e no motor:** "Margem de segurança" = 1 − P/VJ e "Potencial" = VJ/P − 1, com rótulos distintos. |
| Preços e plano Pro | Finanças: Premium a R$ 199/ano e Pro a R$ 399/ano | **Não mudar preço agora.** A decisão comercial é do dono e os preços vivem na tabela `offers` de produção. Corrigimos já as inconsistências da página (20%, "R$ 497", 7 × 8 modelos). A proposta segue na seção 6. |
| Abrir o plano grátis (indicadores livres) | Finanças: recomendado | **Adiado para decisão do dono.** Muda o gating (`usage-based-pricing-service`) e o funil. |
| Juntar /radar e /radar-dividendos | Finanças: juntar. Simplificação: manter as rotas e renomear | **Manter as rotas.** No menu, /radar vira "Meu radar" dentro do grupo Alertas e /radar-dividendos segue como conteúdo público de dividendos. |
| Hub único de alertas (4 superfícies) | Simplificação | **Por ora, só agrupar no menu** ("Alertas"). A fusão de rotas fica para depois. |
| `InterruptionProvider` com fila | Simplificação | **Versão mínima:** um helper `claimModalSlot()` garante no máximo um modal por página. As interrupções automáticas foram quase todas removidas, então não precisa de fila. |
| Tabelas no mobile | UX: rolagem com a 1ª coluna fixa. Mobile: cards em alguns casos | **Padrão: `DataTable` com a 1ª coluna fixa e sombra indicando rolagem.** Cards só onde há muitas colunas e uso de leitura, como as posições da carteira (11 colunas). |
| Service worker/PWA offline | Mobile: adicionar Serwist | **Adiado.** Exige validar num build de produção, e o build roda `prisma db push` em produção. Agora corrigimos manifest, ícones, viewport e safe-area. |

---

## 4. O que vamos mudar e por quê

### 4.1 Credibilidade dos números (maior prioridade de negócio)

| Correção | Impacto para o usuário |
|---|---|
| **FCD:** valor do acionista = EV − dívida líquida; Ke coerente com Selic/NTN-B (15–18% nominal); crescimento ligado ao histórico da empresa | Empresas alavancadas deixam de parecer baratas. Na UI, a ponte EV→Equity e o peso do valor terminal ficam visíveis. |
| **Gordon:** D0 = proventos dos últimos 12 meses (sem extraordinários); k ≥ Ke; spread k − g ≥ 4pp | Acaba o valor justo 4–12× errado nas pagadoras mensais e trimestrais. |
| **Backtest:** sem dupla contagem de dividendos e sem aplicar o DY atual ao passado | O retorno comparado ao CDI passa a ser real, sem inflar ≈ DY ao ano. |
| **Fórmula Mágica real:** EBIT/EV, soma de rankings, excluindo financeiras e utilities | Fica fiel ao método Greenblatt. |
| **Filtro de liquidez** em todos os rankings e screenings (ações ≥ R$ 1 mi/dia, FIIs ≥ R$ 500 mil/dia), com badge "Baixa liquidez" | Somem os "achados" inegociáveis (ex.: SOND3). |
| **"Lucros consistentes em 8 anos"** passa a funcionar (o campo não era carregado) | O filtro documentado finalmente vale. |
| **Bancos e seguradoras** avaliados por critérios próprios (ROE, P/VP, payout) e com um novo modelo P/VP justo | Entra o núcleo das carteiras de dividendos (BBAS3, ITUB4, BBSE3). |
| **Sharpe com CDI**, rentabilidade por cota (TWR) e XIRR, benchmark IPCA | Métricas de carteira no padrão de mercado. |
| **Overall Score:** pesos somando 1; dado faltante é neutro (e não aprovado); sentimento do YouTube sai da nota; priorização técnica desligada por padrão | A nota passa a ser defensável e mostra "baseada em X de Y critérios". |
| **FII:** DY ×100, preço-teto com a soma de 12 meses, DY-alvo por spread sobre a NTN-B | A página para de se contradizer. |
| **Premissas macro vindas do BCB (SGS)** em vez de busca web por LLM | São determinísticas e têm data. A metodologia mostra rf, ERP, Ke e a data. |

Todas as correções vêm com **testes unitários** (`node:test` via `tsx`, sem dependência nova) com os casos de aceite do especialista. Por exemplo: EV 100, dívida líquida 40 e 10 ações dão VJ de 6,0; 12 proventos de R$ 0,10 dão D0 de R$ 1,20.

> **Comunicação:** os rankings e preços justos vão mudar, alguns bastante. Recomendo publicar uma nota "Metodologia atualizada em <data>" no blog e na `/metodologia`, com o antes e depois dos principais modelos. Transparência vira argumento de venda.

### 4.2 Compliance (CVM e CDC)
- Sai "Compra", "Sinal de compra" e "Região segura para entrada". Entram "Abaixo do preço justo", "Acima do preço justo" e "Dentro da faixa estimada".
- Saem "garantida", "preditiva", "únicos no Brasil", "Encontre as melhores ações" e as estatísticas sem fonte.
- Sai o selo "4,8 · 1.250 avaliações" e o `aggregateRating` de **todos** os JSON-LD (home, layout, planos, comparador, índices), porque configuram risco de propaganda enganosa e de penalização do Google.
- O prompt do Ben passa a explicar sem recomendar e ganha um guardrail de recusa para "devo comprar X?".
- A IA deixa de gerar valor justo numérico ("AI Strategy") e passa a só sintetizar os modelos determinísticos.
- Todo preço justo, score e ranking ganha um disclaimer curto com link para a `/metodologia`.
- Um lint via grep no CI impede a volta desses termos.

### 4.3 Design system e dark mode
- **Fonte:** Geist corrigida e números tabulares.
- **Cores:** base neutra, uma única cor de marca (azul-tinta) e cores semânticas (positivo, negativo, atenção) **só** para variação e resultado.
- **Superfícies:** borda fina em vez de sombra; raios de 4, 6, 8 e 12 px.
- **Componentes novos:** `Stat`, `DataTable`, `PageHeader`, `SectionHeader`, `AssetHeader` e `ScoreCard`.
- **Números:** um único `lib/format.ts` pt-BR, que elimina "R$ 625.68B", "12.60%" e "N/A".
- **Dark mode por tokens** em tudo: gráficos via `--chart-*`, toasts, markdown da IA e logos.
- **Guarda-corpo:** `scripts/check-ui.sh` falha se voltarem gradiente, emoji, glass, sombra grande ou roxo.

### 4.4 Mobile e interrupções
- O topo fixo cai de 182 para 56 px, com a busca integrada ao header (sheet de tela cheia no mobile).
- Menu lateral sobre o Sheet do Radix, com área rolável real e itens de 48 px. Bottom nav para quem está logado.
- Alvos de toque de 44 px, inputs e textarea com 16 px (sem zoom no iOS).
- As 4 respostas (Preço · Preço justo · Margem · Score) ficam na primeira dobra em todos os tipos de ativo.
- Tabelas com a 1ª coluna fixa. Sem overflow nos resultados do screening e na carteira.
- PIX no celular com "Copiar código" primeiro.
- Manifest único e ícones reais.
- Interrupções: nenhuma automática. O exit-intent vira card não bloqueante, 1× a cada 30 dias, só no desktop e nunca no checkout.

### 4.5 Páginas (resumo)
- **Home:** passa de 15,7 mil para ≤ 6 mil px no desktop. É product-led, com busca de ticker como ação principal, screenshots reais, um único FAQ e o CTA final visível (hoje o botão secundário é invisível). Quem está logado vai para o dashboard.
- **Página de ação:** cabeçalho com 4 números e valuation em tabela, sem accordions coloridos. Uma grade única de indicadores com a média de 7 anos (de ~3.000 px para ≤ 1.200 px no mobile). Nav interna sticky e IA com escala de texto contida.
- **FII, ETF e BDR:** o mesmo cabeçalho e o mesmo score; ticker nunca truncado.
- **Dashboard:** dados, sem marketing interno nem upsell para quem já paga.
- **Ranking e Backtest:** abrem direto na ferramenta, sem tela intermediária.
- **Screening:** dois painéis com resultados ao vivo e IA inline (sem modal inacessível); o bug dos filtros de setor é corrigido.
- **Comparador:** tabela única, sem medalhas. ETFs viram uma aba e `/comparador-etfs` redireciona.
- **Planos:** os 3 preços acima da dobra, neutros e sem emoji, com uma única âncora de preço.
- **Institucionais:** o blog abre com os artigos e a metodologia vira documentação com índice e fórmulas.

### 4.6 Arquitetura, SEO e segurança
- **Middleware:** remover o `middleware.ts` da raiz para ligar o `src/middleware.ts` (rate-limit, `/admin`, 410 do `/fundador`, `/upgrade`, tickers em minúsculas).
- **Gemini:** fechar os endpoints públicos (as funções vão para `src/lib/ai`) e remover `/api/debug/user-status`, que escreve no banco.
- **Canonical e títulos:** canonical próprio em cada página; `/ranking` como server component com metadata; template de título sem a marca duplicada.
- **Backtest:** `/backtest` passa a ser público para anônimos (landing) e `/backtesting-carteiras` redireciona com 308. Idem para `/comparador-etfs`.
- **Estados de carregamento e erro:** `loading.tsx` com skeleton nas rotas pesadas e um `error.tsx` na raiz.
- **Limpeza:** remoção de ~7,4 mil linhas de código morto (35 arquivos, confirmados por grafo de imports) e de 5 dependências não usadas.

---

## 5. Posicionamento

**"O analista quantitativo do investidor pessoa física: valuation transparente com 8+ modelos, premissas ligadas à Selic e à NTN-B do dia, e alertas quando o preço entra na sua zona."**

O diferencial defensável é **transparência, premissas vivas e multimodelo**: ninguém no varejo mostra o FCD com Ke ligado à NTN-B e a ponte EV→Equity. Ele só se sustenta depois das correções da seção 4.1, por isso elas vêm antes de qualquer feature nova.

---

## 6. Preço e valor

### 6.1 Onde estamos

| Plataforma | Preço anual | O que faz renovar |
|---|---|---|
| **Preço Justo AI** | R$ 189,90 (R$ 19,90/mês; −15% no PIX) | Multimodelo, IA, backtest (uso episódico) |
| Investidor10 PRO | R$ 238,80 | Carteira + IR/DARF + alertas + preço-teto + app |
| Status Invest | R$ 262,80 (Essencial) a R$ 385,20 (Profissional); IR +R$ 365 | Importação B3, dividendos futuros, IR |
| Kinvo Premium | R$ 179,90 | Consolidação de carteira vs benchmarks |
| Fundamentus / Gorila | Grátis | Indicadores / consolidação |

**Leitura:**
- **O PJA não é caro.** O problema é o **mix de valor**: entregamos features de aquisição (modelos, IA, backtest), mas não os **hábitos que retêm**, que são agenda de proventos, alertas de preço-teto, carteira com proventos comparada ao CDI/IPCA e IR.
- **O plano grátis é mais fechado que o dos concorrentes** (3 páginas de empresa por mês). Isso reduz SEO, engajamento e confiança antes da compra.

### 6.2 Recomendação (para decisão do dono, fora deste ciclo)

| Plano | Proposta | Conteúdo |
|---|---|---|
| Grátis | R$ 0 | Todos os indicadores na página de ativo (abrir o limite de 3/mês); Graham e Bazin visíveis; top 10 do ranking; 1 carteira; 3 alertas; agenda só da watchlist |
| Premium | R$ 24,90/mês · **R$ 199/ano** | Todos os modelos; rankings e screening ilimitados; liquidez; alertas ilimitados; agenda completa; carteira com proventos e TWR vs CDI/IPCA; backtest; Ben com cota generosa |
| Pro (novo) | R$ 44,90/mês · **R$ 399/ano** | Premium + IR/DARF, Ben ilimitado, exportações, backtest avançado, relatório mensal |

- **Trial:** continua de 1 dia (decisão do dono). Para o valor aparecer em 24 h, o onboarding do trial leva direto a: valuation completo de um ativo da watchlist, criação de um alerta de preço-teto e ranking Bazin/Gordon.
- **Renovação:** e-mail mensal "sua carteira vs CDI/IPCA, proventos recebidos e a receber, ativos que entraram na sua zona de preço-teto", além de um "extrato anual de valor" antes da renovação.
- **Sequência sugerida:**
  1. Este ciclo entrega os hábitos: alertas, agenda, carteira com proventos e CDI/IPCA.
  2. Depois disso, reajustar o Premium para R$ 199/ano (novos assinantes) e abrir o plano grátis.
  3. Lançar o Pro quando o IR/DARF estiver validado com um contador.

Mudar o preço antes de entregar os hábitos só piora a percepção de valor.

---

## 7. Roadmap de execução (ondas)

Os lotes rodam em paralelo na mesma árvore de trabalho, cada um com arquivos exclusivos (sem sobreposição dentro da onda). Cada lote é validado com `npx tsc --noEmit`, `eslint` nos arquivos tocados, `scripts/check-ui.sh`, testes unitários quando houver lógica, e screenshots locais em 360/390 px e 1440 px, **claro e escuro**, anônimo e premium.

### Onda 0: fundação (1 lote, roda sozinho)
- **Tema:** tokens do design system (claro e escuro), fonte Geist, next-themes com toggle ainda oculto.
- **Componentes:** primitivos shadcn ajustados (Button, Badge, Card, Tabs, Input, Select, Textarea, Dialog, Table, Sheet, Popover); componentes novos `Stat`, `SectionHeader`, `PageHeader`, `DataTable`, `AssetHeader`, `ScoreCard` e `InfoHint`; `lib/format.ts` pt-BR.
- **Casca e navegação:** header com busca, menu mobile sobre o Sheet, bottom nav, rodapé e `navigation.ts` único.
- **Interrupções:** e-mail, Ben e exit-intent.
- **Apoio:** logo com monograma, `check-ui.sh`, script de screenshots com `--theme`.

### Onda 1: páginas (12 lotes em paralelo)
Ação (cabeçalho e valuation) · Indicadores, demonstrações e IA · FII/ETF/BDR · Análise técnica e radares · Home, planos e checkout · Dashboard, alertas e notificações · Conta, Ben e onboarding · Carteira · Ranking · Backtest · Screening e comparador · **Fundação financeira** (helpers puros testados: proventos TTM/anos completos, margem, liquidez, setor financeiro e utilities, premissas macro via BCB).

### Onda 2: correção financeira, features e plataforma (9 lotes em paralelo)
1. Núcleo de valuation (FCD, Gordon, Graham, Fórmula Mágica, P/L baixo, critérios de dividendos por tipo de negócio, rótulos de margem e potencial).
2. Rankings e novos modelos (liquidez, lucros consistentes, Barsi com anos completos, **Bazin**, **Peter Lynch**, **P/VP justo para bancos**, badge de liquidez).
3. Score, compliance e FII.
4. Retornos (backtest sem dupla contagem, Sharpe com CDI, TWR/XIRR, IPCA).
5. **Agenda de proventos** com exportação ICS, projeção estatística no lugar do LLM, proventos da carteira e renda mensal projetada.
6. **Alertas** de preço-teto, desconto vs modelo e DY.
7. Plataforma, SEO e PWA (middleware, endpoints de IA, canonical, redirects, manifest/ícones, gtag único, loading/error).
8. Ferramentas de mercado (índices, P/L da bolsa, setorial, projeções, calculadoras + índice de `/calculadoras`).
9. Institucionais, blog, auth e `/metodologia` como documentação com premissas vivas.

### Onda 3: acabamento (2 lotes)
- Remoção de código morto e dependências, erros de ESLint, lint de compliance no CI.
- **Verificação final do dark mode** em todas as rotas; ativação do toggle e do padrão "Sistema"; QA mobile final contra os critérios de aceite.

---

## 8. Adiado (e o que é preciso para destravar)

| Item | Por que ficou fora | O que destrava |
|---|---|---|
| Reestruturação de preços / plano Pro | Decisão comercial; preços na tabela `offers` de produção | Decisão do dono após a entrega dos hábitos |
| Abrir o plano grátis | Muda o funil | Decisão do dono (recomendado) |
| IR/DARF (preço médio, isenção de R$ 20 mil, compensação, DARF, relatório anual) | Esforço grande e regras de 2026 (Lei 15.270, JCP a 17,5%) | Validação com contador; vira o plano Pro |
| Importação B3 / CEI | Integração externa | Credenciamento/API B3 ou parser de nota de corretagem |
| BDR: conversão de LPA/VPA por câmbio e paridade | Precisa confirmar com o dado real (AAPL34) | Leitura manual e autorizada em produção, ou uma cópia do banco |
| Units (TAEE11, KLBN11…): LPA/VPA por ação vs por unit | Idem | Idem |
| Classificação setorial B3 determinística (coluna nova) | Exige migração do banco e reprocessamento | O dono aplica a migração aditiva; enquanto isso, mapeamento por dicionário |
| Histórico de múltiplos (bandas de P/L, P/VP, EV/EBITDA, DY) | P2; ciclo cheio | Próximo ciclo (os dados já existem) |
| Premissas editáveis + matriz de sensibilidade k × g | P2 | Próximo ciclo, sobre o núcleo corrigido |
| FII: vacância física/financeira, inadimplência, WALT, recorrência | Faltam dados no schema | Nova fonte de dados |
| Service worker / PWA offline | Exige validação em build de produção | Pipeline de preview na Vercel |
| Fusão de rotas de alertas num hub | Baixo risco, mas não urgente | Próximo ciclo |
| Destino de `/analisar-acoes` (órfã) | Depende de dados do GSC e do Ads | O dono consulta o tráfego; se for baixo, 301 → `/` |
| Rotas de API sem referência (27) | Algumas são chamadas de fora | Conferir os logs da Vercel antes de cortar |
| Limpeza dos 426 warnings de imports não usados | Toca centenas de arquivos e colide com o trabalho paralelo | Rodar depois do merge, num PR isolado |
| Agendar o cron de premissas macro no `vercel.json` | Deploy | O dono adiciona o schedule (o endpoint vem pronto) |

---

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Algum comando atingir o banco de produção | O backlog proíbe build, `db push`, scripts e psql contra o `.env`. Todo comando com banco exporta `DATABASE_URL`/`DIRECT_URL` locais inline. O seed local recusa hosts que não sejam localhost. |
| Ligar o middleware ativa o rate-limit e redirects que estavam desligados | Testar no dev local (`/upgrade`, `/fundador`, `/acao/PETR4`, carga de `/api/*`). Antes e depois do deploy, confirmar em produção com `curl -I` (somente leitura). |
| Mudança de números altera rankings e preços justos já vistos pelos usuários | Nota pública "Metodologia atualizada" e testes com os valores de referência. |
| Lotes paralelos quebrarem o `tsc` uns dos outros | Arquivos exclusivos por lote; cada lote corrige só os próprios erros. Contratos (tipos e helpers) são criados antes, na onda 0 ou na fundação financeira. |
| Dark mode parcial vazar para o usuário | O toggle fica oculto e o padrão é claro até a verificação final da onda 3. Admin e /oferta ficam forçados em claro. |
| Redirects de SEO | Só 308 permanentes para rotas indexadas; nada do sitemap é deletado. |

---

## 10. Como medir sucesso

- **Qualidade:**
  - zero termos de recomendação na UI (lint);
  - testes financeiros verdes;
  - `grep bg-gradient-to src` cai mais de 90%;
  - zero emoji na UI;
  - nenhuma tela com ponto decimal, sufixo "B" ou "N/A";
  - `document.fonts` com a Geist carregada.
- **Mobile:**
  - topo fixo ≤ 56 px;
  - as 4 respostas do ativo em y < 640 a 360×740;
  - home com ≤ 18 telas no mobile e ≤ 6.000 px no desktop;
  - nenhum overflow a 320, 360 e 390 px;
  - nenhum overlay nos primeiros 10 s.
- **Negócio (acompanhar no GA/Clarity após o deploy):**
  - conversão de trial para pago;
  - retenção em 30 dias;
  - alertas criados por usuário;
  - uso da agenda;
  - renovação anual;
  - tráfego orgânico de `/ranking` e `/backtest` após a correção dos canonicals.

## Adendo (29/09) — "Onde aportar" vira a premissa central
Decisão do dono: a plataforma deve deixar claro **onde alocar capital novo** ("tenho R$ 2.000 e estas ações/esta carteira — qual o melhor ativo para este aporte?"). Diagnóstico: hoje existe uma sugestão de aporte escondida na carteira, que prioriza apenas a distância do peso-alvo e ignora valuation. Nova onda 3 (lote `w3-onde-aportar`, roda sozinha após as correções de valuation da onda 2): motor determinístico e testado (desconto vs. valor justo nos modelos escolhidos + qualidade + distância do alvo, com travas de liquidez, concentração e fundamentos intactos), tela `/onde-aportar` com o "por quê" de cada ativo e de cada exclusão, integração com carteira, dashboard e home, e e-mail mensal "Seu aporte do mês" (cron não ativado — o dono ativa). Enquadramento CVM: calculadora que aplica os critérios e o universo escolhidos pelo usuário; nunca "recomendamos". A limpeza e o QA final de dark mode passam para a onda 4.
