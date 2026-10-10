---
tags: [arquitetura, crons]
updated: 2026-10-09
fontes: [vercel.json, src/app/api/cron/, src/middleware.ts]
---
# Crons
> Os jobs ficam em `src/app/api/cron/*/route.ts` e exigem `Authorization: Bearer <CRON_SECRET>`. Só 4 rotas (ETFs) estão no `vercel.json`; o resto depende de um agendador externo.

## Como funciona
**No `vercel.json` (`crons`):**
| Rota | Agenda |
|---|---|
| `/api/cron/fetch-etf?phase=1` | `0 6 * * *` |
| `/api/cron/fetch-etf?phase=2` | `0 7 * * 0` |
| `/api/cron/update-etf-historical` | `30 8 * * *` |
| `/api/cron/refresh-etf-technical` | `0 10 1 * *` (mensal) |

**Fora do `vercel.json`** (algumas têm `maxDuration: 300` lá em `functions`, mas não agenda):
- Dados: `fetch-ward`, `fetch-fii`, `update-indices` (mark-to-market dos índices), `update-portfolio-assets`, `dividend-radar-projections`.
- Monitoramento/alertas: `monitor-assets`, `monitor-custom-triggers`, `monitor-price-variations`, `queue-flag-reevaluations`, `process-flag-reevaluations`.
- IA/conteúdo: `generate-ai-reports` (fila com checkpoint), `youtube-analysis`.
- E-mail e cobrança: `send-emails`, `process-payments` (concilia webhooks PENDING/FAILED), `expire-premium-subscriptions`.
- **Novos nas ondas, a agendar no agendador externo** (RESUME, fechamento):
  - `/api/cron/aporte-mensal` — e-mail mensal "Seu aporte do mês" para Premium com `reportPreferences.APORTE_MENSAL = true`; parâmetros `limit`, `cursor`, `dryRun=1`, `email=` (`src/app/api/cron/aporte-mensal/route.ts`). Ver [[Onde aportar]].
  - `/api/cron/macro-indicators` — Selic/CDI/IPCA do BCB, diário (ver [[Fontes de dados]]).
  - `/api/cron/calculate-ibov-projections` — opcional, 1×/dia após 18h30 BRT; só aquece o cache, grava `IbovProjection` e gera o comentário de IA (`?commentary=0` pula a IA). As faixas são calculadas sob demanda em `/api/ibov-projections` mesmo sem o cron. Ver [[IBOV faixas estatísticas]].
- `auto-renewal/` e `cleanup-expired-premium/` são pastas vazias (sem `route.ts`).

## Regras / limites
- Chamadas com `Bearer <CRON_SECRET>` ficam fora do rate limit global (`isApiRateLimitExempt` em `src/middleware.ts`).
- Não editar os crons do `vercel.json` sem o dono (regra dos lotes da onda 2).

## Histórico nas ondas
- [[Onda 1]]: `macro-indicators` criado junto com `src/lib/finance/macro-sync.ts`.
- [[Onda 3]]: `aporte-mensal` (`407e805`) e o novo `calculate-ibov-projections` estatístico (`61481fa`).
- [[Onda 2]]: `dividend-radar-projections` deixou de usar LLM (projeção sazonal determinística, `f77fd79`).

## Pendências
- Dono: agendar `aporte-mensal`, `macro-indicators` e (opcional) `calculate-ibov-projections`.
- Não verifiquei onde estão agendados hoje os crons que não estão no `vercel.json` (fora do repo).

## Relacionadas
[[Fontes de dados]] · [[Caches]] · [[Middleware e rate limit]] · [[Alertas]] · [[Pendências]]
