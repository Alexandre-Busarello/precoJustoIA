# Preço Justo AI — Auditoria UX/UI e Design System

Data: 2026-09-29 · Branch: `melhorias/ux-ui-mobile` · Base: 160 screenshots (anon/premium × mobile/desktop) em `scratchpad/shots/baseline/` + leitura do código.
Todas as medições foram feitas no ambiente local (DB Docker `localhost:55432`, dev server `:3100`). Nenhum comando tocou produção.

---

> **DECISÕES DO DONO (prevalecem sobre qualquer recomendação dos especialistas):**
> 1. **Dark mode completo é requisito** (next-themes, toggle Claro/Escuro/Sistema, tudo por tokens, testado em todas as páginas — ver §2.3 "Dark mode"). Planejar no backlog: fundação na onda 0, migração por lote, e um lote final de verificação dark em todas as rotas.
> 2. **Trial continua de 1 dia** (trials longos geraram múltiplas contas sem conversão). Não alterar prazo.

## 0. Diagnóstico em uma página

O produto tem substância real (8 modelos, histórico de 7 anos, backtest, radar), mas a embalagem grita "gerado por IA" e esconde o valor:

| Sintoma | Evidência medida |
|---|---|
| Gradientes em todo lugar | **683** `bg-gradient-to-*` no `src/`; **180** combinações azul→roxo; texto em gradiente no H1 da home, /planos, /blog, /metodologia |
| Paleta sem controle | ~9.000 classes de cor crua (`blue` 1.926, `green` 1.580, `red` 876, `yellow` 519, `orange` 428, `purple` 326, `violet` 184, `teal` 156…) contra **zero** tokens semânticos (não existe `--positive`/`--negative`) |
| Emoji na UI | **359** linhas de JSX com emoji (fora `console.*`): 🚀 📊 🤖 🔥 💰 🎁 ✨ 💡 ⚠️ ❤️ 👋 ❌ ✅ |
| Sombras e raios aleatórios | 408 `shadow-lg/xl/2xl`; raios: `rounded-lg` 649, `rounded-full` 473, `rounded-xl` 167, `rounded-2xl` 99, `rounded-md` 112 |
| Glass | 38 `backdrop-blur` (inclusive o header) |
| Badges demais | 625 `<Badge>`; stock page tem até 4 badges no cabeçalho |
| Formatação numérica caótica | **2.036** `toFixed(`, **53** funções `formatX` locais duplicadas, só **1** uso de `tabular-nums`. Mistura "R$ 48,56" (pt-BR) com "R$ 625.68B" e "12.60%" (en-US) na mesma tela |
| **A fonte nem carrega** | `Geist` é baixada via `next/font` mas nunca aplicada: `getComputedStyle(body).fontFamily` = `ui-sans-serif, system-ui…`; `document.fonts` = `Geist: unloaded`. Cada SO renderiza uma fonte diferente (DejaVu no Linux, Segoe no Windows) |
| Dark mode fantasma | **3.430** classes `dark:` mas nada aplica `.dark` (sem `next-themes`, sem toggle, sem `prefers-color-scheme`). É código morto |
| Página inicial gigante | 15.703 px no desktop, **25.615 px no mobile** (≈30 telas). FAQ aparece **duas vezes** |
| Popups em série | Modal de e-mail (6 s, anon, toda página de ação — o "fechar" **não é lembrado**), exit-intent em /planos, Ben proativo em 20 páginas premium (cobre o preço no mobile e o score no desktop), modal de IA no screening sem `role=dialog`, banner de tutorial em /carteira, ticker animado, CTA flutuante |
| Sinais de confiança fabricados | "4,8 · 1.250 avaliações" hardcoded (+ `aggregateRating` no JSON-LD, `src/app/page.tsx:141,1206-1209`), "87% dos investidores perdem dinheiro", "-R$ 5.000 economia média", "100% Dados Confiáveis", "Único no mercado brasileiro!", "centenas de investidores" |
| Contradição regulatória | Rodapé diz "Não oferecemos recomendações de compra/venda", mas a UI mostra "Compra", "Sinal Compra", "Região segura para entrada" |

**Direção em uma frase:** "Terminal de análise sóbrio, não landing page de curso" — neutro, denso, números em primeiro plano, uma cor de marca, cor semântica só para variação/resultado, zero decoração que não informe.

---

## 1. Design Direction

**Referências de tom:** Linear (hierarquia e contenção), Stripe Dashboard (tabelas e números), Koyfin/Finviz (densidade de dados), Status Invest (familiaridade do público BR, mas mais limpo).

Princípios (em ordem de desempate):

1. **O número é o herói.** Em toda página de ativo, as 4 respostas (Preço · Preço justo · Margem de segurança · Score) aparecem acima da dobra, sem expandir nada.
2. **Uma cor de marca.** Azul-tinta para ação primária, link, foco, item ativo e série principal de gráfico. Todo o resto é neutro.
3. **Cor semântica só tem um significado.** Verde = variação/resultado positivo, vermelho = negativo, âmbar = atenção. Nunca para preço estático, nunca para "projetado", nunca para decorar categoria.
4. **Borda fina em vez de sombra.** Sombra só em camada flutuante (popover, dropdown, modal).
5. **Menos contêineres.** Seção não é card. Card não é colorido. Ícone não tem "azulejo" com gradiente.
6. **Texto de produto, não de anúncio.** Sem emoji, sem exclamação, sem superlativo não verificável, sem urgência falsa.
7. **Um passo a menos.** Nada de tela intermediária "O que você quer fazer?" — cair direto na ferramenta com padrões sensatos.
8. **Interrupção zero por padrão.** Crescimento via elementos inline e contextuais; modal só em resposta a ação do usuário.

---

## 2. Design System Spec (obrigatório para os devs)

### 2.1 Tipografia

- **Família:** manter **Geist Sans** (já empacotada) para toda a UI e **Geist Mono** apenas para ticker em tabelas densas e código. Não adicionar outra fonte.
- **Correção obrigatória (bug P0):** em `src/app/layout.tsx:129-131` mover `${geistSans.variable} ${geistMono.variable}` do `<body>` para o `<html>` e dar ao body `font-sans antialiased`. Em `globals.css`, `--font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif`. Critério: `getComputedStyle(document.body).fontFamily` começa com `Geist` e `document.fonts` mostra `Geist: loaded`.
- **Numerais tabulares:** `font-variant-numeric: tabular-nums` global em `table`, `[data-num]`, e em todo valor financeiro (classe utilitária `tabular-nums`). Geist tem `tnum`.
- **Escala (usar só estas):**

