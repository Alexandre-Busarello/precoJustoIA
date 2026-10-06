# Ambiente local de QA (Preço Justo AI)

Harness para rodar o app **100% local** (Postgres em Docker + dev server), com dados fictícios
plausíveis e captura automatizada de screenshots para revisão de UX/mobile.

> ⚠️ **O `.env` do repositório aponta para o banco de PRODUÇÃO (Neon).**
> Nunca rode `yarn build`/`npm run build` (executa `prisma db push`), `prisma db push/migrate/reset`
> ou qualquer script de `scripts/` sem sobrescrever `DATABASE_URL`/`DIRECT_URL` **no mesmo comando**.
> O Next.js e o Prisma **não** sobrescrevem variáveis já definidas no ambiente, por isso a
> sobrescrita inline funciona — mas esquecer dela significa falar com produção.

## 1. Subir o Postgres local

```bash
docker run -d --name pja-local-db \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pja \
  -p 55432:5432 postgres:17

# (já existe? só inicie)  docker start pja-local-db
```

Defina a URL local (use sempre no mesmo shell/comando):

```bash
export LOCAL_DB=postgresql://postgres:local@localhost:55432/pja
```

## 2. Criar o schema (somente local)

```bash
DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx prisma db push --skip-generate
```

Confira no output que o datasource é `localhost:55432` antes de confirmar qualquer coisa.

## 3. Popular com dados de teste

```bash
DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx tsx scripts/local/seed-local.ts
```

- A primeira linha lógica do script **aborta** se `DATABASE_URL` (e `DIRECT_URL`/`BACKGROUND_PROCESS_POSTGRES`,
  se definidos) não apontarem para `localhost`/`127.0.0.1`.
- É idempotente: faz `TRUNCATE ... CASCADE` (local) das tabelas que semeia e reinsere tudo (~6 s).
- O que é criado:
  - 25 ações (PETR4, VALE3, ITUB4, BBDC4, BBAS3, WEGE3, TAEE11, EGIE3, ABEV3, MGLU3, RENT3, SUZB3, PRIO3,
    B3SA3, ELET3, RADL3, SBSP3, CMIG4, KLBN11, VIVT3, BBSE3, CPLE6, LREN3, HAPV3, EMBR3),
    3 BDRs (AAPL34, MSFT34, NVDC34), 6 FIIs (HGLG11, MXRF11, KNRI11, XPML11, VISC11, BTLG11) e
    4 ETFs (BOVA11, IVVB11, SMAL11, DIVO11) com setor/indústria no padrão B3 usado pelo app.
  - `FinancialData` de 8 anos (ano corrente = TTM), DRE/Balanço/DFC/KeyStatistics/DVA anuais,
    preços mensais de 10 anos (`1mo`) + diários de 1 ano (`1d`), `DailyQuote` de ~3 anos,
    dividendos de 5 anos (JCP/dividendos/rendimentos), oscilações de preço, `FiiData`, `EtfData` + holdings.
  - Usuários: `premium@local.test` / `Local123!` (PREMIUM ativo por 1 ano) e `free@local.test` / `Local123!`
    (FREE, trial já expirado). E-mails verificados, onboarding já visto, notificações por e-mail desligadas.
  - Carteira "Carteira Dividendos" com 12 meses de transações confirmadas, config de Radar, histórico de ranking
    (tudo do usuário premium), 3 posts de blog publicados, ofertas MONTHLY/ANNUAL (R$ 19,90 / R$ 189,90),
    histórico do P/L da bolsa desde 2010, índices IPJ-VALUE e IPJ-DIV com 1 ano de pontos, projeções IBOV.
  - **Caches de IA pré-calculados** (relatório mensal por ativo, análise técnica do dia, projeções do
    radar de dividendos, projeções IBOV). Sem eles, abrir `/acao/*` logado como premium, `/radar`,
    `/dashboard` ou `/radar-dividendos` faz o app chamar o **Gemini** automaticamente.
- Os números são **fictícios porém plausíveis** (séries de preço são passeios aleatórios determinísticos
  calibrados para terminar no preço definido no script).

**Rode o seed novamente a cada dia de uso**: a análise técnica usada pelo Radar é recalculada (com IA) quando
não é do dia; o seed grava `scripts/local/.last-seed.json` e o script de screenshots se recusa a rodar com seed
de outro dia (a não ser com `--allow-stale-seed`).

## 4. Dev server na porta 3100 apontando para o banco local

```bash
DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB BACKGROUND_PROCESS_POSTGRES=$LOCAL_DB \
NEXTAUTH_URL=http://localhost:3100 \
npx next dev --turbopack -p 3100
```

Observações:
- As demais variáveis vêm do `.env` (inclusive `GEMINI_API_KEY`, `BRAPI_TOKEN`, Stripe). Para garantir que nada
  chame o Gemini, você pode acrescentar `GEMINI_API_KEY=` (vazio) ao comando acima — vários serviços caem para
  regras locais quando a chave não existe.
