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
| 2 | `w2-valuation-core`, `w2-rankings-new-models`, `w2-score-compliance-fii`, `w2-returns`, `w2-dividends-agenda`, `w2-alerts`, `w2-platform-seo-pwa`, `w2-ui-market-tools`, `w2-ui-institutional-auth` | Pendente |
| 3 | `w3-onde-aportar` (premissa central: onde aportar, incl. modo premium "Todo o mercado") + `w3-screening-filters` (em paralelo, arquivos disjuntos) | Pendente |
| 4 | `w3-cleanup-deps-ci` + `w3-dark-mode-final-qa` (libera o toggle de tema) | Pendente |

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

## Pendências conhecidas ao fim da onda 1 (levar para as ondas 2–4)

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

Peça algo como: *"retome as melhorias de docs/melhorias-2026-09 a partir da onda 1"*. O fluxo por onda é o workflow [`workflows/implement-wave.js`](workflows/implement-wave.js), chamado com:

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

Estimativa observada: ~2–2,5 h por lote (dev + teste + 1 correção). Ondas 1–4 ≈ 23–30 h de relógio com 3 lotes em paralelo.
