#!/usr/bin/env bash
# Runs the local Next dev server (port 3100, local DB). Restarts it only when the
# machine is actually running out of memory (MemAvailable < MIN_AVAIL_MB) or the
# server passes HARD_MB, and never more than once every COOLDOWN seconds.
cd /home/busamar/projetos/analisador-acoes/analisador-acoes || exit 1
MIN_AVAIL_MB=${MIN_AVAIL_MB:-1800}
HARD_MB=${HARD_MB:-5000}
COOLDOWN=${COOLDOWN:-300}
LOG=${LOG:-${SCRATCH:?defina SCRATCH}/dev.log}
export DATABASE_URL="postgresql://postgres:local@localhost:55432/pja"
export DIRECT_URL="$DATABASE_URL" BACKGROUND_PROCESS_POSTGRES="$DATABASE_URL"
export NEXTAUTH_URL="http://localhost:3100"
export NODE_OPTIONS="--max-old-space-size=2048"
export NEXT_TELEMETRY_DISABLED=1

start() {
  setsid npx next dev --turbopack -p 3100 >> "$LOG" 2>&1 &
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