| Papel | Classe | Peso | Observação |
|---|---|---|---|
| Hero marketing | `text-4xl sm:text-5xl` (36/48) | 600 | `tracking-tight`, cor sólida `text-foreground`, máx. 2 linhas |
| Título de página (app) | `text-2xl` (24) | 600 | `tracking-tight` |
| Título de seção | `text-lg` (18) | 600 | sentence case |
| Título de card / label forte | `text-sm` (14) | 500 | |
| Corpo app | `text-sm` (14) | 400 | leading-6 |
| Corpo marketing / prosa | `text-base` (16) | 400 | largura máx. 68ch |
| Label / legenda | `text-xs` (12) | 400–500 | `text-muted-foreground` |
| KPI principal | `text-2xl`–`text-3xl` | 600 | `tabular-nums` |
| Valor em tabela | `text-sm` | 400/500 | `tabular-nums`, alinhado à direita |

- Proibido: `font-extrabold`, `font-black`, `text-6xl+`, texto com `bg-clip-text` gradiente, `<strong>` salpicado no meio de parágrafo de marketing (hoje cada subtítulo tem 4–6 negritos).
- **Caixa:** sentence case em pt-BR ("Indicadores de valuation", não "Indicadores de Valuation"; "Ver metodologia", não "Ver Metodologia Completa").
- Prosa de IA/blog (`react-markdown`): H1 do markdown vira `text-xl`, H2 `text-lg`, H3 `text-base font-semibold`. Hoje o H1 do relatório ocupa 7 linhas no mobile.

### 2.2 Cores (tokens em `globals.css`)

Neutro frio levíssimo + **uma** marca + semânticas. Substituir o bloco `:root`/`.dark` atual (valores shadcn padrão) por:

```css
@theme inline {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;

  /* shadcn existentes (manter mapeamento) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* novos */
  --color-surface: var(--surface);          /* faixa sutil: header de tabela, seção alternada */
  --color-brand: var(--brand);
  --color-brand-subtle: var(--brand-subtle);
  --color-positive: var(--positive);
  --color-positive-subtle: var(--positive-subtle);
  --color-negative: var(--negative);
  --color-negative-subtle: var(--negative-subtle);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);

  /* gráficos: 1 = marca, 2 = neutro, demais só em comparação multi-série */
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --radius-sm: 4px;   /* badge, checkbox */
  --radius-md: 6px;   /* botão, input, select, tab */
  --radius-lg: 8px;   /* card, tabela, painel */
  --radius-xl: 12px;  /* modal, sheet, popover grande */
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.21 0.006 265);
  --card: oklch(1 0 0);
  --card-foreground: var(--foreground);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--foreground);
  --surface: oklch(0.982 0.003 265);
  --muted: oklch(0.967 0.003 265);
  --muted-foreground: oklch(0.52 0.012 265);   /* >= 4.5:1 sobre branco */
  --secondary: oklch(0.967 0.003 265);
  --secondary-foreground: var(--foreground);
  --accent: oklch(0.967 0.003 265);           /* hover de ghost/menu */
  --accent-foreground: var(--foreground);
  --border: oklch(0.92 0.004 265);
  --input: oklch(0.90 0.004 265);

  --brand: oklch(0.50 0.18 264);              /* azul-tinta, ~#2f4fd6 */
  --brand-subtle: oklch(0.96 0.02 264);
  --primary: var(--brand);
  --primary-foreground: oklch(0.99 0 0);
  --ring: oklch(0.50 0.18 264 / 0.45);

  --positive: oklch(0.52 0.13 155);           /* ~#16794a */
  --positive-subtle: oklch(0.96 0.03 155);
  --negative: oklch(0.54 0.19 27);            /* ~#c2352b */
  --negative-subtle: oklch(0.965 0.02 27);
  --warning: oklch(0.62 0.14 70);             /* texto âmbar legível */
  --warning-subtle: oklch(0.97 0.04 85);
  --destructive: var(--negative);

  --chart-1: var(--brand);
  --chart-2: oklch(0.70 0.01 265);            /* benchmark/IBOV/CDI em cinza */
  --chart-3: oklch(0.62 0.10 200);
  --chart-4: oklch(0.70 0.12 75);
  --chart-5: oklch(0.55 0.10 310);
}

.dark {
  --background: oklch(0.17 0.006 265);
  --foreground: oklch(0.96 0.003 265);
  --card: oklch(0.20 0.006 265);
  --card-foreground: var(--foreground);
  --popover: oklch(0.22 0.006 265);
  --popover-foreground: var(--foreground);
  --surface: oklch(0.20 0.006 265);
  --muted: oklch(0.24 0.006 265);
  --muted-foreground: oklch(0.70 0.01 265);
  --secondary: oklch(0.24 0.006 265);
  --secondary-foreground: var(--foreground);
  --accent: oklch(0.26 0.006 265);
  --accent-foreground: var(--foreground);
  --border: oklch(1 0 0 / 9%);
  --input: oklch(1 0 0 / 14%);
  --brand: oklch(0.70 0.14 264);
  --brand-subtle: oklch(0.28 0.05 264);
  --primary: var(--brand);
  --primary-foreground: oklch(0.17 0.006 265);
  --ring: oklch(0.70 0.14 264 / 0.5);
  --positive: oklch(0.74 0.14 155);
  --positive-subtle: oklch(0.27 0.04 155);
  --negative: oklch(0.72 0.16 25);
  --negative-subtle: oklch(0.28 0.05 25);
  --warning: oklch(0.80 0.13 80);
  --warning-subtle: oklch(0.29 0.05 80);
  --destructive: var(--negative);
  --chart-2: oklch(0.55 0.01 265);
}

@layer base {
  html { font-family: var(--font-sans); }
  body { @apply bg-background text-foreground; font-feature-settings: "cv11"; }
  table, [data-num] { font-variant-numeric: tabular-nums; }
}
```

