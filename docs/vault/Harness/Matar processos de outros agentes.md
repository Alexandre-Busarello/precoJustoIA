---
tags: [harness, armadilha, permissoes]
updated: 2026-10-09
---
# Matar processos de outros agentes

> O classificador de segurança do Claude Code **bloqueia** que uma sessão mate processos iniciados por outros agentes, como um laço de espera travado ou um teste pendurado.

- Peça ao usuário para rodar o `kill`, com o PID e o motivo.
- Previna com o [[Testes travados com Prisma|ceifador de testes]], lançado pelo próprio coordenador e portanto com permissão, e com esperas que tenham timeout. Ver [[Espera com pgrep]].

Ver também: [[Harness]]
