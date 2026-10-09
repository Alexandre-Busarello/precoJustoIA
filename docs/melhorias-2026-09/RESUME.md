# Melhorias 2026-09 — como retomar

Plano de melhoria de UX/UI, mobile, correções financeiras e novas features do Preço Justo AI, executado por um time de agentes (programador → testador independente → correções até 3 ciclos → commit local → teste de integração por onda).

- Branch: `melhorias/ux-ui-mobile` (commits locais, sem push).
- Estratégia para o dono: [`strategy.md`](strategy.md)
- Backlog: [`backlog.json`](backlog.json) + uma spec por lote em [`batches/`](batches/)
- Regras globais que todo lote segue: [`backlog-rules.md`](backlog-rules.md)
- Relatórios dos especialistas: [`reports/`](reports/) (UX/UI, mobile, mercado financeiro, simplificação)

## Status

| Onda | Lotes | Status |
|---|---|---|
| 0 | `w0-foundation` (design tokens, dark mode plumbing, primitivos, formatação pt-BR, header/footer/nav mobile, política de interrupções) | **Concluída** — `6ad9d41` (fundação, aprovada pelo testador no 3º ciclo) + `b5aca7c` (integração) |
| 1 | `w1-asset-stock`, `w1-asset-indicators-ai`, `w1-asset-fii-etf-bdr`, `w1-technical-radars`, `w1-home-pricing-checkout`, `w1-dashboard-alerts`, `w1-account-ben-onboarding`, `w1-portfolio`, `w1-ranking`, `w1-backtest`, `w1-screening`, `w1-comparador`, `w1-finance-foundation` | **Concluída** (30/09) — 13 lotes aprovados pelo testador (`395302f`…`7ff4c71`) + integração `7134d14` |
| 2 | `w2-valuation-core`, `w2-rankings-new-models`, `w2-score-compliance-fii`, `w2-returns`, `w2-dividends-agenda`, `w2-alerts`, `w2-platform-seo-pwa`, `w2-ui-market-tools`, `w2-ui-institutional-auth` | **Concluída** (05/10) — 8 lotes aprovados + `w2-rankings-new-models` como `wip` (`986090d`, bloqueante resolvido em `1e188da`); correções do coordenador `3743315`, `9680fb4`; integração `74f4774` (tsc e eslint limpos) |
| 3 | `w3-onde-aportar`, `w3-screening-filters`, `w3-ibov-projections` | **Concluída** (08/10) — `407e805` (Onde aportar, 2 ciclos), `1c9af1d` (screening, 1 ciclo), `61481fa` (IBOV estatístico, 1 ciclo) + integração `8a8f442` (tsc/eslint limpos, 326 testes). Tokens dos agentes: 878k + 496k + 412k + integração |
| 4 | `w3-cleanup-deps-ci` + `w3-dark-mode-final-qa` (libera o toggle de tema) | Pendente |
| 5 | `w5-data-consistency`, `w5-platform-fixes`, `w5-dividends-bdr-data`, `w5-mobile-ben-a11y` (pendências acumuladas das ondas 0–3; um lote por vez) | Pendente |
| 6 | `w6-ben-context` → `w6-ben-ui` (Ben mais fácil e contextualizado com a tela; em sequência) | Pendente |

Lotes da mesma onda não compartilham arquivos (verificado), então rodam em paralelo na mesma working tree.

## Decisões do dono (valem sobre qualquer recomendação dos relatórios)

1. **Trial continua de 1 dia** (trials longos geraram múltiplas contas sem conversão).
2. **Dark mode completo é requisito**; o toggle só é exposto quando todas as rotas passarem no QA dark (onda 4).
3. **Não alterar preços dos planos** — a proposta de preços fica só na estratégia.
4. **"Onde aportar" é a premissa central** (onda 3), números determinísticos, enquadramento CVM de "calculadora com os critérios do usuário". Validar o modo "Todo o mercado" com advogado/CNPI antes de marketing pesado.
5. **Filtros novos no screening** (liquidez visível, Bazin, PEG, DY 12m real, "queda com fundamentos intactos") na onda 3, usando `src/lib/finance/signals.ts` (criado na onda 1).
6. Análise técnica: mantida; `useTechnicalAnalysis` passa a `false` por padrão nos rankings (onda 2).