Regras de uso:
- `text-positive`/`text-negative` **só** para: variação (dia, período), retorno, upside/margem de segurança, resultado de backtest, delta de indicador vs média. Preço atual é `text-foreground`.
- Fundos `*-subtle` só em badges de status e em células destacadas; **nunca** em cards inteiros ou linhas de accordion.
- Proibido após migração: `bg-gradient-*`, `from-*/to-*`, `text-{blue,purple,violet,indigo,pink,teal,orange,emerald,cyan}-*`, `bg-*-50` como fundo de seção. Exceção única: logo.
- `meta theme-color` (`layout.tsx:122`) passa a `#ffffff`.
- **Dark mode: DECISÃO DO DONO — é requisito, não opcional.** O dono quer dark mode na plataforma inteira, **desde que funcione em tudo e fique bom**. Regras:
  - Implementar com `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`) no layout raiz, sem flash de tema errado (script do next-themes + `suppressHydrationWarning` no `<html>`).
  - Toggle discreto no header (ícone Sol/Lua/Monitor, três opções: Claro/Escuro/Sistema) e também no menu mobile e no dropdown do avatar. Persistido.
  - O dark mode funciona **por tokens**: toda superfície, texto, borda, gráfico (recharts via CSS vars `--chart-*`), tabela, badge, modal/sheet, toast (sonner com `theme` do next-themes), skeleton, input, select, tooltip, markdown da IA (prose com `dark:prose-invert` ou tokens), logos/imagens (logo com versão para fundo escuro ou `currentColor`), e-mails NÃO (e-mails ficam claros).
  - As 3.430 classes `dark:` legadas devem ser apagadas conforme cada arquivo é migrado para tokens; cores cruas (`bg-white`, `text-gray-900`, `bg-blue-50`…) são o que quebra o dark mode — cada lote que tocar um arquivo troca por tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `text-positive`…).
  - Cores do dark: fundo neutro quase-preto levemente frio (não preto puro), superfícies em degraus sutis, marca com luminosidade ajustada para contraste AA, verde/vermelho semânticos dessaturados. Contraste mínimo WCAG AA em texto.
  - **Aceite:** cada lote é testado também em dark (screenshots `--theme dark`); nenhuma área com fundo branco "vazando", texto ilegível, borda sumida ou gráfico invisível em dark. Páginas ainda não migradas em uma onda não podem ficar quebradas: se necessário, o toggle só é exposto quando TODAS as páginas passarem no teste dark (checklist no último lote).

### 2.3 Espaçamento, grid, raio, elevação

- Base 4 px. Escala usada: 4, 8, 12, 16, 24, 32, 48, 64.
- Container app: `max-w-6xl` (1152) único para todas as páginas de ativo (hoje ETF usa largura diferente de ação/FII). Gutter mobile 16 px.
- Padding de card: 16 px mobile / 20 px desktop. Gap entre cards: 12–16 px. Entre seções do app: 32 px; marketing: 64–96 px.
- `Card` (`src/components/ui/card.tsx:10`): remover `mb-4` (margem dentro de primitivo quebra layouts), `shadow-sm`, trocar `rounded-xl py-6 gap-6` por `rounded-lg py-5 gap-4`. Adicionar variante `density="compact"` (`py-4 gap-3`).
- Elevação: nível 0 = borda 1 px `border-border`; nível 1 (popover/dropdown/tooltip) = `shadow-md` + borda; nível 2 (modal/sheet) = `shadow-xl` + overlay `bg-black/40` sem blur. Header: `bg-background border-b`, sem `backdrop-blur` (`header.tsx:43`).

### 2.4 Componentes

**Botões** (`src/components/ui/button.tsx`): variantes permitidas `default` (marca sólida), `outline` (neutro), `ghost`, `destructive`, `link`. Remover `shadow-xs`. Tamanhos `sm` 32, `default` 36, `lg` 40; em mobile, alvo mínimo 44 (o pseudo `before:inset-[-4px]` já ajuda — manter). Regras: **1 botão primário por região visível**; ícone só quando reforça a ação (seta em "Continuar" não; `Plus` em "Nova carteira" sim); sem 🚀/Rocket; sem classes de gradiente passadas via `className`.

**Badges** (`src/components/ui/badge.tsx`): variantes `neutral` (outline, default), `positive`, `negative`, `warning`, `brand` (todas `*-subtle` bg + texto semântico, `rounded-sm`, `text-xs font-medium`). Limites: máx. 2 por entidade (ex.: setor + "Premium"); "Novo" só com data de expiração (≤30 dias); proibido badge decorativo ("Automático", "Ranking inteligente", "Base Científica", "Blog Educativo", "IA Premium 🔥").

**Tabelas** (novo `src/components/ui/data-table.tsx` sobre `table.tsx`): linha 40 px (compact 36), cabeçalho `bg-surface text-xs font-medium text-muted-foreground` sticky, divisórias horizontais finas, sem zebra, números à direita + `tabular-nums`, ticker em `font-medium` (mono opcional), ordenação por clique no cabeçalho, no mobile rolagem horizontal com primeira coluna sticky (em vez de empilhar em cards).

**Stat / KPI** (novo `src/components/ui/stat.tsx`): `label` (xs, muted) · `value` (2xl semibold tabular) · `delta` opcional (sm, positive/negative com sinal `+`/`−` U+2212) · `hint` opcional (tooltip de ícone `Info` 14 px). Sem ícone decorativo, sem borda colorida.

**Section header** (novo `src/components/ui/section-header.tsx`): título `text-lg font-semibold` + descrição opcional + ações à direita. Sem ícone à esquerda por padrão.

**Page header** (novo `src/components/page-header.tsx`): breadcrumb (opcional) + H1 `text-2xl` + descrição 1 linha + ações. Substitui as faixas de gradiente (ex.: `/ranking`) e o template "pill + H1 bicolor + subtítulo + 3 micro-provas + 2 CTAs" repetido em 7 páginas (`LandingHero`).

**Tabs:** estilo sublinhado (underline 2 px `brand`) para navegação de conteúdo; segmented (fundo `muted`) só para alternar visualização (ex.: 12m/5a).

**Gráficos (recharts):** série principal `--chart-1`; benchmark (IBOV/CDI) `--chart-2` tracejado; área com preenchimento ≤ 8% de opacidade, sem gradiente multicolor; grid só horizontal `stroke: var(--border)`; eixos `text-xs muted`; tooltip com formatação pt-BR; verde/vermelho só quando a série é "ganho/perda". Previsões/projeções sempre tracejadas e rotuladas "estimativa".

