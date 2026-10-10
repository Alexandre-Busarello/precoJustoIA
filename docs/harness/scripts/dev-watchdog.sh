#!/usr/bin/env bash
# Vigia de memória do dev server (genérico).
#
# Sobe o dev server e o reinicia só quando a máquina está ficando sem memória
# (MemAvailable < MIN_AVAIL_MB) ou o grupo de processos do servidor passa de HARD_MB,
# no máximo uma vez a cada COOLDOWN segundos. Também religa o servidor se ele morrer.
#
# Uso (rode em background, por exemplo pela ferramenta Bash com run_in_background):
#   SCRATCH=/caminho/scratch REPO=/caminho/repo LOCAL_DB=postgresql://postgres:local@localhost:55432/pja \
#     bash docs/harness/scripts/dev-watchdog.sh
#
# Variáveis (todas opcionais, exceto SCRATCH):
#   SCRATCH        pasta da sessão (obrigatória; o log vai para $SCRATCH/dev.log)
#   REPO           raiz do repo (padrão: três níveis acima deste arquivo, ou seja, a raiz quando ele está em docs/harness/scripts)
#   PORT           porta do dev server (padrão 3100)
#   DEV_CMD        comando do servidor (padrão "npx next dev --turbopack -p $PORT")
#   LOCAL_DB       URL do banco LOCAL; exportada como DATABASE_URL/DIRECT_URL para nunca cair no .env
#                  (padrão postgresql://postgres:local@localhost:55432/pja)
#   NODE_HEAP_MB   --max-old-space-size do Node (padrão 2048)
#   MIN_AVAIL_MB   reinicia se a memória disponível da máquina cair abaixo disto (padrão 1800)
#   HARD_MB        reinicia se o RSS somado do servidor passar disto (padrão 5000)
#   COOLDOWN       segundos mínimos entre reinícios (padrão 300; ignorado se a memória disponível < 900 MB)
#   LOG            arquivo de log (padrão $SCRATCH/dev.log)
#
# Para parar: kill <pid do watchdog> (o trap derruba o grupo do servidor junto).

REPO=${REPO:-"$(cd "$(dirname "$0")/../../.." && pwd)"}
cd "$REPO" || exit 1
PORT=${PORT:-3100}
DEV_CMD=${DEV_CMD:-"npx next dev --turbopack -p $PORT"}
MIN_AVAIL_MB=${MIN_AVAIL_MB:-1800}
HARD_MB=${HARD_MB:-5000}
COOLDOWN=${COOLDOWN:-300}
LOG=${LOG:-${SCRATCH:?defina SCRATCH}/dev.log}
LOCAL_DB=${LOCAL_DB:-postgresql://postgres:local@localhost:55432/pja}

# Variáveis do processo vencem o .env (Next e Prisma não sobrescrevem env já definida).
export DATABASE_URL="$LOCAL_DB"
export DIRECT_URL="$LOCAL_DB" BACKGROUND_PROCESS_POSTGRES="$LOCAL_DB"
export NEXTAUTH_URL="http://localhost:$PORT"
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB:-2048}"
export NEXT_TELEMETRY_DISABLED=1

start() {
  # setsid: o servidor ganha um grupo próprio, para matar a árvore inteira (npx -> node -> workers).
  # shellcheck disable=SC2086
  setsid $DEV_CMD >> "$LOG" 2>&1 &
  DEV_PGID=$!; LAST_START=$SECONDS
  echo "[watchdog] $(date +%T) started dev server pgid=$DEV_PGID" >> "$LOG"
}
stop() { kill -TERM -- -"$DEV_PGID" 2>/dev/null; sleep 3; kill -KILL -- -"$DEV_PGID" 2>/dev/null; }
trap 'stop; exit 0' INT TERM

start
while true; do
  sleep 15
  rss=$(ps -o rss= -g "$DEV_PGID" 2>/dev/null | awk '{s+=$1} END {print int(s/1024)}')
  avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if [ -z "$rss" ] || [ "$rss" -eq 0 ]; then
    echo "[watchdog] $(date +%T) dev server gone, restarting" >> "$LOG"; start; continue
  fi
  if [ $((SECONDS - LAST_START)) -lt "$COOLDOWN" ] && [ "$avail" -gt 900 ]; then continue; fi
  if [ "$avail" -lt "$MIN_AVAIL_MB" ] || [ "$rss" -gt "$HARD_MB" ]; then
    echo "[watchdog] $(date +%T) avail=${avail}MB rss=${rss}MB, restarting" >> "$LOG"
    stop; start
  fi
done
