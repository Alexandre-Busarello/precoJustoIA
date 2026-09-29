# Preço Justo AI — Relatório de Simplificação (rotas, IA, arquitetura frontend)

Branch: `melhorias/ux-ui-mobile` · Data: 2026-09-29 · Escopo: somente leitura (nenhum arquivo do projeto foi alterado, nenhum comando tocou o banco de produção).

Metodologia:
- Inventário de `src/app` (94 páginas, 232 route handlers de API, 6 sitemaps XML + `sitemap.ts`, `robots.ts`).
- Grafo de imports real (script Node que resolve `@/` e imports relativos; raízes = arquivos especiais do App Router (`page`, `layout`, `route`, `sitemap`, `robots`, `manifest`), `src/middleware.ts` e `scripts/**`). Um arquivo é "morto" quando não é alcançável a partir dessas raízes.
- Verificação HTTP no dev server local (`http://localhost:3100`, banco local Docker) para `<title>`, `canonical`, status e redirects.
- `npx eslint src` (JSON), `grep` para dependências.

---

## 0. Achados críticos (ler primeiro)

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| C1 | **`src/middleware.ts` não está rodando.** Existe um `middleware.ts` na raiz do repo (no-op, de out/2025) que tem precedência. | `.next/server/middleware-manifest.json` só contém os matchers da raiz (`/acao/:ticker*`, `/fii/:ticker*`, `/bdr/:ticker*`, `/etf/:ticker*`). No dev local: `GET /upgrade` → 404 (deveria ser 301 → `/checkout`), `GET /fundador` → 404 (deveria ser 410), `GET /acao/PETR4` → 404 sem redirect para minúsculas. | Sem rate-limit global em `/api/*`, sem o gate de token em `/admin`, sem o 410 do `/fundador` (**a intenção do último commit `5777118` não está valendo**), sem normalização de tickers (crawl budget). Confirmar em produção com `curl -I https://precojusto.ai/upgrade` (não rodei nada contra produção). |
| C2 | **`/ranking` publica canonical = homepage.** A página é `"use client"` e usa `next/head` (ignorado no App Router). | `curl localhost:3100/ranking` → `<title>Preço Justo AI - Análise Fundamentalista de Ações B3 com IA</title>` e `canonical="https://precojusto.ai"`. Está no sitemap (prioridade 0.9) e tem 31 arquivos linkando para ela. | O Google trata `/ranking` como duplicata da home. |
| C3 | **Canonical `'/'` herdado do root layout.** Oito páginas públicas não definem canonical e herdam `alternates.canonical: '/'` de `src/app/layout.tsx`. | Verificado via curl: `/como-funciona`, `/sobre`, `/contato`, `/arbitragem-divida`, `/projecoes-ibov` → `canonical="https://precojusto.ai"`. Também: `/termos-de-uso`, `/lgpd`, `/oferta`. `/projecoes-ibov` também herda o `<title>` genérico (página client, sem layout). | Todas apontam para a home como canônica. |
| C4 | **`/backtest` (no sitemap, 0.8) redireciona anônimos para login.** `backtest/layout.tsx` faz `redirect('/login?redirect=/backtest')` e `redirect('/dashboard?upgrade=backtest')` para usuários free, então a landing para anônimos que já existe em `backtest/page.tsx` nunca aparece. | `curl -I localhost:3100/backtest` → `307 location: /login?redirect=/backtest`. | O Googlebot recebe 307, e é por isso que existe a LP duplicada `/backtesting-carteiras`. |
| C5 | **Endpoints de IA públicos sem autenticação.** `POST /api/generate-analysis` e `POST /api/review-analysis` chamam o Gemini sem nenhuma checagem de sessão, admin ou secret. | `grep` não encontrou `getServerSession`/`requireAdmin`/`authorization` nesses arquivos. Nenhum `fetch` no front: o único consumidor importa as funções `*Internal` diretamente (`api/ai-reports/[ticker]/generate/route.ts:6-7`). | Qualquer pessoa pode gerar custo de IA (e sem o rate-limit do C1). |
| C6 | **Títulos com marca duplicada.** O template do root é `"%s \| Preço Justo AI - Análise Fundamentalista Ações B3"` e quase toda página já termina com "- Preço Justo AI". | Ex.: `/planos` → "Planos e Preços \| ... R$ 19,90/mês - Preço Justo AI \| Preço Justo AI - Análise Fundamentalista Ações B3". | Títulos de 120+ caracteres, truncados na SERP. |

