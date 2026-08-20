#!/usr/bin/env bash
# Attendance Pro - launcher (macOS / Linux)
cd "$(dirname "$0")"
echo "Starting Attendance Pro..."
if [ ! -d node_modules ]; then
  echo "[X] Dependencies not found. Run install.sh first."
  exit 1
fi
if [ ! -f .env ]; then
  echo "[X] Missing .env. Run install.sh first."
  exit 1
fi
# Start the server in the background, then open the app in the browser.
nohup node server.js > server.log 2>&1 &
sleep 4
URL="http://localhost:3000/login"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1
else
  echo "Open your browser at: $URL"
fi