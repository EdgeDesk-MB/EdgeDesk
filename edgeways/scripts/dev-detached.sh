#!/usr/bin/env bash
# Start Edgeways' supervised dev server outside the current shell session
# so Cursor agent terminal cleanup cannot take it down.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${EDGEWAYS_DEV_LOG:-$ROOT/data/dev-keep.log}"
PID_FILE="$ROOT/data/dev-keep.pid"
PORT="${PORT:-3000}"

mkdir -p "$ROOT/data"

if [[ -f "$PID_FILE" ]]; then
  KEEP_PID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('keepPid') or '')" "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${KEEP_PID}" ]] && kill -0 "$KEEP_PID" 2>/dev/null; then
    echo "Edgeways dev-keep already running (pid $KEEP_PID). Log: $LOG"
    echo "Open http://localhost:${PORT}"
    exit 0
  fi
fi

# Free the port only when nothing supervised owns it.
if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. If that is Edgeways, open http://localhost:${PORT}"
  echo "Otherwise stop the listener, then re-run: npm run dev:detached"
  exit 1
fi

cd "$ROOT"
nohup npm run dev >>"$LOG" 2>&1 &
disown || true
sleep 1
echo "Edgeways supervised dev started. Log: $LOG"
echo "Open http://localhost:${PORT}"
echo "Stop later with: kill \$(python3 -c \"import json; print(json.load(open('$PID_FILE'))['keepPid'])\")"