## Pendências para o dono confirmar

- Número real de empresas cobertas (o código usa o conservador "mais de 350 empresas" em `src/lib/site-constants.ts`), frequência de atualização e fontes de dados exibidas.
- `src/middleware.ts` não roda porque o `middleware.ts` da raiz tem precedência (o 410 de `/fundador` do commit `5777118` não está valendo) — corrigido no lote `w2-platform-seo-pwa`; confirmar em produção com `curl -I https://precojusto.ai/upgrade`.
- `POST /api/generate-analysis` e `/api/review-analysis` chamam o Gemini sem autenticação (lote `w2-platform-seo-pwa`).
- Ativar o cron do e-mail "Seu aporte do mês" no `vercel.json` depois da onda 3.

## Pendências conhecidas ao fim da onda 2 (levar para as ondas 3–4)

Depois da onda 2: logo em SVG (`127bb16`, fonte Ubuntu do logo original, ícones e og-default regenerados) e `next build` de produção validado contra o banco local (`b10e34d` removeu `/comparador-etfs`, que quebrava o prerender e já redirecionava).

**Decisões do dono:**
- ~~Bazin com extraordinários, Barsi × Bazin e Lynch~~ — **resolvido em `7d2503a`** (decisão delegada pelo dono): Bazin exclui extraordinários por padrão e mostra o valor retirado; a página do ativo tem uma só linha "Preço-teto (Bazin)" e o Barsi fica no ranking como filtro de setores perenes com a mesma base; Lynch vira indicador relativo (PEG e faixas, sem preço-alvo) e não se aplica a bancos e seguradoras.
- **DY-alvo dos FIIs de tijolo:** NTN-B real + IPCA + spread dá ~14,2% e deixa HGLG11 a −68% do teto com score 93. Aluguel de tijolo é indexado à inflação; decidir a fórmula em `fii-listing-valuation.ts`.
- **Contagem de modelos** ("8 modelos"/"outros 7 modelos" na home, planos, Stripe, onboarding, e-mails, Ben e SEO) — a página de ação já mostra 10–11.
- **Critérios por perfil do anti-armadilha** ainda toleram 2 falhas (banco pode falhar ROE e payout; TAEE11 passa com Dív. líq./EBITDA 3,6). Tornar obrigatórios? B3SA3 cai no perfil "bancos e seguradoras".
- **Rótulo "Data ex"** na agenda (é a data ex de fato; InfoHint explica data-com) — confirmar.
- **Limite de alertas grátis** subiu de 1 para 3 (só bloqueia criação; ninguém perde alertas).

**Após o deploy (o middleware mudou):** o `middleware.ts` da raiz foi apagado e o `src/middleware.ts` passou a valer (`9e33c57`). Testar login, rotas protegidas e `curl -I https://precojusto.ai/upgrade` (301 → /checkout) e `/fundador` (410). As rotas públicas do Gemini (`/api/generate-analysis`, `/api/review-analysis`) e `/api/debug/user-status` foram removidas.

