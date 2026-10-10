---
tags: [harness, testes, armadilha]
updated: 2026-10-09
---
# Testes travados com Prisma

> Um teste unitário que importa Prisma, o banco ou a rede deixa handles abertos: o `tsx --test` nunca sai **e segura o `heavy.lock`**, travando todos os agentes.

- Regras:
  - sempre `timeout 300`;
  - teste unitário não importa Prisma;
  - lógica testável vai para módulo puro.
- Exemplos: `3743315` (overall score detecta BDR sem `BDRDataService`) e `9680fb4` (projeções de proventos em `src/lib/dividend-projections.ts`).
- **Ceifador** (`docs/harness/scripts/test-reaper.sh`): a cada 30 s, mata `…/node_modules/.bin/tsx --test` com mais de 300 s e registra em `test-reaper.log`.
- A CI usa Node 22 porque `yarn test` passa um glob ao test runner, e o runner só expande globs a partir do Node 21.

Ver também: [[Limite de memória e watchdog]] · [[Harness]]