- Mesmo local, o app consulta o Yahoo Finance/BRAPI (APIs públicas) ao abrir páginas: a cotação "de hoje" e
  dividendos reais podem ser gravados no banco local por cima dos dados do seed. Rodar o seed de novo restaura.
- Sem `REDIS_URL` o app usa cache em memória: depois de re-seedar, reinicie o dev server se quiser descartar
  respostas cacheadas (até 4 h em algumas rotas).

## 5. Screenshots

```bash
npx tsx scripts/local/screenshots.ts \
  --base http://localhost:3100 \
  --out ./shots/baseline \
  --auth both            # anon | premium | free | both (anon+premium) | all
  # --routes /,/planos,/acao/petr4     (padrão: lista cobrindo todos os tipos de página)
  # --viewports small,mobile,desktop   (small = 360x740 DPR 2 toque/Android, mobile = 390x844 isMobile/touch,
  #                                     desktop = 1440x900 DPR 1; padrão: mobile,desktop)
  # --theme light|dark|both            (padrão light; dark força o tema escuro: localStorage 'theme' + colorScheme)
  # --concurrency 2  --timeout 90000  --popup-wait 7500
  # --anon-ip per-route|shared         (per-route: cada visita anônima usa um IP fictício novo, evitando
  #                                     o limite de 2 visualizações completas por IP; shared: simula o
  #                                     mesmo visitante e mostra o paywall a partir da 3ª página de ativo)
  # --no-exit-intent                   (não simula o exit-intent em /planos no desktop)
```

Saída:

```
<out>/<modo>/<viewport>/<slug>.png            full-page após fechar modais que bloqueiam a tela
<out>/<modo>/<viewport>-dark/<slug>.png       idem no tema escuro (--theme dark|both)
<out>/<modo>/<viewport>/<slug>__modal-N.png   viewport com o modal aberto (quando apareceu algum)
<out>/report.json                             por rota: status HTTP, redirects, erros de console e de página,
                                              requisições com falha, requisições bloqueadas, POSTs feitos pela
                                              página, modais/banners detectados, overflow horizontal, altura
```

O que o script faz em cada rota: abre um contexto novo (localStorage limpo, então popups "de primeira visita"
aparecem), espera `networkidle` (com fallback), rola a página inteira para disparar lazy-load, aguarda popups
temporizados (a captura de e-mail abre após 6 s), registra e fecha modais bloqueantes (Esc → botão fechar →
clique fora) e tira o screenshot.

Proteções embutidas (defesa em profundidade):
- Bloqueia no navegador endpoints de IA (`/api/ai-reports/*/generate`, `/api/ben/chat`, `/api/screening-ai`, ...),
  pagamento (`/api/checkout`, `/api/payment`, `/checkout`, Stripe/Mercado Pago/Cakto/Kiwify), e-mail
  (`/api/auth/register|forgot-password|resend-verification`, escrita em `/api/asset-subscriptions`...), cron e admin.
- Bloqueia analytics de terceiros (Clarity, GA/GTM, Meta, Hotjar) para não poluir as métricas de produção.
- Recusa `--base` que não seja localhost/127.0.0.1.
- Chamadas feitas **pelo servidor** (ex.: geração de relatório/projeções) não passam pelo navegador — por isso
  o seed pré-popula os caches de IA.

Robustez: se o dev server cair/reiniciar no meio (ex.: watchdog de memória — o Turbopack passa de 3 GB depois de
compilar ~20 rotas), o script espera ele voltar e recaptura a rota (`retriedAfterServerRestart: true` no relatório).
Uma rodada completa (40 rotas × 2 viewports × 2 modos) leva ~35–40 min no dev server; use `--routes` para iterar.

Login: feito pela tela real `/login` (campos `#email`/`#password`); se falhar, cai para o fluxo de credenciais do
next-auth via HTTP (`/api/auth/csrf` + `/api/auth/callback/credentials`). A sessão é reaproveitada via storageState.

Para inspecionar o relatório rapidamente:

```bash
node -e 'const r=require("./shots/baseline/report.json");console.log(r.summary)'
```

## 6. Guarda-corpo de UI e testes

```bash
bash scripts/check-ui.sh                  # arquivos alterados/novos em src/ (git): falha em gradiente, blur, emoji...
bash scripts/check-ui.sh src/components/header.tsx   # arquivos específicos
bash scripts/check-ui.sh --all            # contagem por regra em todo o src/ (medição, não falha)
npx tsx --test "src/**/__tests__/**/*.test.ts"       # testes unitários (node:test), também via `yarn test`
```

Exceções por arquivo ficam em `scripts/check-ui.allowlist` (com motivo). O tema escuro é aplicado pelo
`next-themes` (classe `.dark` no `<html>`); o seletor só aparece quando `THEME_TOGGLE_ENABLED` (em
`src/lib/theme.ts`) for `true`, então use `--theme dark` para revisar o dark mode antes disso.

Rotas-base (40) para comparação com `shots/baseline`: a lista `DEFAULT_ROUTES` de `screenshots.ts` (usada quando
`--routes` não é informado).
