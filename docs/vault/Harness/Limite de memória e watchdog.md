---
tags: [harness, maquina, memoria]
updated: 2026-10-09
---
# Limite de memória e watchdog

> O PC do dono tem 15 GB de RAM e 2 GB de swap. O Docker usa ~2,5 GB. Com a memória cheia, a máquina congela. O `next dev --turbopack` chegou a **6,5 GB** depois de compilar ~25 rotas.

- **Watchdog** (`docs/harness/scripts/dev-watchdog.sh`): dev server na porta 3100 com `--max-old-space-size=2048`. Ele reinicia o servidor se a memória disponível cair abaixo de 1.800 MB ou o servidor passar de 5.000 MB, com um intervalo mínimo de 300 s entre reinícios.
- **`flock -w 3600 <scratch>/heavy.lock`** em todo tsc, eslint, teste, screenshot e Playwright. Só um agente por vez.
- No máximo 3 lotes em paralelo, e 1 quando o token também aperta.
- Agentes nunca sobem outro dev server nem matam o atual. Se der "connection refused", esperem 30 s e tentem de novo.
- Disco: o scratch fica no `/`, com ~13 GB livres. Use screenshots pequenas e apague-as ao commitar.

Ver também: [[Testes travados com Prisma]] · [[Harness]]
