---
tags: [harness, seguranca, build]
updated: 2026-10-09
---
# Build proibido

> `yarn build`/`npm run build` executa `scripts/build-with-migrations.js`, que roda **`prisma db push` contra o `.env`, ou seja, contra produção**.

- Agentes nunca rodam build. A CI também não (`.github/workflows/quality.yml` roda só tsc, eslint, testes e guardas).
- O coordenador valida o build de produção antes de cada push com `npx next build` e as URLs do banco **local** inline. Exemplo de achado: `b10e34d` (prerender de `/comparador-etfs`).
- PWA offline (Serwist) foi adiado porque exige validar num build.

Ver também: [[Banco de produção no .env]] · [[Harness]]