**Técnicas (para as ondas 3–4):**
- Página do ativo e ranking usam loaders/parâmetros diferentes (Gordon VALE3: R$ 86,80 na página × R$ 80,08 no ranking; g = 0% na página para PETR4/TAEE11).
- `ranking-models.ts`: sliders de Graham/FCD dizem "Upside mínimo 20%" mas filtram margem de segurança; Graham mistura as duas leituras (`graham-strategy.ts:108` × `:183`); Graham mostra "Score do modelo 100" e "Score de qualidade 41,6" juntos.
- BDR: todos os modelos ficam "não aplicável" até `bdr-data-service` gravar `financialCurrency`, `bdrRatio` e `usdBrl`; a UI do ranking BDR não avisa.
- Backtest: a UI ainda posta em `/api/backtest/config` (singular), que cria uma "Carteira de exemplo" nova a cada execução — trocar por upsert (`upsertBacktestConfig` já existe). `averageDividendYield` legado ainda lido/escrito em `api/backtest/run` e no formulário.
- `/api/benchmarks` (legado) ainda usa BRAPI mensal; `/api/sector-analysis` devolve a 1ª empresa do setor sem checar plano.
- Rate limit de `/api/*` nunca rodou em produção (o middleware da raiz sombreava); reativar exige guardar `process.on` em `rate-limit-cache-service.ts` (hoje loga "process.on is not a function").
- `formatDate` (fuso America/Sao_Paulo) mostra datas gravadas como meia-noite UTC um dia antes (afeta o app todo).
- Proventos de FII duplicados entre fontes (yahoo × seed) inflam yield on cost — dedupe na camada de dados.
- Usuário logado que abre `/login` não é redirecionado; `/oferta` fica clara com tema escuro forçado; prints de `/como-funciona` são claros.
- `/acao/[ticker]/not-found` com robots duplicado; página de ação gera projeções antes do `notFound()`; `/como-funciona`, `/sobre`, `/contato` sem canonical.
- UI de score: mostrar "Nota baseada em X de Y critérios" (`overallScore.dataCoverage`) e `qualityLabel` no CompactScore.
- Mobile: `Button size="sm"` 40 px e abas do `rentability-selector` 38 px; botão do Ben cobre a fila de abas do índice a 390 px; tabela de valuation rola 16 px a 1440 com o status "Dentro da faixa estimada".
- Seed local: `free@local.test` tem 7 dias de trial (decisão do dono é 1 dia) — ajustar o script.
- `scripts/local/screenshots.ts` ignora `--help` e grava em `<cwd>/shots` dentro do repo.

## Pendências ao fim da onda 3 (09/10)

**Decisões do dono:**
- Sugestões automáticas de compra com o caixa da carteira ficaram mais rigorosas (podem deixar caixa parado): afrouxar critérios ou aplicar o resto no ativo mais longe do peso-alvo?
- Agendar crons no agendador externo: `/api/cron/aporte-mensal` (e-mail "Seu aporte do mês"), `/api/cron/calculate-ibov-projections` (opcional; só comentário de IA e snapshot diário, 1×/dia após 18h30 BRT) e `/api/cron/macro-indicators` (Selic/CDI reais na página do IBOV).
- Validar o modo "Todo o mercado" com advogado/CNPI antes de divulgar com força.

**Técnicas:**
- Onde aportar: compras pendentes do Onde aportar não entram no cálculo das sugestões automáticas (podem estourar o peso-alvo); descartar uma compra registrada deixa o "Aporte registrado" órfão; visitantes disparam o cálculo pesado do mercado inteiro (resultado mascarado); checkboxes ETF/BDR do filtro de mercado nunca retornam resultado.
- `/api/rank-builder`: com `sortBy` (rota de preset) o usuário não Premium recebe todos os filtros — dá para contornar a restrição pela API (→ `w5-platform-fixes`).
- Dashboard: aviso do IBOV e card do Ben empilhados; no mobile empurram o bloco "Onde aportar" para baixo da dobra (→ `w6-ben-ui`).
- `src/components/oportunidades-dropdown.tsx` é código morto (→ `w3-cleanup-deps-ci`).

## Ajustes pedidos pelo dono depois da onda 2 (05/10, já no branch)

Logos das empresas nas listas (`1845214`), faixa de índices deslizando no desktop (`7a71606`), ranking abre o salvo do dia e a prévia não entra no histórico (`51806a1`), cobertura "mais de 600 ativos" (`b963121`), FAQ e contagem de modelos (11 para ações; `c3ce471`, `26c4502`), "Como funciona" por modelo no ranking e /metodologia com FIIs e ETFs (`32d0306`), Barsi sem petróleo nos setores perenes e anti-armadilha/P-L baixo exigindo Premium na API (`8783883`). `next build` de produção validado de novo.