**Modais:** sempre `Dialog` Radix (focus trap, Esc, `aria-label` no X). Nunca abrem sozinhos (ver §4).

**Estados:** todo bloco de dados precisa de `loading` (skeleton com a forma final), `empty` (1 frase + 1 ação), `error` (mensagem + "Tentar novamente") e `locked` (premium: prévia real borrada 3 linhas + 1 CTA). Hoje o bloco de IA para anônimo simplesmente corta o texto no meio ("A Petróleo Brasileiro S.A.") sem gate claro.

### 2.5 Números e locale (novo `src/lib/format.ts`)

Uma única fonte de verdade com `Intl.NumberFormat('pt-BR')`:

| Função | Entrada | Saída |
|---|---|---|
| `formatBRL(48.56)` | reais | `R$ 48,56` |
| `formatBRLCompact(625_680_000_000)` | reais | `R$ 625,7 bi` (mi/bi/tri) |
| `formatPct(0.126, {digits:1})` | **fração** | `12,6%` |
| `formatDeltaPct(-0.2159)` | fração | `−21,6%` (sinal sempre, U+2212) |
| `formatMultiple(10.82)` | múltiplo | `10,8x` |
| `formatDate(d)` | Date | `29 set. 2026` / relativa "há 5 dias" |
| `formatNullable(v, fn)` | null | `—` (nunca "N/A" nem "R$ " vazio) |

Critério: nenhuma tela exibe ponto decimal, sufixo "B", "N/A" ou "R$ " sem número. Migrar primeiro `financial-indicators.tsx` (ex.: linha 218 `R$ ${(value/1e9).toFixed(2)}B`), `comprehensive-financial-view.tsx`, `fii/[ticker]/page.tsx`, `compara-acoes`, `technical-analysis-page.tsx:615`, `radar-grid.tsx`. Precisão padrão: preço 2 casas; % 1 casa; múltiplos 1 casa.

### 2.6 Iconografia

- Somente `lucide-react`, `size-4` (16) inline e `size-5` (20) no máximo em cabeçalho; `strokeWidth={1.75}`; cor `text-muted-foreground` (ou `currentColor` em botão).
- Ícone é affordance (ação, estado, tooltip), não decoração. Proibido: "azulejo" colorido/gradiente atrás do ícone (home, sobre, metodologia, dashboard, ranking, backtest), ícone antes de todo título de seção, ícone por item de FAQ, ícone diferente para cada card da mesma grade.
- Logos de empresa: `company-logo.tsx` com fallback **monograma neutro** (2 letras do ticker em `bg-muted text-muted-foreground rounded-md`), não o prédio azul-roxo com gradiente repetido em todas as linhas.

### 2.7 Tom de voz

- Sem emoji. Sem "!" em UI. Sem CAPS ("MELHOR VALOR" → "Recomendado").
- Sem superlativo não comprovável ("Único no mercado", "100% confiáveis", "a plataforma mais completa") e sem estatística sem fonte ("87% dos investidores", "-R$ 5.000 economia média", "100x mais rápido").
- Vocabulário regulatório: nunca "Compra/Venda/Sinal de compra/Região segura para entrada". Use "Abaixo do preço justo", "Acima do preço justo", "Dentro da faixa estimada". A IA é "estimativa gerada por IA", nunca "previsão".
- Títulos descrevem, não vendem: "Rankings" (não "Encontre as melhores oportunidades"), "Planos" (não "Apoie o projeto e nos ajude a crescer!").
- Botões com verbo + objeto: "Criar conta grátis", "Gerar ranking", "Comparar", "Adicionar ao backtest".
- Nomes de estratégias no screening sem clickbait: "Oportunidades de Ouro", "Crescimento Explosivo", "Vacas Leiteiras" → "Desconto vs. preço justo", "Crescimento de receita > 20% a.a.", "Dividendos acima da Selic".

### 2.8 Guarda-corpo automático (simples)

Adicionar `scripts/check-ui.sh` (grep) rodando em CI/pre-push que falha em arquivos novos/alterados contendo: `bg-gradient-to-`, `bg-clip-text`, `backdrop-blur`, `font-black|font-extrabold`, `shadow-(lg|xl|2xl)` fora de `ui/dialog|sheet|popover`, emoji em `.tsx` fora de `console.`, `text-(purple|violet|indigo|pink)-`. Allowlist por arquivo para migração gradual.

---

## 3. Shell global (header, ticker, busca, rodapé)

**Problema:** no mobile, header (80 px) + ticker animado (40 px) + faixa de busca (50 px) = ~170 px (20% da tela) antes do conteúdo; no desktop ~200 px. O ticker em marquee compete com o conteúdo em todas as páginas, inclusive login e checkout.

Correções:
- `src/components/header.tsx`: altura 56 px mobile / 64 px desktop; logo 28–32 px de altura (hoje 48–70 px); fundo sólido sem blur; **busca dentro do header** — desktop: campo compacto com `⌘K`/`Ctrl K` entre logo e nav; mobile: ícone de lupa que abre o `GlobalSearchBar` em sheet de tela cheia. Remover a faixa separada (`header.tsx:206-207`).
- `MarketTickerBar` (`header.tsx:204`, `indices/market-ticker-bar.tsx:313`): remover do layout global. Opção simples: exibir **estático** (sem `scroll-ticker`), 5 índices, apenas em `/dashboard` e `/indices`. Se o dono quiser mantê-lo global: estático, 28 px, só ≥ lg, respeitando `prefers-reduced-motion`, e nunca em `/login`, `/register`, `/esqueci-senha`, `/checkout`.
- Nav premium: badge "Premium" gradiente sob o nome + ponto gradiente no ícone de suporte (`header.tsx:138`) → nome + avatar neutro; plano aparece dentro do dropdown.
- `src/components/footer.tsx`: usar o mesmo logo do header (hoje é um ícone `Brain` diferente, linha 18); ano dinâmico (`© 2025` hardcoded na linha 214); remover 🚀/📊 dos links e "Feito com ❤️"; aviso legal em texto `text-xs text-muted-foreground` sem caixa marrom/amarela nem ⚠️; remover badges "+500 empresas"/"IA Integrada".
- Mobile nav: ícone de "Preços" é verde e maior que os demais — padronizar (todos `size-4 text-muted-foreground`) ou remover ícones da lista.

