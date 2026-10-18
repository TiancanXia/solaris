#!/usr/bin/env bash
# SOLARIS — launch the local observatory (macOS / Linux)
set -e
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  exec node server.mjs --open
elif command -v python3 >/dev/null 2>&1; then
  (sleep 1; (open http://localhost:8080/ 2>/dev/null || xdg-open http://localhost:8080/ 2>/dev/null || true)) &
  exec python3 -m http.server 8080
else
  echo "SOLARIS needs Node.js or Python 3 to serve its files over HTTP."
  exit 1
fi