Bugs encontrados e ainda não corrigidos:
- Estratégias de FII: fallbacks `maxPvp ?? 1.3`, `limit ?? 100` divergem do registro (1,1 / 50 / 30); `withRegistryDefaults` só cobre ações.
- Pilar "Segmento e resiliência" dos FIIs: 60 no ranking × 80 na página (falta passar `lastFetchedAt`).
- `etf-scoring` trata taxa/retorno = 0 como ausente; preset de renda fixa casa "ima" por substring.
- `magicFormula` segue gratuito com 3 resultados na API (o registro diz premium) — decidir.
- `yarn test` (glob `src/**/__tests__/**`) não roda `src/components/**/*.test.ts` — incluir no script/CI na onda 4.
- Relatório mensal de IA só é gerado quando um Premium abre a página (o FAQ diz "de cada empresa"); LP do Clube dos Dividendos tem promessas não conferidas ("NAV", "score de sustentabilidade").

## Pendências conhecidas ao fim da onda 1 (a maioria tratada na onda 2; o que sobrou está acima)

- **Funções financeiras (`src/lib/finance/*`)** — ajustar antes/durante a onda 2:
  - `annualizeFromLast12` retorna null quando dividendo e JCP têm a mesma data-com (agrupar por exDate antes de calcular intervalos) e ignora pagamentos antigos (receber `asOf` e marcar dados defasados).
  - `fullYearTotals` pode descartar um 1º ano completo em históricos curtos.
  - `magicFormulaRank` aceita ROIC negativo (excluir `roic <= 0`).
  - `signals.fundamentalsIntact` usa `ratioBasis: 'quarterly'` por padrão, mas o ROE do schema é anual/TTM — a onda 3 deve passar `ratioBasis: 'ttm'` (ou mudar o padrão); janela de 8 trimestres não verifica trimestres consecutivos; textos dos checks devem usar `@/lib/format`.
  - `macro.ts`: `ipcaExpected` é o IPCA realizado 12m (SGS 433), não expectativa — não rotular como "IPCA esperado"; `parseSgsDate` aceita datas impossíveis.
  - `sector-classification.ts`: algumas regex classificam errado ("Máquinas Agrícolas", "Artefatos de Ferro e Aço", "Tecnologia financeira") — validar com as strings de produção.
- Radar de dividendos: API `dividend-radar/grid` não envia `paymentDate`/`type` ("Não informado" na UI).
- `/acao/taee11` premium a 320 px: scroll horizontal dentro do card da IA.
- `/projecoes-ibov` (cards vermelhos antigos), blog, `/como-funciona`, `/contato`, `/sobre` e calculadoras ainda com gradientes → lote `w2-ui-market-tools` / `w2-ui-institutional-auth`.
- Breadcrumb inconsistente entre páginas; botão flutuante do Ben cobre conteúdo no mobile; alvos de toque < 44 px (InfoHint, `Button size="sm"`, chips do Ben, cabeçalhos ordenáveis do DataTable); slider do quiz sem nome acessível.
- Backend: backtest salva "Carteira de exemplo" duplicada a cada execução; `rank-builder`/`ranking-history` com decimal com ponto e textos em inglês; BDRs com preço justo sem sentido (AAPL34 Graham ≈ −1.109%) → lote `w2-valuation-core` (moeda/paridade de BDR).
- Validar manualmente a troca de aba Ações/ETFs no comparador com a página já aberta.
- Ações do dono: cron `/api/cron/macro-indicators` no `vercel.json`; fonte automática de `NTNB_REAL_LONG` (hoje usa 7,68% fixo); redirect `/comparador-etfs` → `/comparador?tipo=etfs` (onda 2).
- ESLint: seguem só os 6 erros antigos em `parceiros/clube-dos-dividendos/sections/features-portfolio.tsx:47`.

## Pendências conhecidas ao fim da onda 0 (já cobertas pelos lotes da onda 1, conferir)

