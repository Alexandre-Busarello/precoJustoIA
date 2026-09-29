# Auditoria Mobile UX — Preço Justo AI

**Escopo:** web responsiva e PWA. Foco em alcance do polegar, tabelas legíveis em tela pequena e performance num Android intermediário em 4G.
**Branch:** `melhorias/ux-ui-mobile` · **Data:** 29/09/2026 · **Ambiente:** somente local (`localhost:3100` + Postgres Docker `:55432`). Nenhum build, nenhuma escrita em produção, nenhum commit. IA, pagamentos, e-mail, cron e admin ficaram bloqueados no navegador.

---

## 1. Como a auditoria foi feita

1. **Todas as 82 capturas mobile do baseline** (41 rotas × anon/premium, 390×844, página inteira) foram lidas. As páginas longas foram fatiadas em blocos de 1500 px (134 folhas).
2. **Auditoria automatizada no Playwright** em **360×740** (Android intermediário típico: DPR 2, toque, UA de Android Chrome), com 23 rotas × 2 modos (`scratchpad/mob/audit.mjs`). Para cada página, o script mede:
   - quantidade de telas;
   - alvos de toque com menos de 44 px e com menos de 24 px;
   - inputs com fonte abaixo de 16 px;
   - containers com scroll horizontal;
   - quanto do topo fica preso depois do scroll (elementos sticky/fixed);
   - elementos fixos no rodapé;
   - imagens superdimensionadas.

   Resultado em `scratchpad/mob/audit/metrics-360x740.json`, com capturas "scrolled" em `scratchpad/mob/audit/*.png`.
3. **Capturas específicas** (`scratchpad/mob/special.mjs`, saída em `scratchpad/mob/special/`):
   - menu aberto (anon e premium);
   - primeira dobra de ação, FII e dashboard;
   - popup e chat do Ben;
   - toque em tooltip;
   - detalhe da carteira;
   - resultados do screening;
   - formulário do backtest;
   - largura de 320 px;
   - manifest/PWA.

   O ranking só foi aberto até o passo 1 do wizard. O modelo liberado era apenas Graham, com o endpoint de IA bloqueado.
4. **Leitura de código** do header, drawer, footer, Ben, ticker, busca global, componentes de tabela e tabs, modais, checkout/PIX, manifest, layout e next.config.

> Aviso sobre os números: o drawer fechado continua no DOM, fora da tela. Por isso as contagens de "alvos <44 px" incluem cerca de 5 itens dele em todas as páginas. As contagens servem para comparar páginas entre si, não como valor absoluto. O peso de JS medido vem do servidor de dev (sem minificação), então só serve como comparação relativa.

---

## 2. Resumo executivo

A base está sólida: **nenhuma página tem overflow horizontal a 360 px**, todos os inputs usam 16 px e muitos componentes já têm variante mobile (cards no screening e no ranking, rank por indicador no comparador). Mesmo assim, **a primeira dobra mobile está sequestrada**:

| Problema | Evidência |
|---|---|
| **182 px de "cromo" fixo no topo** (header 81 + ticker 40 + busca 61) = **25% da altura útil a 360×740**, em **todas** as rotas e nos dois modos | `STICKY` mediu 0‑81‑121‑182 em 42/42 páginas |
| **Popup do Ben cobre o hero** (preço, ticker, score) em **toda** página de ativo e no dashboard do premium: card de 320×373 px no meio da tela, que volta a cada 1 h | `special/first-sheet.png`, baseline premium `acao_petr4`, `fii_hglg11`, `etf_bova11`, `bdr_aapl34`, `radar`, `dashboard`, `analise-tecnica`, `radar-dividendos_petr4`, `indices_ipj-value` |
| **Modal "Avise-me" bloqueia a ação para o anônimo** 6 s depois de carregar. Reaparece em **todo ticker e toda visita**: fechar não é lembrado, só o envio | `src/components/email-capture-modal.tsx:39-48` |
| **Páginas longas demais** a 360 px: home **35,7 telas**, radar de dividendos 27,3, planos 20,4, ação 19,7, comparador 18,8, screening (anon) 17 | tabela §4 |
| **Resposta principal fora da dobra**: na página de ação, o "Preço Justo / upside" aparece depois de ~1,3 k px (logo de 80 px centralizado, card de notificação e botões vêm antes) | baseline `acao_petr4__0` |
| **Alvos de toque pequenos** por padrão: `Button` do shadcn tem 36 px (default), 32 px (sm) e 36 px (icon); `Input` tem 36 px. Os "i" dos indicadores têm **20×20 px** (41 por página de ação), o `InfoTooltip` tem **14×14 px**, o "Remover ticker" do radar tem **12×12 px** | `src/components/ui/button.tsx:24-28`, audit |
| **Menu do usuário logado quase inutilizável**: área rolável de **223 px** para 1374 px de conteúdo, porque o bloco fixo "Acompanhamentos" ocupa ~330 px no rodapé do drawer | `special/menu-premium.json`, `menu-sheet.png` |
| **Overflow real em telas internas**: resultados do screening com largura de **534 px** a 360; detalhe da carteira com **379 px**; ação e compara-ações estouram em 320 px (336 e 347 px) | `special/screening-results-*`, `carteira-detail-*`, `w320-*` |
| **PWA quebrado**: dois manifests conflitantes, ícones 404, "maskable" apontando para um logo 553×135, apple-touch-icon = `favicon.ico`, sem service worker | `src/app/layout.tsx:122-125`, `src/app/manifest.ts`, `public/site.webmanifest` |

