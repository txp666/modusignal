#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT=4173
URL="http://localhost:${PORT}"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 not found. Install Python 3 and try again."
  echo "未找到 Python 3，请先安装 Python 3。"
  exit 1
fi

open_browser() {
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  elif command -v open >/dev/null 2>&1; then
    open "$URL"
  fi
}

open_browser &
echo "modusignal -> ${URL}"
echo "按 Ctrl+C 停止服务。"
exec "$PY" -m http.server "$PORT"