---

## 4. Mecânicas de crescimento intrusivas — como baixar o volume sem matar conversão

Regra-mãe: **no máximo uma interrupção por sessão, nunca nos primeiros 30 s, nunca no mobile, nunca para quem já é pagante.** Toda interrupção precisa ter "não mostrar de novo" persistido.

| Mecânica | Hoje | Recomendação |
|---|---|---|
| **Modal "Avise-me quando PETR4 estiver barata"** (`email-capture-modal.tsx:46-48`, usado em `acao/[ticker]/page.tsx`) | Abre após 6 s em toda página de ação para anônimo, mobile e desktop. Fechar **não é persistido** (só grava ao enviar, por ticker) → reaparece a cada ação visitada. Já existe o mesmo pedido inline no card lateral | **Remover o disparo automático.** Manter o card inline "Acompanhar PETR4" (sidebar no desktop, logo após o bloco de valuation no mobile) com campo de e-mail direto. Se quiser testar modal: só desktop, após 60% de scroll **ou** na 2ª página de ativo, 1×/14 dias global (`localStorage` `email-capture-dismissed-at`), A/B contra o inline |
| **Exit intent "Opa, antes de ir…"** (`exit-intent-provider.tsx`, `use-exit-intent.ts`) | Modal bloqueante em /planos e /checkout; cap só por montagem de página (`useRef`) | Trocar por **card não bloqueante** no canto inferior (Sonner/toast custom) com a mesma pergunta de 1 clique; 1× a cada 30 dias (`localStorage`); desativar em /checkout (lá atrapalha o pagamento) |
| **Ben proativo "Olá! Sou o Ben"** (`ben-proactive-popup.tsx:190-224`) | Em 20 páginas premium após 2,5 s, cap de 1 h. Cobre o preço (mobile) e o score/tabela (desktop). Para anônimo dispara `/api/ben/interactions` → 401 | Desligar popup proativo em páginas de ativo, radar e análise técnica. Manter apenas o FAB (40 px, canto inferior direito, com `bottom` acima de qualquer barra fixa). Apresentação do Ben: 1 card inline **uma única vez** no dashboard ("Pergunte ao Ben sobre qualquer ativo"), com dismiss persistente. Não montar nada do Ben sem sessão |
| **Modal "Não sabe como configurar?"** (`screening-ai-assistant.tsx:138-145`) | Bloqueia /screening-acoes para premium; sem `role=dialog`, Esc não fecha, X sem label | Remover o modal. Colocar no topo do painel de filtros um campo inline "Descreva o que procura (ex.: bancos com DY > 8%)" + botão "Configurar com IA". Se permanecer algum dialog, migrar para `ui/dialog` |
| **FloatingCTA na home** (`page.tsx:110-116`) | Botão flutuante após 300 px + CTA no hero + 3 CTAs intermediários + CTA final | Só no mobile, barra inferior fina "Criar conta grátis" aparecendo após o hero sair da tela e escondida quando o CTA final entra na viewport |
| **Banner tutorial em /carteira** (`portfolio-tutorial-banner.tsx`) | Caixa azul grande acima do título | Link discreto no empty state/ao lado de "Nova carteira": "Importar histórico (tutorial de 5 min)"; dismiss persistente |
| **Trial / onboarding / notification banners** (`trial-banner`, `onboarding-*`, `dashboard-notification-banner`, `email-verification-banner`) | Vários podem empilhar | Um único slot de banner por página (`<PageNotice>`) com prioridade: verificação de e-mail > fim de trial > novidades. Máx. 1 visível |
| **Upsell para quem já paga** | Dashboard premium tem botão "✨ Premium"; /planos para premium diz "Escolha seu plano ideal" | Esconder CTAs de assinatura para premium; em /planos mostrar "Seu plano: Premium Anual · renova em …" |

O que **mantém** conversão: prévia real e borrada do conteúdo premium no próprio contexto (IA, análise técnica, estratégias premium) com 1 CTA "Desbloquear com 1 dia grátis", e o card inline de acompanhamento. Esses são contextuais e não interrompem.

---

## 5. Página por página

### 5.1 Home `/` (`src/app/page.tsx`, `src/components/landing/*`)

**Problemas:** 15.703 px desktop / 25.615 px mobile; 14 seções; FAQ duplicado (linhas ~935 e ~1100); H1 em 3 cores de gradiente; selo de avaliação sem lastro + `aggregateRating` no JSON-LD (risco de penalização por "self-serving reviews" no Google e de propaganda enganosa/CDC); estatísticas inventadas; pricing completo repetido da /planos; bloco de aversão à perda "-R$ 5.000 / -R$ 10.000"; botão secundário **invisível** no CTA final (texto branco sobre `bg-background` branco: `cta-section.tsx:110-118`, variante `outline` com `bg-background`); ícones em azulejos coloridos; "Explore nossas ferramentas" com 4 cards vazios; disabled "Gerar Ranking Inteligente" gradiente esmaecido logo no primeiro scroll.

**Nova estrutura (alvo ≤ 6.000 px desktop, ≤ 9.000 px mobile):**
1. **Hero** alinhado à esquerda, 2 colunas no desktop. H1 sólido: "O preço justo de cada ação da B3, calculado por 8 modelos de valuation." Subtítulo 1 frase sem negritos. Ação principal = **campo de busca de ticker** ("Digite um ticker, ex.: PETR4") que leva direto à página do ativo (product-led, mostra valor sem cadastro) + link "Criar conta grátis". À direita: screenshot real da página de ativo (captura estática, borda fina, sem mockup 3D).
2. **Faixa de confiança** (texto, sem ícones): "Dados da B3 e CVM via BRAPI · Atualizado 3× ao dia · Metodologia pública" (links).
3. **3 blocos de produto** alternados (texto curto + screenshot): Página de ativo (preço justo por modelo), Rankings, Backtest. Substitui "Por que escolher", stats, "Explore ferramentas", cards de modelos gigantes e o mockup de backtest.
4. **Modelos** como tabela compacta (Modelo · O que mede · Plano) com link "Ver metodologia".
5. **Planos** resumidos (3 colunas, mesmo componente da /planos, sem o card de trial separado).
6. **FAQ** único em accordion (6 perguntas, sem ícones).
7. **CTA final** em `bg-surface`, H2 + 1 botão primário + 1 link.
Remover: selo 4,8, `aggregateRating` (até existir avaliação real coletada), "87%", "100x", "-R$ 5.000", "100% Dados Confiáveis", depoimentos sem identificação verificável (manter só se forem reais e com permissão), setores para comparar (vai para /analise-setorial), blog (3 links simples no máximo), segundo FAQ, "Ranking inteligente" pill, badges "Gratuito/Premium" em cada card.