---

## 1. Inventário de rotas por feature

### 1.1 Páginas públicas (marketing + SEO)

| Feature | Rotas | Sitemap / robots | Observações |
|---|---|---|---|
| Home | `/` | sitemap 1.0 | 1293 linhas; renderiza `QuickRanker` (3851 linhas, client) |
| Páginas de ativo | `/acao/[t]`, `/acao/[t]/analise-tecnica`, `/acao/[t]/entendendo-score`, `/acao/[t]/relatorios[/id]`, `/bdr/[t]` (+ analise-tecnica, relatorios), `/etf/[t]` (+ analise-tecnica), `/fii/[t]` | sitemap-companies, sitemap-technical-analysis, sitemap.ts (FII/ETF) | acao x bdr ≈ 80% iguais (diff de 384 linhas em 1117/944); analise-tecnica acao x bdr: só 55 linhas diferentes |
| Descoberta | `/screening-acoes`, `/screening-acoes/[slug]` (5 presets SEO), `/screening-fiis`, `/ranking`, `/analisar-acoes` | screening 0.9, presets 0.85, ranking 0.9; `/analisar-acoes` **fora do sitemap e sem nenhum link interno** | `/ranking`: C2 |
| Comparação | `/comparador` (hub de ações), `/compara-acoes/[...t]` (resultado), `/comparador-etfs` (hub de ETFs), `/compara-etfs/[...t]` (resultado, `noindex`) | `/comparador` 0.8; sitemap-comparisons (compara-acoes) | Dois hubs de comparação separados |
| Dividendos | `/radar-dividendos`, `/radar-dividendos/[t]`, `/calculadoras/dividend-yield` (+ `[t]/report`) | 0.9 | ok |
| Macro / setores | `/pl-bolsa`, `/analise-setorial`, `/projecoes-ibov`, `/indices`, `/indices/[t]` | 0.9 / 0.7 / (projecoes fora) / 0.9 | `/projecoes-ibov`: C3 |
| Backtest | `/backtest` (ferramenta + LP), `/backtesting-carteiras` (LP) | backtest 0.8 (mas 307, C4); backtesting-carteiras só no robots allow | Duplicação causada pelo C4 |
| Monitoramento | `/acompanhar-acoes-bolsa-de-valores` (LP + form) | 0.95 | Manter (SEO forte) |
| Calculadoras | `/calculadoras/recuperacao`, `/arbitragem-divida` | 0.95 / fora | `/arbitragem-divida`: C3 |
| Conteúdo | `/blog`, `/blog/[slug]`, `/metodologia`, `/como-funciona`, `/sobre`, `/contato` | sitemap-blog, 0.8 | C3 em como-funciona, sobre e contato |
| Comercial | `/planos`, `/oferta` (LP de ads, sem header), `/parceiros/[slug]`, `/checkout/*` (5 rotas) | planos no robots allow; parceiros 0.8 | "Preços" no header aponta para `/#pricing`, não para `/planos` |
| Legal | `/termos-de-uso`, `/lgpd` | disallow (robots) | footer tem LGPD duplicado e 2 links `href="#"` |

### 1.2 App logado