---

## 3. Achados por área

### 3.1 Cromo global (header, ticker, busca)
- `src/components/header.tsx:43`: header `sticky top-0` com `py-4` e logo `h-12`, ou seja **81 px**. O ideal no mobile é 56 px.
- `src/components/indices/market-ticker-bar.tsx:336`: a classe contém **ao mesmo tempo `sticky` e `relative`**; na prática fica sticky (40 px presos). O marquee roda `animation: scroll-ticker 60s linear infinite` sem `prefers-reduced-motion`: repinta sem parar, gasta bateria e ainda ocupa um alvo de toque de 24 px de altura. **O anônimo não consegue fechar** (o botão X só existe com `session`).
- `src/components/global-search-bar.tsx:61-68`: a busca também é sticky (61 px) e calcula o `top` via JS (`isMobile` com listener de `resize`, 81/121 px). Isso dá flash na hidratação e acopla a busca à altura do ticker.
- `backdrop-blur-md` no header e na busca: `backdrop-filter` em camadas sticky custa caro no scroll de GPUs Mali/Adreno de entrada.
- O botão do menu (`src/components/mobile-nav.tsx:858-876`) tem **36×36 px** e trata `onTouchEnd` junto com `onClick`. Um `touchend` no fim de um scroll que começou sobre o botão também alterna o menu.

**Proposta:** no mobile, header de 56 px com hide-on-scroll-down/show-on-scroll-up. Ticker **não sticky**, estático só na home e em /indices, ou recolhível para qualquer usuário. A busca vira um **ícone de lupa no header** que abre um sheet de busca em tela cheia (com `inputmode="search"`, `enterkeyhint="search"` e resultados grandes). Com isso, 182 px viram cerca de 0–56 px.

### 3.2 Drawer de navegação (`src/components/mobile-nav.tsx`)
- Largura fixa `w-80` e altura `h-full` (sem `100dvh`). Sem `role="dialog"`, `aria-modal` nem focus trap. O overlay usa `onTouchEnd` com `preventDefault`.
- **Logado:** o rodapé fixo (Minhas Inscrições, Monitoramentos, Conversas com Ben, Perfil, Suporte, Sair) com o cartão do usuário no topo deixa **223 px** de área rolável a 740 px de altura. Os links principais (Radar, Screening, Ranking) ficam enterrados em 3 colapsáveis.
- Itens do rodapé usam `size="sm"`, com **32 px** de altura.
- O drawer tem o mesmo `z-50` do FAB do Ben e do header.

**Proposta:** mover "Acompanhamentos" para dentro do scroll (ou para o Perfil). Usar o `Sheet` do Radix (que já traz foco, Esc e aria) com `side="left"` e `w-[85vw] max-w-80`. Itens com no mínimo 48 px.

### 3.3 Bottom navigation (oportunidade)
Para o usuário logado, o app é "tool-first", e hoje tudo exige menu mais colapsável (3 toques). Sugiro uma **bottom nav de 5 itens**, só no mobile e só logado: **Início (dashboard) · Radar · Buscar · Carteira · Mais**. Altura de 56 px mais `env(safe-area-inset-bottom)`. Com ela, o FAB do Ben sobe acima da barra ou vira o item "Ben" dentro do "Mais". Isso também resolve o "Buscar" que sai do topo.

