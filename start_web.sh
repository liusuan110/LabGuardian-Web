#!/usr/bin/env bash
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${LABGUARDIAN_PROJECT_ROOT:-}" ]]; then
  for candidate in \
    "$WEB_DIR/../LabGuardian-Server" \
    "$WEB_DIR/../LabGuardian-Server-main" \
    "$WEB_DIR/../LabGuardian-Server-main/LabGuardian-Server-main"; do
    if [[ -d "$candidate/app" ]]; then
      export LABGUARDIAN_PROJECT_ROOT="$candidate"
      break
    fi
  done
fi

PYTHON_CMD="${PYTHON:-python3}"
if [[ -n "${LABGUARDIAN_PROJECT_ROOT:-}" && -x "$LABGUARDIAN_PROJECT_ROOT/.venv/bin/python" ]]; then
  PYTHON_CMD="$LABGUARDIAN_PROJECT_ROOT/.venv/bin/python"
fi

echo "Opening http://127.0.0.1:${LABGUARDIAN_WEB_PORT:-8088}"
"$PYTHON_CMD" - <<'PY'
import os
import webbrowser

port = os.environ.get("LABGUARDIAN_WEB_PORT", "8088")
webbrowser.open(f"http://127.0.0.1:{port}")
PY

cd "$WEB_DIR"
exec "$PYTHON_CMD" "$WEB_DIR/server.py"
