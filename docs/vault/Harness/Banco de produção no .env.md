---
tags: [harness, seguranca, banco]
updated: 2026-10-09
---
# Banco de produção no .env

> O `.env` do repositório aponta `DATABASE_URL`/`DIRECT_URL` para o **Postgres de produção (Neon)**.

- Tudo o que é local usa o container `pja-local-db`: `postgres:17`, porta **55432**, URL `postgresql://postgres:local@localhost:55432/pja`.
- Sobrescreva a URL **no mesmo comando**. Variável do processo vence o `.env` no Next e no Prisma.
  ```bash
  DATABASE_URL=$LOCAL_DB DIRECT_URL=$LOCAL_DB npx tsx scripts/local/seed-local.ts
  ```
- Proibido contra o `.env`:
  - `prisma db push/migrate/reset`;
  - `psql`;
  - scripts de `scripts/` (só `scripts/local/*` e `scripts/check-*.sh` são liberados);
  - `yarn build`. Ver [[Build proibido]].
- No máximo leitura contra produção (ex.: `pg_dump` para semear o local), e só com o dono ciente.
- Nenhuma onda mudou o schema.

Ver também: [[Ambiente local e CI]] · [[Harness]]
