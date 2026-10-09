#!/usr/bin/env bash
# Ceifador de testes travados (genérico).
#
# Mata execuções de "tsx --test" do repo com mais de MAX_SECS segundos. Testes que importam Prisma/DB/rede
# deixam handles abertos e nunca saem; como rodam dentro de "flock heavy.lock", seguram o lock e travam
# todos os outros agentes. Este vigia libera o lock.
#
# Uso (em background):
#   REPO_MATCH=analisador-acoes bash docs/harness/scripts/test-reaper.sh
#
# Variáveis:
#   REPO_MATCH  trecho do caminho do repo usado no padrão do pgrep (padrão: nome da pasta do repo)
#   PATTERN     padrão completo do pgrep (padrão "$REPO_MATCH/node_modules/.bin/tsx --test")
#   MAX_SECS    idade máxima em segundos (padrão 300, o mesmo do "timeout 300" das regras)
#   INTERVAL    intervalo da varredura em segundos (padrão 30)
#   LOG         log das mortes (padrão test-reaper.log ao lado deste script; prefira o scratch)
#
# O padrão do pgrep não casa com este próprio script porque a linha de comando dele não contém
# "node_modules/.bin/tsx --test". Se trocar PATTERN, confira isso (ver a armadilha do pgrep no README).

REPO_MATCH=${REPO_MATCH:-"$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"}
PATTERN=${PATTERN:-"$REPO_MATCH/node_modules/.bin/tsx --test"}
MAX_SECS=${MAX_SECS:-300}
INTERVAL=${INTERVAL:-30}
LOG=${LOG:-"$(dirname "$0")/test-reaper.log"}

while true; do
  for pid in $(pgrep -f "$PATTERN"); do
    et=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
    if [ -n "$et" ] && [ "$et" -gt "$MAX_SECS" ]; then
      echo "$(date +%T) killed $pid after ${et}s: $(ps -o args= -p "$pid" | cut -c1-160)" >> "$LOG"
      pkill -P "$pid"; kill "$pid"
    fi
  done
  sleep "$INTERVAL"
done
