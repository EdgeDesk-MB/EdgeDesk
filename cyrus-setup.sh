#!/usr/bin/env bash
# Prepares a fresh Cyrus worktree: dev env file and edgeways dependencies.
# Prints status only, never file contents or env values. Skipped steps exit 0.
set -euo pipefail

cd "$(dirname "$0")"

app_dir="edgeways"
env_target="$app_dir/.env.local"

if [ -z "${CYRUS_DEV_ENV_FILE:-}" ]; then
  echo "dev env: skipped (CYRUS_DEV_ENV_FILE not set)"
elif [ ! -f "$CYRUS_DEV_ENV_FILE" ] || [ ! -r "$CYRUS_DEV_ENV_FILE" ]; then
  echo "dev env: skipped (CYRUS_DEV_ENV_FILE not a readable file)"
else
  (umask 077 && cp "$CYRUS_DEV_ENV_FILE" "$env_target")
  chmod 600 "$env_target"
  echo "dev env: copied to $env_target (mode 600)"
fi

if [ -d "$app_dir/node_modules" ]; then
  echo "deps: skipped ($app_dir/node_modules present)"
else
  echo "deps: running npm ci in $app_dir"
  (cd "$app_dir" && npm ci --no-audit --no-fund --loglevel=error >/dev/null)
  echo "deps: installed"
fi
