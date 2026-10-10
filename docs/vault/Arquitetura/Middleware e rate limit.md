---
tags: [arquitetura, middleware]
updated: 2026-10-09
fontes: [src/middleware.ts, src/lib/rate-limit-cache-service.ts, next.config.ts, docs/melhorias-2026-09/batches/w2-platform-seo-pwa.md, docs/melhorias-2026-09/batches/w5-platform-fixes.md]
---
# Middleware e rate limit
> `src/middleware.ts` (runtime Node.js) faz o rate limit de `/api/*`, o 410 de `/fundador`, URLs canônicas de ativos e a proteção de `/admin`. Passou a valer na onda 2, quando o `middleware.ts` da raiz (vazio, com precedência) foi apagado.

## Como funciona
- `config.runtime = 'nodejs'` (o limiter usa o cliente Redis, indisponível no Edge). Matcher: `/fundador`, `/fundador/:path*`, `/eu.png`, `/admin/:path*`, `/webhooks/stripe`, `/acao/:path*`, `/compara-acoes/:path*`, `/api/:path*`.
- **Rate limit de `/api/*`:** janela fixa de 60 s por IP, `API_RATE_LIMIT = { limit: 300, windowSeconds: 60 }`. Chave `api:<ip>:<janela>` com prefixo `api-global` no `rateLimitCache`. IP do primeiro `x-forwarded-for` (depois `x-real-ip`, `cf-connecting-ip`).
- **Modos (`API_RATE_LIMIT_MODE`):** `log` (padrão: só registra `[api-rate-limit] excedido (só log)`), `enforce` (429 com `Retry-After`, `X-RateLimit-*` e `code: 'RATE_LIMIT_EXCEEDED'`), `off`. `parseApiRateLimitMode` cai em `log` para qualquer outro valor.
- **Isentos:** `/api/auth/`, `/api/webhooks/`, `/api/health` e chamadas com `Bearer <CRON_SECRET>`. No `NODE_ENV=development`, loopback não conta.
- **Fail open:** erro no Redis só gera `console.warn`.
- **410 Gone** em `/fundador`, `/fundador/*` e `/eu.png`, com `X-Robots-Tag: noindex, noarchive, noimageindex`.
- **Crawl budget:** em `/acao/*` e `/compara-acoes/*`, ticker em maiúsculas vira minúsculas e query params sem função caem num único 301 (mantém `utm_*`, `gclid`, `fbclid`, `ref`, `source` etc.).
- **`/admin`:** sem token do NextAuth → `/login?callbackUrl=...` (a checagem de admin fica nas páginas/APIs).
- `/webhooks/stripe` → 301 `/api/webhooks/stripe`.
- **`/upgrade` → `/checkout` (301):** redirect declarativo em `next.config.ts` (`/upgrade` e `/upgrade/:path*`), não no middleware.

## Regras / limites
- Rotas sensíveis (registro, login, calculadoras) mantêm limites próprios (`src/lib/rate-limit-middleware.ts`).
- Testes: `src/lib/__tests__/platform/api-rate-limit.test.ts`.

## Histórico nas ondas
- [[Onda 2]]: `9e33c57` apagou o `middleware.ts` da raiz; `src/middleware.ts` passou a valer (410 do `/fundador`, que estava parado desde o commit `5777118`).
- [[Onda 5]]: `44aa012` ligou o rate limit em `/api/*` e guardou o `process.on`; `86ffed8` fez o modo padrão ser `log`.

## Pendências
- Produção: olhar os logs e então definir `API_RATE_LIMIT_MODE=enforce` na Vercel.
- Depois do deploy: testar login, rotas protegidas, `curl -I https://precojusto.ai/upgrade` (301) e `/fundador` (410).

## Relacionadas
[[Caches]] · [[Crons]] · [[Stack]] · [[Onda 2]] · [[Onda 5]]
