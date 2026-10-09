---
tags: [arquitetura, ambiente]
updated: 2026-10-09
fontes: [scripts/local/README.md, scripts/local/seed-local.ts, scripts/local/screenshots.ts, scripts/build-with-migrations.js, .github/workflows/quality.yml, package.json]
---
# Ambiente local e CI
> Desenvolvimento 100% local com Postgres em Docker (`pja-local-db`, porta 55432) e seed fictício. O `.env` aponta para o banco de PRODUÇÃO: nunca rode `next build`/`yarn build`.

## Como funciona
1. **Banco:** `docker run -d --name pja-local-db -e POSTGRES_PASSWORD=local -e POSTGRES_DB=pja -p 55432:5432 postgres:17` (ou `docker start pja-local-db`). URL: `postgresql://postgres:local@localhost:55432/pja`.
2. **Schema (só local):** `DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx prisma db push --skip-generate`.
3. **Seed:** `scripts/local/seed-local.ts` aborta se a URL não for `localhost`/`127.0.0.1`; é idempotente (TRUNCATE + reinsere). Cria 25 ações, 3 BDRs, 6 FIIs, 4 ETFs, históricos, proventos, usuários `premium@local.test` e `free@local.test` (senha `Local123!`), carteira de exemplo e **caches de IA pré-calculados** (sem eles o app chama o Gemini). Rodar de novo a cada dia (`scripts/local/.last-seed.json`).
4. **Dev server:** porta 3100 com `DATABASE_URL`, `DIRECT_URL` e `BACKGROUND_PROCESS_POSTGRES` inline para o banco local; `GEMINI_API_KEY=` vazio evita IA.
5. **Screenshots:** `scripts/local/screenshots.ts` com `--theme light|dark|both`, `--viewports small,mobile,desktop` (small = 360×740), `--auth`; recusa seed de outro dia sem `--allow-stale-seed`.

**CI** — `.github/workflows/quality.yml`, em `pull_request`, Node 22:
- `yarn install --frozen-lockfile`, `npx tsc --noEmit`, `npx eslint src`, `yarn test`;
- `check-ui.sh` e `check-compliance.sh` só nos arquivos de `src/` alterados no PR;
- `check-ui.sh --all` informativo.
- Não roda build nem usa `DATABASE_URL` (`prisma generate` só lê o schema).

## Regras / limites
- `yarn build` = `scripts/build-with-migrations.js` → `npx prisma db push` contra o `.env` = **produção**. Também proibido: `prisma db push/migrate/reset`, `psql` e `scripts/*` sem sobrescrever a URL **no mesmo comando**. Ver [[Banco de produção no .env]].
- Next e Prisma não sobrescrevem variáveis já definidas, por isso a sobrescrita inline funciona.
- PC com 15 GB: um dev server só, com vigia de memória; tsc/build/playwright em série (ver [[Harness]]).

## Histórico nas ondas
- [[Onda 0]]: `5b2c491` (seed) e `screenshots.ts` com tema/viewport.
- [[Onda 4]]: `ad4cc22` criou o CI de qualidade.
- [[Onda 5]]: `yarn test` passou a incluir `src/components/**/*.test.ts`.
- Fechamento: `next build` de produção validado contra o banco local (RESUME).

## Pendências
- `scripts/local/screenshots.ts` não trata `--help` e o padrão de saída ainda é `<cwd>/shots/<data>` (pendência da onda 2).
- Seed: `free@local.test` tem um trial de 7 dias já expirado (`seed-local.ts`, ~linha 1043); a regra do produto é 1 dia ([[Decisões do dono]]). Para o QA não faz diferença.

## Relacionadas
[[Banco de produção no .env]] · [[Harness]] · [[Stack]] · [[Design system]]