### 3.4 Ben (FAB e popup proativo)
- `src/components/ben-proactive-popup.tsx:106-110`: card `fixed bottom-20` com `w-[calc(100vw-2rem)] max-w-[320px]` e 373 px de altura. Aparece 2–3 s após o carregamento e **cobre o hero** de ação, FII, ETF e BDR, a análise técnica, o dashboard, o radar, os índices e o radar-dividendos/ticker (20 páginas no baseline).
- O botão "Começar conversa" **desmorona para 20 px de altura** no mobile: `flex-1` num contêiner `flex-col` (linha 153). O X de fechar tem 24×24 px (`h-6 w-6`, linha 133).
- `useBenProactivePopup()` roda **antes** do `if (!session) return null` (`src/components/ben-chat-fab.tsx:19-24`), o que gera o 401 em `/api/ben/interactions` para o anônimo em toda página de ativo.
- O FAB (`src/components/ben-chat-fab.tsx:51-66`) fica em `fixed bottom-4 right-4`, 56×56 px, sem safe-area. Ao rolar, cobre o canto inferior direito dos cards (chevrons, "Ver detalhes", valores alinhados à direita).
- No chat aberto, o `SheetContent` é `w-full`: bom. Mas o **X do Sheet se sobrepõe ao botão "+"** no topo, e o textarea do chat usa **14 px, o que dispara zoom no iOS** (medido: `ben textarea font 14px`, `src/components/ben-chat-sidebar.tsx:973`).

**Proposta:** no mobile, o popup vira uma **pílula de uma linha** acima do FAB ("Pergunte ao Ben sobre PETR4") ou um toast inferior. Só mostrar depois de 30 s ou 50% de scroll, e no máximo 1× a cada 7 dias. Trocar `flex-1` por `w-full sm:flex-1`. Mover o hook para dentro de um componente que só monta com sessão. FAB em `bottom-[calc(1rem+env(safe-area-inset-bottom))]`, que recolhe durante o scroll para baixo.

### 3.5 Modais e interstitials
- **Email capture** (`src/components/email-capture-modal.tsx:46-48`): abre depois de 6 s, em todo ticker. Fechar não persiste nada (`localStorage` só guarda em caso de envio). No mobile é um **interstitial intrusivo** (penalizado pelo Google em mobile) e bloqueia a leitura justamente na página de maior tráfego orgânico. O input `type="email"` não tem `autoComplete="email"`.
  **Proposta:** gatilho por scroll (≥60%) ou intenção. Registrar o fechamento por 7 dias, de forma global e não por ticker. No mobile, usar um bottom sheet parcial (até 50% da tela) em vez de modal central.
- **Assistente de IA do screening** (`src/components/screening-ai-assistant.tsx:138-145`): modal próprio sem `role="dialog"`, sem Esc e com um X sem label.
- **Dialog base** (`src/components/ui/dialog.tsx:72`): o botão de fechar é um ícone de 16 px sem padding (menos de 24 px de alvo).
- O exit intent em /planos só dispara no desktop (mouseleave). Ok.

### 3.6 Landing (`src/app/page.tsx`)
- **35,7 telas a 360 px.** Há **duas seções "Perguntas Frequentes"** (`src/app/page.tsx:935` e `:1100`) com perguntas repetidas, todas **abertas** (cards, não accordion: `src/components/landing/faq-section.tsx:84`). A seção de preços começa em ~11,7 k px (anon), cerca de 16 telas.
- **CTA secundário invisível**: nas faixas gradiente "Pronto para encontrar…", o botão "Ver demonstração" aparece como um retângulo branco vazio (texto branco sobre `bg-background` do variant `outline`). Afeta home, planos, screening-acoes/fiis, blog e metodologia. Causa em `src/components/landing/cta-section.tsx:111-114`: falta `bg-transparent text-white`.
- O placeholder da busca global é truncado ("Buscar empresa por ticker (ex: PE").
- O footer (`src/components/footer.tsx:13`) usa `grid-cols-1` no mobile: são ~1300 px de links numa coluna só (cerca de 2 telas por página). Links inline com 24 px de alvo. O copyright ainda diz "© 2025".