- Dark: cards de pódio Ouro/Prata ilegíveis em `/compara-acoes/*` (`w1-comparador`); `bg-blue-50` em `comprehensive-financial-view.tsx:586` (`w1-asset-indicators-ai`); CTAs com gradiente em /sobre, /planos, /metodologia, /como-funciona; hero antigo de /suporte. O tema padrão segue claro e o toggle desligado, então nada disso aparece para o usuário ainda.
- Compliance: selo "4,8 · 1.250 avaliações" e "Encontre as Melhores Ações" na home, "Sinal Compra"/emoji no /dashboard, "melhores ações da B3" em /planos.
- 404 antigos: `/api/sectors` (screening) e `/api/user/me` (radar de dividendos).
- Overlay "Não sabe como configurar?" em /screening-acoes (premium) ainda abre sozinho.
- Select com ItemText em flex (`convert-backtest-modal.tsx:186`, `create-ticket-dialog.tsx:123`); triggers segmentados com 38 px no mobile; overflow de 11 px em /acao/petr4 a 320 px.
- Páginas que ainda importam o `Footer` antigo (agora vazio): home, contato, termos, lgpd, metodologia, blog, como-funciona, dashboard, planos, sobre, screening-hub-page — os donos removem o import; a onda 4 apaga o export.
- Ambiente: o disco do PC estava 99% cheio ao fim da sessão; as screenshots intermediárias foram apagadas. `.next/` (~650 MB) pode ser apagado com segurança antes de retomar.

## SEGURANÇA — banco de produção

O `.env` aponta para o banco de **produção** (Neon). Nunca rodar `yarn build`/`npm run build` (roda `prisma db push`), `prisma db push/migrate/reset`, `psql` ou scripts de `scripts/` contra o `.env`. Tudo local usa o Postgres do Docker com `DATABASE_URL`/`DIRECT_URL` sobrescritos na linha de comando.

## Ambiente local (antes de retomar)

```bash
# 1. Banco local (o container já existe; se não existir, crie)
docker start pja-local-db 2>/dev/null || \
  docker run -d --name pja-local-db -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pja -p 55432:5432 postgres:17
export LOCAL_DB=postgresql://postgres:local@localhost:55432/pja

# 2. Schema + dados de teste (SÓ com a URL local)
DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx prisma db push --skip-generate
DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx tsx scripts/local/seed-local.ts
#   usuários: premium@local.test / Local123!  ·  free@local.test / Local123!

# 3. Dev server na porta 3100 com vigia de memória (o PC tem 15 GB; o turbopack passa de 4 GB)
SCRATCH=<pasta temporária da sessão> bash docs/melhorias-2026-09/workflows/dev-watchdog.sh &

# 4. Playwright (screenshots dos testes)
npx playwright install chromium
```

Detalhes em [`scripts/local/README.md`](../../scripts/local/README.md).

## Como retomar com o Claude Code

Peça algo como: *"retome as melhorias de docs/melhorias-2026-09 a partir da onda 3"*. O fluxo por onda é o workflow [`workflows/implement-wave.js`](workflows/implement-wave.js), chamado com:

```json
{
  "repo": "<caminho do repo>",
  "scratch": "<scratchpad da nova sessão>",
  "wave": 1,
  "concurrency": 3,
  "maxCycles": 3,
  "batches": [{ "id": "w1-asset-stock", "title": "..." }, "... (todos os lotes da onda, ids de backlog.json)"]
}
```

Regras operacionais que funcionaram na onda 0:
- no máximo 3 lotes em paralelo (RAM); comandos pesados (`tsc`, `eslint`, testes, screenshots) passam pelo lock `flock <scratch>/heavy.lock`; commits pelo lock `<scratch>/git.lock`;
- uma onda por vez, revisando o resultado da integração antes de disparar a próxima;
- lotes que não passam em 3 ciclos são commitados como `wip:` e tratados numa rodada extra.
- testes unitários não podem importar Prisma/banco (travam na saída e seguram o lock); rodar sempre com `timeout 300`. Um vigia (`test-reaper.sh` no scratch) mata `tsx --test` com mais de 5 min;
- agentes às vezes esperam com `until ! pgrep -f "<padrão>"`, que casa com o próprio loop e nunca sai — matar o loop quando o processo real já terminou;
- não responder por mensagem a agentes do workflow; agir (liberar lock, religar banco) sem conversar;
- a onda 2 levou ~7,2 h de relógio (9 lotes, 50 agentes).

Estimativa observada: ~2–2,5 h por lote (dev + teste + 1 correção). Ondas 1–4 ≈ 23–30 h de relógio com 3 lotes em paralelo.
