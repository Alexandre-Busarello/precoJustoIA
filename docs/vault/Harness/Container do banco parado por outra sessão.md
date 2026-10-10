---
tags: [harness, armadilha, banco]
updated: 2026-10-09
---
# Container do banco parado por outra sessão

> Outra sessão do Claude Code ou do Docker parou o `pja-local-db` no meio de uma onda. As rotas passaram a falhar e o QA reprovou o lote por um problema de ambiente.

- Antes de culpar o lote, confira `docker ps --filter name=pja-local-db`.
- Para religar: `docker start pja-local-db`. Para esperar: `until docker exec pja-local-db pg_isready -q; do sleep 10; done`.
- Avise outras sessões na mesma máquina de que o container está em uso.
- O script de screenshots acusa seed velho no dia seguinte. Nesse caso, semeie de novo uma vez, com a URL local.

Ver também: [[Banco de produção no .env]] · [[Harness]]