**Proposta:** FAQ em `<details>`/Accordion e só uma vez. Footer em `grid-cols-2` com accordion por seção. Hero com preço e CTA na primeira dobra. Cortar ou colapsar os blocos repetidos (features × modelos × "por que escolher" contam a mesma história).

### 3.7 Página de ação (`src/app/acao/[ticker]/page.tsx`)
- A primeira dobra a 360×740 mostra o cromo (182 px), o card com **logo de 80 px centralizado**, o ticker e o preço. Depois vêm "Avise-me" (card grande), os botões e o setor. O **Preço Justo / upside** e o score só aparecem depois de ~1,2–1,3 k px (linhas 672-700 e 866-900).
- `src/components/strategic-analysis-client.tsx:542-570`: `TabsList grid-cols-4` com **tabs só com ícone no mobile** (`hidden sm:inline` nos rótulos), tabs de 36 px e ícones sem significado claro.
- Os badges "89% dos critérios" disputam espaço com o título do modelo, que quebra em 4 linhas ("Fluxo de Caixa Descontado (FCD)").
- **Indicadores** (`src/components/financial-indicators.tsx:330-336`): 25+ cards de 150 px em coluna única (cerca de 5 telas). O "i" é um `<button>` de **20×20 px sem `type="button"`** (vira `submit` por padrão). Há 41 atributos `title` na página, que não servem para nada no toque.
- A tabela "Evolução anual" (`ComprehensiveFinancialView`) tem **900 px de largura** num contêiner de 326 px, sem coluna fixa e sem indicação de scroll. As colunas depois de "Lucro Líq." somem.
- O relatório de IA usa `prose prose-lg` (`src/components/markdown-renderer.tsx:15`), e o H1 do Markdown sai com **~45 px, 7 linhas** no mobile.
- A 320 px, a página estoura para 336 px.

**Proposta:** um **hero compacto no mobile**, com logo de 40 px ao lado do ticker, nome em 1 linha e uma grade 2×2: Preço · Preço justo · Upside · Score. "Avise-me", "Comparar" e "Backtest" viram uma **barra de ações fixa no rodapé** (3 botões de 48 px, com safe-area). Indicadores em **grade de 2 colunas compacta** (~72 px cada), com o toque no card inteiro abrindo o modal explicativo. Tabs com rótulo curto embaixo do ícone (text-[11px], h-12).

### 3.8 Tabelas → cards / coluna fixa
| Onde | Situação | Proposta |
|---|---|---|
| Planos, tabela comparativa (`src/app/planos/page.tsx:124-131`) | 565 px em 328, **só a coluna "Gratuito" aparece**; Premium fica cortado ("Pre Me") e não há dica de scroll | No mobile: seletor de plano (segmented Grátis/Mensal/Anual) com uma coluna de valores, ou lista por recurso com 3 ícones compactos (colunas de 56 px, cabeçalho sticky) |
| Compara-ações, "Comparação detalhada" (`src/components/comparison-table.tsx:394,461-475`) | A coluna sticky ocupa ~65% da largura por causa da descrição e do `whitespace-nowrap` do TableCell; os valores ficam cortados | Coluna sticky `w-[112px] whitespace-normal`, descrição `hidden sm:block`, valor com `tabular-nums` |
| Compara-ETFs (`src/app/compara-etfs/[...tickers]/page.tsx`) | Mesmo padrão; valores cortados ("92/100", "+157.2%") | Idem |
| Carteira, posições (`src/components/portfolio-holdings-table.tsx:275-290`) | **11 colunas**, sem coluna fixa; o título da página estoura (379 px) e as tabs são cortadas | No mobile, card por posição: ticker, valor atual, retorno %, alocação; o resto num expansível |
| Análise técnica, tabs (`src/components/technical-analysis-page.tsx:565`) | `grid-cols-4` com `whitespace-nowrap`: **rótulos sobrepostos** ("IndicaSuporte/ResistênFibonacci") | `flex overflow-x-auto snap-x` com tabs `shrink-0`, ou rótulos curtos (Indic., S/R, Fibo, Ichimoku) |
| Índices, tabs (`src/app/indices/[ticker]`) | "Performance Composição Individual Diári" cortado, sem affordance | Scroll com fade na borda e snap |
| Screening, cards de resultado (`src/components/screening/screening-hub-page.tsx:896-945`) | Os cards **estouram para 534 px**: filhos do grid 2-col sem `min-w-0`, e market cap bruto "29.338.560.000.000". As chaves aparecem cruas (`marketCap`, `grahamUpside`, `fcdUpside`), e o topo mostra "Status: Nenhum filtro ativo" logo acima de 27 resultados | `min-w-0 break-words`, formato compacto (R$ 29,3 tri), mapear rótulos em `translateMetricName`, esconder o racional vazio |

