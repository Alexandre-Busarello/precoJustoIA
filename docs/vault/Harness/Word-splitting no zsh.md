---
tags: [harness, armadilha, shell]
updated: 2026-10-09
---
# Word-splitting no zsh

> O shell da máquina é **zsh**. Por padrão, ele **não** divide `$VAR` em palavras (o bash divide) e tem expansões próprias.

- `for f in $FILES` com uma lista separada por espaço vira **um** item no zsh. Use arrays (`files=(a b)`, `"${files[@]}"`) ou `xargs`.
- `echo =====` falha com "not found": `=palavra` expande para o caminho de um comando. Use aspas (`echo '-----'`).
- `grep --include=*.ts` sem aspas dá "no matches found": o glob é expandido antes. Use `--include='*.ts'`.
- Caminhos com espaço (`00 - Início.md`) sempre entre aspas.
- Scripts do harness rodam com `bash` explícito (`#!/usr/bin/env bash`).

Ver também: [[Harness]]