Logado: a home deve redirecionar (ou virar) o dashboard — hoje o premium vê 12.809 px de marketing.

### 5.2 Página de ação `/acao/[ticker]` (`src/app/acao/[ticker]/page.tsx`, `strategic-analysis-client.tsx`, `financial-indicators.tsx`, `comprehensive-financial-view.tsx`, `header-score-wrapper.tsx`)

**Problemas:** o valor central (preço justo e margem por modelo) fica escondido em accordions coloridos; preço atual em verde sem ser variação (`page.tsx:706`); cabeçalho com ícone-azulejo, 2 badges, "Análise da Ação…", "Sobre…", 3 botões, card "Calcule sua Renda Passiva" (verde, promocional) e metadados — mas sem variação do dia, sem preço justo, sem upside; accordions de estratégia com fundo inteiro verde/rosa e títulos centralizados quebrando em 4 linhas no mobile; 20 cards de indicador (ícone + valor + ícone de gráfico + info) que viram 20 cards empilhados (~3.000 px) no mobile; indicadores repetidos em "Dados Financeiros Detalhados" (média 7a) mais abaixo; "Análise Técnica · Compra"; H1 do relatório de IA gigante; Ben cobre o preço no mobile e o score no desktop; modal de e-mail; formatação mista (R$ 625.68B, 12.60%).

**Novo layout:**
1. **Resumo (acima da dobra)** — `AssetHeader` compartilhado (ver 5.9): linha 1 `PETR4` (text-2xl semibold) + "Petrobras PN · Petróleo e gás" (muted, sem badges); ações à direita: `Acompanhar` (sino), `Comparar`, `Backtest` (outline sm). Linha 2 — 4 `Stat`: **Preço** R$ 48,56 (delta do dia colorido) · **Preço justo** R$ 55,90 (modelo selecionado, com seletor) · **Margem de segurança** +15,1% (positive/negative) · **Score** 84/100 com rótulo "Bom". Timestamp "Atualizado 29 set., 13:00" abaixo.
2. **Navegação interna sticky** (tabs underline com âncoras): Valuation · Indicadores · Dividendos · Demonstrações · Análise IA · Técnica.
3. **Valuation**: `DataTable` — Modelo · Preço justo · Margem · Critérios (8/9) · status (ponto 8 px positive/warning/negative) · chevron; linha expande detalhes. Modelos premium para free: linha visível com valores borrados + cadeado + 1 CTA no rodapé da tabela.
4. **Indicadores**: um bloco, grupos com subtítulo (Valuation, Rentabilidade, Endividamento, Crescimento, Mercado); cada item = `label` · valor atual · "média 7a" em muted · delta vs média; clique abre o histórico (drawer). Grid 2 col mobile / 4 col desktop **sem cards individuais** (células separadas por hairline). Elimina a seção duplicada "Dados Financeiros Detalhados" e o card vazio "Petróleo Brasileiro S.A. – Petrobras / Dados anuais".
5. **Dividendos**: radar compacto (mantém) + link da calculadora de renda passiva (sai do cabeçalho).
6. **Demonstrações**: tabela anual (já existe e é o melhor componente da página — só formatação pt-BR e primeira coluna sticky no mobile).
7. **Análise IA**: rótulo "Gerado por IA em 26 set. 2026", prosa com escala reduzida, feedback 👍/👎 → ícones lucide `ThumbsUp/Down` sem emoji "📊 Avaliação da Comunidade".
8. **Técnica**: "Dentro da faixa estimada (R$ 43,78 – R$ 55,95)" sem a palavra "Compra".
9. Empresas relacionadas: tabela de 5 linhas (ticker · preço · margem · score).
Sem Ben popup, sem modal de e-mail (card "Acompanhar PETR4" inline).

### 5.3 FII / ETF / BDR (`src/app/fii/[ticker]/page.tsx`, `etf/…`, `bdr/…`, `fii-header-score.tsx`, `fii-strategic-analysis.tsx`)

- Três templates diferentes para a mesma pergunta: score em anel (ação), "93.0" laranja com barras (FII), "84" teal com barras (ETF); larguras de container diferentes; ETF sem timestamp consistente. → Todos usam `AssetHeader` + `ScoreCard` único (número + rótulo + barras finas neutras com a barra do fator em `brand`).
- **Bug visual:** ticker truncado "HGL…" (`fii/[ticker]/page.tsx:463`, `truncate` no H1 disputando espaço com 2 badges) e "V…" no card da comparação. Ticker nunca trunca (`shrink-0`); badges quebram linha ou somem.
- **Bugs de dado que destroem confiança** (do QA, confirmados na tela): DY exibido como "0.09%" (`page.tsx:539`, falta ×100) e preço-teto R$ 11,59 "-92,1% vs teto" enquanto o cabeçalho diz "+7,5%" (`fii-strategic-analysis.tsx:95-98`, dividendo mensal não anualizado; reaproveitar `lib/fii-listing-valuation.ts:54-69`). Corrigir antes de qualquer polimento.
- Bloco "Dados do Fundo Imobiliário" em caixa azul → grid de `Stat`/definição sem fundo colorido; "Backtest (indisponível)" desabilitado → esconder.
- ETF: retornos históricos em `Stat` com delta; tabela de participações já está boa (manter, com `tabular-nums`).

### 5.4 Dashboard `/dashboard` (`src/app/dashboard/page.tsx`)

**Problemas:** "Olá, Paula Premium (local)! 👋"; botão "✨ Premium" gradiente para quem já é premium; "Minha Conta" duplica o header; tiles de marketing ("Backtesting NOVO", "Comparador GRÁTIS", "Nova Análise" tracejado); "Boas empresas para analisar" em cards altos de 130 px cada; badge "Compra"; Ben popup.
**Novo:** título "Visão geral" + data; linha de 3–4 `Stat` (patrimônio total, retorno total, variação do dia, ativos no radar); **Radar** como `DataTable` (Ticker · Preço · Δ dia · Margem · Score · Status) com "Gerenciar"; **Carteiras** em tabela resumida (nome · patrimônio · retorno) + "Nova carteira"; **Rankings recentes** (lista de 5 linhas); "Boas empresas" como tabela de 5 linhas. Remover tiles de marketing, "Minha Conta", "Atividade (Rankings 1 / Carteiras 1)", emoji e o botão Premium.