A tabela `Table` base do shadcn impõe `whitespace-nowrap` nas células. Vale criar uma variante `ResponsiveTable` com coluna sticky e sombra de borda, que indique o scroll.

### 3.9 Radar de dividendos
- `src/components/dividend-radar-grid.tsx:244-265`: cada empresa tem um grid de 12 meses em cards de 80 px (~540 px por empresa); 20 empresas dão 19 k px (27 telas anon). Muitos grids ficam vazios.
- Os detalhes de cada provento estão num **Tooltip Radix com gatilho `<div>`**, só por hover: **no toque não abre** (div não focável e sem onClick). Data-com e data de pagamento ficam inacessíveis no celular.

**Proposta:** uma **faixa horizontal de 12 pontos** (uma linha de ~48 px por empresa, com o valor do mês atual e do próximo), e o toque na linha abre um bottom sheet com o detalhe. Trocar o Tooltip por Popover.

### 3.10 Tooltips e hover
- `src/components/info-tooltip.tsx`: alterna com onClick (funciona no toque), mas o alvo tem **14×14 px**.
- O radar-dividendos usa tooltip só por hover (ver acima).
- `title=` é usado como fonte de informação (41 na ação, 38 no radar): no toque, isso não existe.

**Proposta:** padronizar num `<InfoHint>` baseado em Popover, com área de toque de 44×44 px (`p-3 -m-3` em volta do ícone de 16 px).

### 3.11 Formulários
- `Input` base: `h-9` (36 px) com `text-base md:text-sm`. A fonte está ok, mas a altura está abaixo de 44 px.
- `Textarea` base (`src/components/ui/textarea.tsx:12`): **`text-sm` fixo**, o que **dispara zoom no iOS** em todos os 23 usos (chat do Ben, contato, suporte, entrada inteligente da carteira).
- Inputs de valor (calculadoras, backtest "Capital Inicial", "Aporte Mensal") não usam `inputMode="decimal"` e os "Ex: 10.000,00" são texto livre.
- Backtest (`special/backtest-form-full.png`, 11,5 k px a 720 de DPR 2, ou seja ~7,7 telas): formulário longo sem stepper. "Executar Backtesting" fica no fim, sem botão fixo, e as tabs Configs/Config/Result/Execuç. ficam cortadas.
- Wizard do ranking: o conteúdo do passo 1 começa em y≈490 de 740 (por causa do cromo e do banner "Rankings de Ações"), e o botão de avançar fica abaixo da dobra.

**Proposta:** `Textarea` com `text-base md:text-sm`, `Input` e `SelectTrigger` com `h-11 md:h-9`, `inputMode="decimal"` com máscara BRL, e **CTA primário fixo no rodapé** em wizards e formulários longos (backtest, ranking, screening "Buscar empresas").

### 3.12 Planos e checkout
- O card "Premium Anual" tem `scale-105` também no mobile (`src/components/landing-pricing-section.tsx:151`) e encosta na borda da tela. Os 3 cards somam ~3 k px e a seção começa com "Apoie o projeto…" antes de qualquer preço.
- **PIX no celular** (`src/components/optimized-pix-payment.tsx:236-262`): o título é "Escaneie o QR Code" e o QR vem primeiro. No celular o usuário **não consegue escanear a própria tela**: o botão "Copiar código" deve ser o CTA primário, em largura total no topo, com o QR recolhido ("Pagar em outro aparelho").
- O Stripe CardElement já usa `fontSize: '16px'`. Ok.

