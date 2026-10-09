---
tags: [harness, armadilha, workflow]
updated: 2026-10-09
---
# Crases no prompt do workflow

> Os prompts de `implement-wave.js` são *template literals* JavaScript. Uma crase dentro do texto (por exemplo, `` `df -h /` `` em Markdown) fecha a string e **quebra o script inteiro** antes de qualquer agente rodar.

- Nos prompts, escreva comandos entre aspas simples: `'df -h /'`.
- Se precisar de uma crase, escape-a (`` \` ``).
- Antes de disparar, confira a sintaxe. O comando está em `docs/harness/scripts/harness.md`, ou envolva o corpo numa `AsyncFunction` com `node -e`.

Ver também: [[Harness]]