### 5.5 Carteira `/carteira`

Banner tutorial vira link (ver §4). Retorno "+27,1%" hoje em badge preta → texto `text-positive`. Card único ocupando 1/3 da largura → lista/tabela de carteiras em largura total (nome · patrimônio · retorno · caixa · nº ativos · rebalanceamento · ações). "Ver sugestões" (verde sólido) e "Ver carteira" (outline) → "Abrir" primário e sugestões dentro da carteira.

### 5.6 Rankings `/ranking` e Backtest `/backtest`

Ambos abrem uma tela intermediária de escolha ("O que você quer fazer?" / "Bem-vindo ao Backtesting") com azulejos gradiente — um clique inútil. **Ranking:** cair direto no ranking Graham (modelo padrão, gratuito) com seletor de modelo em tabs/select no topo, parâmetros em painel colapsável e tabela de resultados; "Histórico" vira tab. Remover a faixa de título gradiente (`src/app/ranking/page.tsx`). **Backtest:** cair no configurador com uma carteira-exemplo pré-carregada (IBOV top 10, 5 anos) e "Minhas configurações" como tab; remover o card "Dica" azul (`backtest-welcome-screen.tsx`). Resultado do backtest (visto no mockup da home): 5 cards pastéis de cores diferentes (laranja/roxo/vermelho/azul/verde) → linha de `Stat` neutros, delta colorido só onde for ganho/perda.

### 5.7 Screening `/screening-acoes`, `/screening-fiis` (`src/components/screening/screening-hub-page.tsx`, `screening-configurator.tsx`)

**Problemas:** formulário de 1 coluna com ~2.000 px antes do botão "Buscar"; cada categoria tem uma cor (roxo, verde, azul, amarelo, vermelho); "Configurar com IA" em faixa gradiente; emoji nos selects (🏢 🌎 💯); presets com nomes clickbait; filtros de setor vazios (bug `/api/sectors` → 404, linha 176).
**Novo:** desktop em 2 painéis — filtros à esquerda (280 px, grupos colapsáveis neutros, contador "3 filtros ativos", "Limpar") e **resultados ao vivo** à direita (DataTable, contagem "42 ações", ordenação). Mobile: resultados primeiro + botão "Filtros (3)" que abre sheet. Presets como chips neutros com nomes descritivos. IA como campo inline no topo dos filtros (sem modal).

### 5.8 Comparador `/comparador`, `/compara-acoes/[...]`, `/comparador-etfs`, `/compara-etfs/[...]`

**Problemas:** gamificação ("#1 Ouro", "#2 Prata", troféus, fundo amarelo), ticker truncado, 1 card por indicador com pódio (6 cards por tela para comparar 2 números).
**Novo:** tabela única — linhas = indicadores (agrupados), colunas = ativos (até 6, primeira coluna sticky no mobile); melhor valor da linha em `font-semibold` + ponto `brand`; coluna "Média 7a" em muted opcional; resumo no topo: "PETR4 vence em 7 de 12 indicadores" em texto simples. Sem medalhas, sem coroa, sem fundo amarelo.

### 5.9 Componente compartilhado `AssetHeader` / `ScoreCard`

Criar `src/components/asset/asset-header.tsx` e `src/components/asset/score-card.tsx` usados por ação, FII, ETF, BDR, e pelos cabeçalhos de análise técnica/relatórios/radar-dividendos/[ticker]. Props: ticker, nome, tipo/setor, preço, delta, preçoJusto?, margem?, score?, ações[]. Resolve inconsistência, truncamento e o preço verde.

### 5.10 Radar de dividendos `/radar-dividendos` (`dividend-radar-page-content.tsx`)

- 2 parágrafos de SEO ("como ganhar dinheiro com dividendos…") + aviso azul **antes** da ferramenta → mover o texto de SEO para depois da tabela (mantém indexação, não empurra a ferramenta).
- Confirmado (azul) vs projetado (verde) usa verde semântico para estimativa → confirmado = ponto sólido `brand`, projetado = ponto vazado `brand` (contorno), com legenda; mostrar valor por ação no tooltip/célula.
- Coluna do mês atual com bordas pretas grossas → fundo `surface` sutil.
- Bug do QA: `/api/user/me` inexistente (linha 53) faz logado ver estado de deslogado.

### 5.11 Radar de oportunidades `/radar` (`radar-grid.tsx`)

8 pílulas vermelho/verde saturadas por linha ("árvore de Natal"). → coluna "Estratégias" com "6/8" + 8 pontos de 6 px (preenchido = aprovado, vazio = reprovado) e tooltip com nomes. "Entry Atenção/Compra" → "Técnica: dentro/acima da faixa". Legenda longa colorida no rodapé → tooltips nos cabeçalhos das colunas.

### 5.12 Análise técnica `/acao/[ticker]/analise-tecnica` (`technical-analysis-page.tsx`)

"Preço mínimo previsto" em vermelho e "máximo" em verde (cor semântica usada como rótulo) → ambos neutros, faixa desenhada num mini-gráfico. Remover "Compra". "Previsão de preços com IA (30 dias)" → "Faixa estimada (30 dias) · gerada por IA · não é recomendação". Bug: "SMA 200: R$ " vazio (linha 615) → `formatNullable` ("—"). "Sobrecompra" em badge vermelha sólida → badge `warning`.

### 5.13 Planos `/planos` (`src/app/planos/page.tsx`, `landing-pricing-section.tsx`)