### 3.13 PWA, viewport e ícones
- Nenhum `export const viewport`, então o Next injeta só `width=device-width, initial-scale=1`. Falta `viewportFit: 'cover'` para `env(safe-area-inset-*)` e não há **nenhum** uso de `safe-area-inset` no código.
- `layout.tsx:125` aponta para `/site.webmanifest`, e o Next também serve `/manifest.webmanifest` (`src/app/manifest.ts`): **dois manifests no `<head>`**. O `site.webmanifest` referencia `/android-chrome-192x192.png` e `-512x512.png` → **404**. O `manifest.ts` declara `logo-preco-justo.png` (553×135) como 192×192 **maskable** e 512×512, e usa o mesmo logo como *screenshots* 1280×720 e 750×1334.
- `apple-touch-icon` = `favicon.ico` (16/32 px), então o ícone no iOS fica borrado. Não há `sw.js` nem service worker, logo não é instalável no Chrome Android e não funciona offline.
- `theme-color` fixo em `#2563eb` e sem variante dark.

**Proposta:** apagar `public/site.webmanifest` e a `<link rel=manifest>` manual. Gerar ícones reais (192, 512, maskable-512 com margem de 20%, apple 180). Exportar `viewport` com `viewportFit: 'cover'` e `themeColor`. Adicionar um service worker mínimo (Serwist ou next-pwa), com cache de shell e rotas estáticas e fallback offline, **sem cachear respostas autenticadas**. `start_url: '/dashboard?source=pwa'` para quem está logado.

### 3.14 Performance em 4G (Android intermediário)
- **`public/ben.png` tem 1,09 MB (1024×1024)** para um avatar de 40–64 px. Via `next/image` ele é otimizado, mas o original deveria ser um WebP de 256 px (cerca de 15 KB): reduz custo de transformação e uso em `<img>` fora do next/image (share, projeções).
- **308 arquivos `"use client"`** e só 2 usos de `next/dynamic`. `/dashboard` (`src/app/dashboard/page.tsx`, 859 linhas) e `/ranking` são páginas inteiras client-side. `quick-ranker.tsx` tem 3851 linhas num único componente client.
- `recharts` entra em 12 componentes, inclusive **sparklines** de /indices (`src/components/indices/index-sparkline.tsx`), onde um `<svg><polyline>` inline resolveria. Gráficos abaixo da dobra devem usar `dynamic(() => import(...), { ssr: false, loading: Skeleton })`.
- **gtag.js é carregado 2×** (`src/app/layout.tsx:136-143`, IDs G- e AW-). Um só script com dois `config` basta. GA, Ads e Clarity usam `afterInteractive`; `lazyOnload` seria melhor no mobile.
- Marquee infinito do ticker, backdrop-blur em 2 camadas sticky e `transition-all` generalizado: jank no scroll em GPU fraca.
- `framer-motion` aparece só no wizard do ranking. Ok, não é red flag.
- JS decodificado em dev: 8–11,7 MB por rota. O maior é `/fii` e `/backtest` (11,7 MB) e o menor é contato/login (~8 MB). Vale medir no build de produção com `@next/bundle-analyzer` (sem rodar `yarn build` contra o `.env` de produção).

---

## 4. Métricas por rota (360×740, premium; anon quando diferente)

| Rota | Telas (anon/prem) | Alvos <44 | Alvos <24 | Topo fixo | Scroll-x interno |
|---|---|---|---|---|---|
| `/` | 35,7 / 29,7 | 25 / 21 | 1 | 182 px (25%) | — |
| `/planos` | 20,4 | 13 / 16 | 0 | 25% | tabela 565/328 |
| `/acao/petr4` | 19,7 / 14,9 | 49 / 40 | **21 / 20** | 25% | tabs 464/278, tabela 900/326 |
| `/fii/hglg11` | 6,7 / 3,8 | 8 / 13 | 0 / 1 | 25% | — (+popup do Ben) |
| `/compara-acoes/petr4/vale3` | 13,5 / 12,2 | 27 / 17 | **12** | 25% | tabela 600/326 |
| `/radar-dividendos` | **27,3** / 14,2 | 15 / 14 | **20** | 25% | — |
| `/radar` | — / 6,4 | 14 | **10** (X de 12 px) | 25% | — |
| `/analise-setorial` | 16 / 6,2 | 16 / 14 | 2 / 11 | 25% | — |
| `/screening-acoes` | 17 / 1,6 | 11 / 14 | 2 / 3 | 25% | resultados: **página com 534 px** |
| `/dashboard` | — / 9,1 | 22 | 1 | 25% | — |
| `/carteira` (detalhe) | — | — | — | 25% | **página com 379 px** |
| `/login` | 1,2 | 11 / 14 | 1 | 25% | — |

