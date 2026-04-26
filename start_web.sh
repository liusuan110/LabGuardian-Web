#!/usr/bin/env bash
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$WEB_DIR"
if [[ ! -d node_modules ]]; then
  echo "node_modules not found. Run: npm install"
  exit 1
fi

echo "Starting LabGuardian demo frontend at http://127.0.0.1:5173"
echo "Backend should be running at ${VITE_API_BASE_URL:-http://127.0.0.1:8000}"
exec npm run dev -- --host 0.0.0.0