**Problemas:** hero com "Escolha seu plano ideal" em gradiente e um botão "Ver planos" que só rola a página (planos só aparecem a ~1.300 px); "Apoie o projeto e nos ajude a crescer!" (soa como doação); cada plano com cor própria (azul/verde/roxo-rosa) e ícone-azulejo; "🔥 MELHOR VALOR" pill verde sobreposta; 15 emoji; linhas "💰 PIX: 15% OFF • Economize R$ 28,48" + "+ Economia de R$ 48,90" + "R$ 15,83 por mês" + "Apenas R$ 0,66 por dia" (4 âncoras de preço concorrentes); tabela comparativa com ❌; bloco de medo "-R$ 5.000 / -R$ 10.000"; inconsistência "350+ empresas" (planos) vs "+500" (home); premium logado não vê seu plano; exit intent.
**Novo:** H1 "Planos" + 1 linha; os 3 planos **acima da dobra**; todos neutros, o recomendado (Anual) com borda `brand` 2 px e rótulo "Recomendado" (sem emoji/caps); preço grande `tabular-nums` + **uma** linha auxiliar ("equivale a R$ 15,83/mês · 15% off no PIX"); lista de recursos com `Check` neutro (máx. 8 itens, o resto na tabela); 1 CTA por plano ("Começar 1 dia grátis"); tabela comparativa com `Check`/`Minus` lucide; FAQ curto de cobrança (cancelamento, PIX, reembolso). Remover o bloco de aversão à perda, o card de trial separado (a informação vai para o subtítulo) e o hero. Unificar o número de empresas em uma constante.

### 5.14 Auth `/login`, `/register`, `/esqueci-senha`

Já são as telas mais limpas. Ajustes: esconder ticker e faixa de busca nessas rotas; card de trial roxo com ícone-azulejo → uma linha muted acima do formulário "Inclui 1 dia de Premium grátis. Sem cartão."; botão "Cadastrar" → "Criar conta"; manter Google em primeiro.

### 5.15 Institucionais `/sobre`, `/metodologia`, `/como-funciona`, `/contato`, `/blog`

Todas repetem o template do `LandingHero` (pill + H1 bicolor + subtítulo com negritos + 3 micro-provas com ícones + 2 CTAs) seguido de 3 cards com ícone-azulejo ("Missão/Visão/Valores", "Valor intrínseco/Margem/Longo prazo", "Conteúdo especializado/Para todos/Sempre atualizado"). Esse é o padrão mais reconhecível de site gerado por IA.
- **Blog:** lista de artigos primeiro (título, resumo, data, tempo de leitura), filtro por categoria; sem hero e sem "Por que ler nosso blog".
- **Metodologia:** documento com índice lateral sticky, cada modelo com fórmula (bloco mono), critérios e limitações. É a página que mais gera confiança — tratar como documentação, não landing.
- **Sobre:** texto corrido curto (quem faz, por quê, fontes de dados, contato, CNPJ se houver). Remover Missão/Visão/Valores.
- **Como funciona:** 3 passos numerados com screenshot real cada.
- Post do blog: prosa 68ch, `text-base`, headings na escala reduzida.

### 5.16 Índices, P/L Bolsa, Setorial, Projeções, Calculadoras

- `/indices`: aviso legal em caixa amarela grande no topo → nota `text-xs` abaixo dos cards; cards de índice com sparkline em `chart-1` e benchmark cinza; FAQ com ícones → accordion simples.
- `/pl-bolsa`: gráfico com barras azuis serrilhadas (dados mensais desenhados como área + linha com alto contraste) → linha única `chart-1` 1,5 px, área 6%, média histórica tracejada cinza; filtros em linha acima do gráfico (não em card separado).
- `/analise-setorial`: 3 "stat cards" com ícones coloridos → linha de `Stat`; badge "TOP 1" amarela → remover (a ordem já diz); cada setor como tabela de 5 linhas.
- Calculadoras: mesmo `PageHeader`; resultado em `Stat` grande; formulário à esquerda, resultado à direita (desktop).
- `/calculadoras` retorna 404 → criar índice simples ou redirecionar para `/calculadoras/dividend-yield`.

---

## 6. Acessibilidade e mobile (transversal)

- Modais custom → `ui/dialog` (foco, Esc, `aria-labelledby`, X com `aria-label="Fechar"`).
- Contraste: `muted-foreground` atual `oklch(0.556 0 0)` ~4,6:1; textos `text-xs` em `text-gray-400/500` em vários cards ficam abaixo de 4,5:1 → usar o token.
- Cor nunca é o único canal: status de estratégia = ponto + texto ("Atende 8/9").
- Alvos de toque ≥ 44 px no mobile (21 alvos < 40 px visíveis na home mobile, medido).
- `prefers-reduced-motion`: desligar marquee, `animate-bounce` (12 usos) e `animate-pulse` decorativo (50 usos; manter só em skeleton).
- Tabelas no mobile: rolagem horizontal com 1ª coluna sticky em vez de transformar cada linha em card alto.
- FAB/barras fixas não podem cobrir conteúdo: reservar `padding-bottom` quando visíveis.

---

## 7. Plano de execução sugerido (ordem)

1. **Fundação (1–2 dias):** corrigir fonte; tokens em `globals.css`; `button`, `badge`, `card`, `tabs`, `table` atualizados; `lib/format.ts`; `Stat`, `SectionHeader`, `PageHeader`, `DataTable`; script `check-ui.sh`.
2. **Shell + interrupções (1 dia):** header com busca integrada, ticker fora do global, footer; desligar modal de e-mail automático, Ben proativo, modal do screening; exit-intent vira card.
3. **Confiança (0,5 dia):** remover selo/`aggregateRating`, estatísticas sem fonte, "Compra"/"Sinal compra"; corrigir bugs de dado do FII; unificar "+500".
4. **Página de ativo (2–3 dias):** `AssetHeader`/`ScoreCard`, tabela de valuation, grade de indicadores única, nav interna; aplicar em ação → FII → ETF → BDR.
5. **Home + Planos (2 dias).**
6. **Dashboard, Ranking, Backtest, Screening, Comparador, Radares (4–5 dias).**
7. **Institucionais + blog (1–2 dias).**
8. Rodar `scripts/local/screenshots.ts --auth both` e comparar com `baseline/`; critérios de aceite de cada item abaixo.

Critérios globais de aceite: `grep -c bg-gradient-to src` cai > 90% (só logo/allowlist); zero emoji em `.tsx` de UI; nenhuma tela com ponto decimal/sufixo "B"/"N/A"; home ≤ 6.000 px desktop e ≤ 9.000 px mobile; nenhuma interrupção automática nos primeiros 30 s em nenhuma rota; `document.fonts` com Geist carregada; nenhum popup cobre preço/score em 390 × 844.