Inputs com fonte <16 px no carregamento: **0** (textareas só aparecem ao abrir chat ou formulário; o do Ben mede 14 px). Overflow a 360 px: **0/42**. A 320 px: `/acao/petr4` com 336 e `/compara-acoes` com 347.

---

## 5. Priorização

**P0 (bloqueiam uso ou conversão no mobile)**
1. Cromo fixo de 182 px para ≤56 px (header compacto e auto-hide, ticker não sticky, busca como ícone e sheet).
2. Popup do Ben: nunca cobrir o hero. Pílula ou toast, gatilho tardio, frequência semanal; corrigir o botão de 20 px e o 401 do anônimo.
3. Modal de e-mail: gatilho por scroll, fechamento persistido globalmente, bottom sheet no mobile.
4. Overflow do screening (534 px) e da carteira (379 px); métricas com rótulo e formato compacto.
5. CTA secundário invisível na `CTASection`.
6. Hero compacto na página de ação (preço justo, upside e score na primeira dobra) mais barra de ações fixa.

**P1**
7. Drawer: área rolável real, Sheet do Radix, itens de 48 px.
8. Bottom nav para logados.
9. Alvos de toque de 44 px (Button/Input base no mobile, "i" dos indicadores, InfoTooltip, remover ticker do radar).
10. Textarea com 16 px (zoom no iOS).
11. Tabelas: planos, comparison-table, compara-ETFs, holdings (cards ou coluna fixa estreita).
12. Tabs sobrepostas (análise técnica), tabs só com ícone (análise estratégica), tabs cortadas (índices, carteira, backtest).
13. Radar de dividendos compacto e tooltip de hover trocado por Popover.
14. PWA: manifest único, ícones reais, `viewport` com `viewportFit`, apple-touch-icon, service worker.
15. PIX mobile com "Copiar código" primeiro.

**P2**
16. Landing: FAQ único em accordion, cortar redundância, footer 2-col com accordion, "© 2025".
17. Indicadores em grade 2-col compacta; prose mobile menor no relatório de IA.
18. Performance: ben.png em WebP de 256 px, gtag único e lazy, sparklines em SVG, `dynamic()` para gráficos, ticker com `prefers-reduced-motion`, remover backdrop-blur no mobile.
19. CTA fixo no rodapé para wizard do ranking, backtest e "Buscar empresas".
20. `inputMode="decimal"` e máscara BRL nas calculadoras e no backtest; `autoComplete="email"`.

---

## 6. Critérios de aceite sugeridos (QA mobile)
- A 360×740, depois de rolar 1000 px, a soma de elementos fixos/sticky no topo é **≤ 56 px** (script `STICKY` em `scratchpad/mob/audit.mjs`).
- Em `/acao/*`, `/fii/*`, `/etf/*` e `/bdr/*`, o bloco "Preço · Preço justo · Upside · Score" fica **inteiro visível em y < 740 − 56** sem nenhum overlay nos primeiros 10 s.
- Nenhum `button`/`a`/`[role=button]` visível fora de parágrafo com `min(w,h) < 44` nas rotas-chave (tolerância: links inline de texto).
- `document.documentElement.scrollWidth === innerWidth` a 320, 360 e 390 em todas as rotas do baseline, inclusive nos estados de resultado (screening, carteira).
- Todos os `input`, `select` e `textarea` com `font-size ≥ 16px` abaixo de 768 px.
- Lighthouse PWA: installable ✅, maskable icon ✅, apple-touch-icon 180 ✅, manifest único ✅.
- Home a 360 px com **≤ 18 telas**; radar-dividendos com **≤ 10 telas** para 20 empresas.

---

## 7. Artefatos
- Métricas: `scratchpad/mob/audit/metrics-360x740.json`; capturas scrolled: `scratchpad/mob/audit/*__scrolled.png`
- Capturas específicas: `scratchpad/mob/special/` (`first-sheet.png`, `menu-sheet.png`, `sh-screening.png`, `sh-carteira.png`, `sh-misc.png`, `sh-backtest.png`, `w320-*.png`, `menu-premium.json`)
- Scripts reutilizáveis (somente local, bloqueiam IA, pagamento, e-mail e analytics): `scratchpad/mob/audit.mjs`, `scratchpad/mob/special.mjs`, `scratchpad/mob/rank.mjs`
