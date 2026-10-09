---
tags: [harness, armadilha, shell]
updated: 2026-10-09
---
# Espera com pgrep

> `until ! pgrep -f "screenshots.ts"; do sleep 5; done` **nunca termina**: o `pgrep -f` casa com a linha de comando do próprio shell que roda o laço, porque ela contém o padrão.

- Espere no PID: `while kill -0 $PID 2>/dev/null; do sleep 5; done`.
- Ou use o truque do colchete: `pgrep -f "[s]creenshots.ts"`. A regex não casa com o próprio texto literal.
- Sempre com um limite de tempo. No Claude Code, prefira a ferramenta Monitor.
- Se um agente travar assim, mate só o laço de espera quando o processo real já tiver terminado. Ver [[Matar processos de outros agentes]].

Ver também: [[Harness]]