| Feature | Rotas |
|---|---|
| Início | `/dashboard` (859 linhas, página inteira client) |
| Carteiras | `/carteira`, `/carteira/nova`, `/carteira/tutorial`, `/carteira/[id]` (+ `analise`, `config`, `sugestoes`, `transacoes`) |
| Alertas / monitoramento | `/radar` (watchlist, login), `/dashboard/subscriptions`, `/dashboard/monitoramentos-customizados` (+ `criar`, `editar/[id]`), `/notificacoes`, `/quiz/[id]` |
| Conta | `/perfil`, `/conversas-ben`, `/share/ben/[token]`, `/suporte` |
| Auth | `/login`, `/register`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`, `/unsubscribe/[token]` |
| Admin | 15 páginas em `/admin/*` (inclui `/admin/yahoo-debug`, `/admin/cache-monitor`) |

### 1.3 APIs (232)
Grupos: `admin` (47), `portfolio` (29), `cron` (20), `indices` (9), `notifications` (12), `ben` (9), `backtest` (8), `auth` (10), `webhooks` (4), `v1` (5, pública/parceiros), demais utilitários.

API routes sem nenhuma referência no código, em `scripts/` ou no `vercel.json` (27). **Antes de cortar, conferir nos logs da Vercel**, porque algumas são chamadas de fora:
- **Chamadas de fora (manter):** `/api/webhooks/cakto`, `/api/webhooks/kiwify`, `/api/v1/financial-data[/t]`, `/api/blog/generate-post` (usa secret), `/api/admin/*` operacionais (`ip-blocks`, `etf-ingestion/logs`, `indices/[id]/fix-starting-point`, `indices/recalculate-all-dividends`, `notifications/campaign/[id]/recalculate-stats`).
- **Candidatas a corte:** `/api/debug/user-status` (debug; chama `syncUserSubscription`, que escreve no banco), `/api/cache/stats`, `/api/compara-etfs`, `/api/fii-analysis/[t]`, `/api/company-flags/[t]`, `/api/user/trial-status`, `/api/backtest/historical-data`, `/api/auth/link-google-account`, `/api/dividend-radar/reprocess/[t]`, `/api/indices/[t]/{composition,history,rebalance-log,asset-performance/[a]}`, `/api/portfolio/[id]/transactions/{confirm-batch,reject-batch,cleanup-duplicates,suggestions/status}`.

---

## 2. Duplicatas e sobreposições

| Grupo | Situação | Decisão |
|---|---|---|
| `comparador` x `comparador-etfs` | Dois hubs com a mesma função (escolher tickers → página de resultado). | **MERGE**: abas "Ações \| ETFs" em `/comparador` (reusar `EtfComparisonSelector`). Redirect permanente `/comparador-etfs → /comparador`. Resultados continuam separados (`/compara-acoes/*` é SEO pesado; `/compara-etfs/*` é noindex). |
| `compara-acoes` x `compara-etfs` | Páginas de resultado (1700 e 618 linhas). | **KEEP** as duas URLs. No futuro, extrair uma tabela de comparação comum. |
| `screening-acoes` x `ranking` x `analisar-acoes` | Screening = filtros livres; Ranking = estratégias (Graham, Barsi...); analisar-acoes = caixa de busca + preview (LP órfã). | **KEEP** screening e ranking como produtos distintos, mas no menu ficam sob "Descobrir". `/analisar-acoes`: **MERGE condicional** (checar GSC; com pouco tráfego, 301 → `/`). |
| `backtest` x `backtesting-carteiras` | LP duplicada porque `/backtest` bloqueia anônimos (C4). | **MERGE** depois de corrigir o C4: 301 `/backtesting-carteiras → /backtest`. |
| `radar` x `radar-dividendos` | Nomes quase iguais para coisas diferentes: watchlist logada x calendário público de dividendos. | **KEEP** as rotas. Renomear o label de `/radar` para "Minha Watchlist"/"Meus Alertas" e movê-lo para o grupo Alertas. |
| `acompanhar-acoes-bolsa-de-valores` x `dashboard/subscriptions` x `dashboard/monitoramentos-customizados` x `radar` | 4 superfícies para "me avise quando...". | **KEEP** a LP (sitemap 0.95). No app, **MERGE** em um hub "Alertas" com abas (rotas logadas, não indexadas, então dá para usar redirect sem risco de SEO). |
| `planos` x `/#pricing` x `oferta` x `checkout/oferta-especial` | Header "Preços" leva a uma âncora na home; `/planos` é a página canônica de preços. | **KEEP** `/planos` como destino único do nav; `/oferta` fica como LP de ads (sem link no nav). |
| `contato` x `suporte` | Público x tickets premium. | **KEEP** as duas. |
| `como-funciona` x `metodologia` x `sobre` | Conteúdo institucional. | **KEEP** e corrigir os canonicals (C3). No footer, deixar só um link para cada. |
| Header dropdowns x `mobile-nav.tsx` x `tools-dropdown.tsx` | A lista de itens de menu está escrita 3 vezes; `tools-dropdown` está morto. | **MERGE** em uma config única de navegação. |
| `optimized-*` x originais | `checkout-form` (morto) → `card-payment`, `pix-payment` (mortos por transitividade); em uso: `optimized-checkout`, `optimized-card-payment`, `optimized-pix-payment`. | **CUT** os originais. |
| `stock-comparison-selector` x `enhanced-stock-comparison-selector` | O original só é usado por `comparador/page-old.tsx`. | **CUT** o original. |
| `notification-modal` x `simple-notification-modal` | Dois modais de notificação (dashboard x bell/página). | **KEEP** por ora; unificar depois. |

---

## 3. Código morto (confirmado por grafo de imports + grep)

35 arquivos, ~7.400 linhas (excluí `src/types/next-auth.d.ts`, que é declaração global de tipos e é usado implicitamente).

Backups e versões antigas em `src/app` (não são rotas: só `page.tsx` vira rota):
- `src/app/ranking/page-old.tsx` (226), `page-backup.tsx` (226), `page-new.tsx` (567)
- `src/app/comparador/page-old.tsx` (340)
- `src/components/admin-ticket-details-dialog-backup.tsx` (2)

Componentes sem importador:
`ai-analysis.tsx` (694), `asset-type-hub-wrapper.tsx` (34) → `asset-type-hub.tsx` (167), `hub-metadata.tsx` (49, usa `next/head`), `seo-content-hub.tsx` (251), `auth-modal.tsx` (208), `blur-card.tsx` (70), `checkout-form.tsx` (250) → `card-payment.tsx` (182), `pix-payment.tsx` (240), `generate-backtest-modal.tsx` (199), `mobile-wizard-wrapper.tsx` (115), `overall-score-card.tsx` (311), `portfolio-ai-cta.tsx` (198), `portfolio-negative-cash-alert.tsx` (326), `portfolio-transaction-ai-cta.tsx` (187), `ranking-history.tsx` (336), `seo-structured-data.tsx` (258), `stock-comparison-selector.tsx` (159), `subscription-manager.tsx` (283), `tools-dropdown.tsx` (312), `trial-banner.tsx` (64), `trial-notification.tsx` (82), `ui/form.tsx` (168).

Libs sem importador: `src/lib/admin-auth.ts` (134), `ben-quick-actions.ts` (71), `dashboard-tips.ts` (224), `security-middleware.ts` (337), `simple-premium-check.ts` (18), `stripe-client.ts` (117).

Outros:
- `middleware.ts` na raiz: no-op que desativa o `src/middleware.ts` (C1). **Remover.**
- Diretórios vazios (não versionados): `src/app/test-markdown/`, `src/app/early-adopter/`, `src/contexts/`. O `robots.ts` ainda faz disallow de `/test-markdown/`, o que anuncia a rota.

## 4. Dependências

| Pacote | Uso encontrado | Ação |
|---|---|---|
| `@next-auth/prisma-adapter` | 0 (o código usa `@auth/prisma-adapter`) | **Remover** |
| `@hookform/resolvers` | 0 | **Remover** |
| `react-hook-form` | só `ui/form.tsx` (morto) | **Remover** junto com `ui/form.tsx` |
| `rehype-highlight` | 0 | **Remover** |
| `framer-motion` | 1 arquivo (`ranking-wizard/ranking-wizard.tsx`) | Trocar por transição CSS (`tw-animate-css` já instalado) e remover |
| `@stripe/stripe-js` | `optimized-card-payment`, `card-payment` (morto), `stripe-client` (morto) | Manter |
| `@types/nodemailer` | tipos | Mover para `devDependencies` |
| `react-is` | 0 imports, mas é peer do `recharts` | **Manter** |
| `server-only`, `tsx`, `cheerio`, `gray-matter`, `axios`, `dotenv` | usados em `src/lib` ou `scripts/` | Manter |

Script morto no `package.json`: `debug:api` (curl para `/api/debug-ranking-history`, que não existe).

---

## 5. Navegação / Arquitetura de Informação

### 5.1 Estado atual
- **Desktop logado:** Dashboard · Oportunidades (6 itens em 2 grupos) · Análise & Estratégia (8 itens em 4 grupos) · Carteiras (2) · Suporte · Sino · Avatar (5 itens). São 16 destinos a 1 clique, com nomes que se sobrepõem ("Radar de Oportunidades" x "Radar de Dividendos"; "Carteiras" x "Carteiras Teóricas").
- **Desktop anônimo:** Oportunidades · Análise & Estratégia · Preços (`/#pricing`) · Entrar · Registrar.
- **Mobile:** `mobile-nav.tsx` (878 linhas) reescreve as mesmas listas à mão.
- **Footer:** "Metodologia" 2×, "Blog" 2×, "LGPD" 2×, `href="#"` em "Status da Plataforma" e "Disclaimer", link para `/backtesting-carteiras`. Não linka `/planos`, `/indices`, `/radar-dividendos` nem `/screening-fiis`.
- **Dashboard:** 11 blocos empilhados (banner de verificação de e-mail, banner de trial, notificação/banner, radar, carteiras, CTA de carteiras, ação principal, "Suas análises recentes" + "Criar novo ranking", ferramentas rápidas, análises recomendadas, histórico de rankings (o mesmo conteúdo do card "recentes"), WhatsApp, info da conta, atividade) + FAB do Ben + modais.

### 5.2 Proposta (máx. 5 itens primários)

**Nav de marketing (anônimo):**
1. **Descobrir** → dropdown: Screening de Ações, Screening de FIIs, Rankings por estratégia, Radar de Dividendos, Índices teóricos
2. **Ferramentas** → Comparador (Ações/ETFs), Backtest, Análise Setorial, P/L da Bolsa, Calculadoras (DY, Recuperação, Arbitragem de dívida)
3. **Aprender** → Blog, Metodologia, Como funciona
4. **Planos** → `/planos`
5. CTA: **Entrar** / **Criar conta grátis**

**Nav do app (logado):**
1. **Início** (`/dashboard`)
2. **Descobrir** (mesmo dropdown do marketing)
3. **Carteiras** → Minhas carteiras, Backtest, Carteiras teóricas (`/indices`)
4. **Alertas** → Watchlist (`/radar`), Alertas de preço (`/dashboard/subscriptions`), Monitoramentos customizados, Notificações
5. **Ferramentas** (Comparador, Setorial, P/L, Projeções IBOV, Calculadoras)
- Direita: busca global, sino, avatar (Perfil, Assinatura, Conversas com Ben, Suporte, Sair). Suporte sai do nav e vai para o avatar.

**Implementação:** um único `src/lib/navigation.ts` com `{ marketing: Section[], app: Section[], account: Item[] }`, consumido pelo header desktop, pelo `mobile-nav` e pelo footer. `tools-dropdown.tsx` é deletado. `oportunidades-dropdown`, `analise-estrategia-dropdown` e `carteiras-dropdown` viram um único `NavDropdown` genérico.

**Dashboard:** reduzir para 4 blocos: (1) um único banner de status (prioridade: verificação de e-mail > trial > campanha), (2) Carteiras/Watchlist, (3) Continuar de onde parou (histórico de rankings, uma vez só), (4) Recomendações. Info da conta e atividade vão para `/perfil`.

### 5.3 Regras de SEO respeitadas
- Nada que esteja no sitemap ou no robots allow é deletado; só há merges via `redirects()` em `next.config.ts` (`permanent: true`, 308).
- Route groups `(marketing)` e `(app)` não mudam URLs.
- Redirects declarativos em `next.config.ts` funcionam mesmo com o problema de middleware do C1. Mover o `/upgrade → /checkout` para lá também.
- **Não** mover `/webhooks/stripe` para redirect: o Stripe não segue 301 em POST. Manter como está (ou apontar o webhook direto para `/api/webhooks/stripe` no painel).

### 5.4 Redirects propostos (`next.config.ts`)
```ts
async redirects() {
  return [
    // após corrigir backtest/layout.tsx (C4)
    { source: '/backtesting-carteiras', destination: '/backtest', permanent: true },
    // após adicionar aba ETFs em /comparador
    { source: '/comparador-etfs', destination: '/comparador', permanent: true },
    // já existia no middleware (inativo): declarativo é mais robusto
    { source: '/upgrade', destination: '/checkout', permanent: true },
    { source: '/upgrade/:path*', destination: '/checkout', permanent: true },
    // condicional (checar GSC antes):
    // { source: '/analisar-acoes', destination: '/', permanent: true },
  ]
}
```

---

## 6. Arquitetura frontend: problemas que pioram UX e performance

| Problema | Evidência | Recomendação |
|---|---|---|
| Componentes client gigantes | `quick-ranker.tsx` 3851 linhas (usado na home e no wizard), `strategic-analysis-client.tsx` 2502, `backtest-results.tsx` 1848, `screening-configurator.tsx` 1626, `compara-acoes/[...t]/page.tsx` 1700, `mobile-nav.tsx` 878, `dashboard/page.tsx` 859 (página inteira `"use client"`). 308 arquivos `use client`; só 2 usam `next/dynamic`. | Carregar `QuickRanker` na home com `dynamic()` (abaixo da dobra). Dividir o dashboard em server shell + ilhas client. |
| Páginas de ativo duplicadas | acao x bdr: 384 linhas diferentes em ~1000; analise-tecnica acao x bdr: 55 em ~300; relatorios acao x bdr: ~150-180. | Extrair `AssetPageLayout` e `TechnicalAnalysisPage` compartilhados (P2, L). |
| Lógica de fetch duplicada | 75 arquivos com `useEffect + fetch` manual contra 59 com React Query. `use-dashboard-data.ts`, `use-company-data.ts` e `use-user-data.ts` repetem cerca de 10 vezes o mesmo bloco de persistência em localStorage (`getInitialData`/`saveQueryCache`/refs), o que gera 13 warnings `exhaustive-deps` (array `queryKey` recriado a cada render faz o effect rodar em todo render). | Criar `usePersistedQuery(queryKey, fn, {staleTime})` ou usar `@tanstack/react-query-persist-client`. |
| Loading states inconsistentes | 0 `loading.tsx`, 0 `error.tsx`; 60 arquivos com `Loader2 animate-spin`; 13 páginas com spinner de tela cheia; `Skeleton` usado em só 6 arquivos. Header mostra o texto "Carregando..." enquanto a sessão carrega. | `loading.tsx` com skeleton em `acao/[ticker]`, `fii`, `bdr`, `etf`, `dashboard`, `carteira/[id]`; um `error.tsx` na raiz. Header: skeleton com largura fixa (evita CLS). |
| Vários sistemas de interrupção | Montados globalmente ou por página: `OnboardingProvider` (modal + banner), `ExitIntentProvider`, `NotificationModalsWrapper` (notificação + quiz), `BenProactivePopup` (via `BenChatFAB`, montado em 11 páginas), `EmailCaptureModal` (acao), `DividendYieldRegisterModal`, + 5 banners no dashboard. 8 overlays `fixed inset-0` feitos à mão fora do `ui/dialog`. 8 `alert()`/`confirm()` nativos. | Um `InterruptionProvider` com fila e prioridade (máx. 1 modal por sessão/página). `BenChatFAB` no layout. Trocar `confirm()` por `AlertDialog`. |
| Toasts | Um único Toaster (sonner) no layout; `@/hooks/use-toast` é um wrapper de sonner (45 arquivos) e 14 arquivos usam `sonner` direto. | Ok funcionalmente; padronizar em um dos dois. |
| framer-motion | 1 arquivo. | Remover (CSS). |
| Variantes inconsistentes | 683 classes `bg-gradient-to-*` em 151 arquivos; 40 `<Button className="...bg-gradient...">` (variante "premium" copiada e colada); 47 `<button>` crus; 164 hex hardcoded em TSX. | Adicionar `variant="premium"` e `variant="success"` no `button.tsx` (cva) e trocar as 40 ocorrências. |
| Footer por página | `Footer` importado em 29 páginas e ausente em outras (ex.: `/ranking`, `/screening-acoes`, `/pl-bolsa`, `/calculadoras/*`). | Route group `(marketing)/layout.tsx` com Footer. |
| `console.log` | 2367 ocorrências em `src`. | `removeConsole` no compiler do Next para produção (exceto error/warn). |
| `next.config.ts` | `eslint.ignoreDuringBuilds: true`. | Depois de zerar os erros, tornar `npx eslint src` bloqueante no CI (não no build, que roda `prisma db push`). |

---

## 7. ESLint (`npx eslint src`)

Total: **6 erros, 454 warnings**, em 211 arquivos.

**Erros (6):** todos `react/no-unescaped-entities` em `src/components/parceiros/clube-dos-dividendos/sections/features-portfolio.tsx:47`, nas aspas `"` de: `Exemplos: "Venda de 50 BBAS3 por R$ 58,00" · "Dividendo de TAEE11: R$ 1,12 por ação" · "Aporte de R$ 5.000 hoje"`. Correção: trocar por `&ldquo;…&rdquo;` ou `{'"'}`.

**Warnings por classe:**
| Regra | Qtde | Nota |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 426 | 305 são imports não usados (ex.: `src/app/page.tsx` importa `CheckCircle` e `User` sem usar). Maiores ofensores: `lib/strategies/overall-score.ts` (11), `api/rank-builder/route.ts` (10), `api/webhooks/stripe/route.ts` (9), `conversas-ben/page.tsx` (9), `planos/page.tsx` (9) |
| `react-hooks/exhaustive-deps` | 23 | 13 no padrão `queryKey` dos hooks de dados (ver seção 6); os demais são `fetchX` fora das deps (admin, `backtest-config-history`, `convert-backtest-modal`, `enhanced-stock-comparison-selector`, `radar-ticker-input`) |
| `@next/next/no-img-element` | 3 | `acao/[t]/relatorios/[id]`, `bdr/[t]/relatorios`, `bdr/[t]/relatorios/[id]` |
| diretiva `eslint-disable` sem uso | 2 | `kiwify-checkout-link.tsx:115,149` |

`npx tsc --noEmit` está limpo. Todas as remoções propostas foram escolhidas para manter isso (nenhum arquivo removido tem importador).

---

## 8. Tabela CUT / MERGE / KEEP

| Item | Decisão | Como / redirect | Risco |
|---|---|---|---|
| `middleware.ts` (raiz) | **CUT** | `git rm middleware.ts`; testar `/upgrade` (301), `/fundador` (410), `/acao/PETR4` (301), chamadas `/api/*` (rate-limit) | Médio: liga comportamentos que estavam desligados (rate-limit, redirects de query string em `/acao`). Testar no dev antes. |
| `ranking/page-old.tsx`, `page-backup.tsx`, `page-new.tsx`, `comparador/page-old.tsx`, `admin-ticket-details-dialog-backup.tsx` | **CUT** | sem importadores | Nenhum |
| 24 componentes mortos (seção 3) | **CUT** | sem importadores (grafo) | Nenhum |
| 6 libs mortas (seção 3) | **CUT** | sem importadores | Nenhum |
| `tools-dropdown.tsx` | **CUT** | sem importadores | Nenhum |
| Dirs vazios `test-markdown`, `early-adopter`, `src/contexts` + disallow `/test-markdown/` no robots | **CUT** | — | Nenhum |
| `@next-auth/prisma-adapter`, `@hookform/resolvers`, `react-hook-form`, `rehype-highlight`, `framer-motion` | **CUT** | ver seção 4 | Baixo |
| `/api/generate-analysis`, `/api/review-analysis` (handlers HTTP) | **CUT** (as funções vão para `src/lib`) | mover `generateAnalysisInternal`/`reviewAnalysisInternal` para `src/lib/ai/` | Baixo |
| `/api/debug/user-status` | **CUT** | sem chamadores | Baixo |
| `/backtesting-carteiras` | **MERGE → `/backtest`** | 301 depois de corrigir o gate do layout | Baixo, se o C4 for corrigido antes |
| `/comparador-etfs` | **MERGE → `/comparador`** (aba ETFs) | 301 | Baixo |
| `/analisar-acoes` | **MERGE condicional → `/`** | só depois de checar GSC/Ads | Médio (possível LP de ads) |
| `/dashboard/subscriptions` + `/dashboard/monitoramentos-customizados` + `/radar` | **MERGE** (hub "Alertas" com abas) | redirects internos (rotas logadas, sem SEO) | Baixo |
| `/ranking` | **KEEP** + consertar metadata | server `page.tsx` + `ranking-client.tsx` | — |
| `/screening-acoes`, `/screening-acoes/[slug]`, `/screening-fiis` | **KEEP** | — | — |
| `/compara-acoes/*`, `/compara-etfs/*` | **KEEP** | — | — |
| `/radar-dividendos`, `/acompanhar-acoes-bolsa-de-valores`, `/pl-bolsa`, `/analise-setorial`, `/indices`, `/calculadoras/*`, `/metodologia`, `/blog` | **KEEP** | — | — |
| `/como-funciona`, `/sobre`, `/contato`, `/arbitragem-divida`, `/projecoes-ibov`, `/termos-de-uso`, `/lgpd`, `/oferta` | **KEEP** + canonical próprio | — | — |
| `/oferta`, `/checkout/oferta-especial`, `/parceiros/[slug]` | **KEEP** (funil de ads/parceiros; fora do nav) | — | — |
| `/admin/yahoo-debug`, `/admin/cache-monitor` | **KEEP** (atrás de `requireAdmin`); avaliar corte depois | — | — |

---

## 9. Ordem sugerida de execução
1. C1 (middleware), C5 (endpoints de IA), C2 e C3 (canonical e metadata): correções pequenas com impacto alto.
2. Remoção de código morto e dependências, com `tsc --noEmit` e `eslint` como gate.
3. C4 + merge backtest, merge do comparador, títulos (C6).
4. Config única de navegação + nova IA + footer.
5. Loading states, fila de interrupções, `usePersistedQuery`, route groups.
6. Unificação das páginas de ativo (acao/bdr).

Lembrete de segurança: **não validar com `yarn build`** (roda `prisma db push` contra o `.env` de produção). Validar com `npx tsc --noEmit`, `npx eslint src` e o dev server local (`:3100`, banco Docker).
