#!/usr/bin/env bash
# OTA download test bench: unit tests against a scripted fake server plus a socket-level chaos load test.
# Usage: scripts/ota_testbench.sh [extra pio test args]   (env: OTA_CHAOS_PORT, OTA_CHAOS_SEED, OTA_LOAD_ITERATIONS)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${OTA_CHAOS_PORT:-8765}"
SEED="${OTA_CHAOS_SEED:-1}"

python3 test/ota_common/chaos_server.py --port "$PORT" --seed "$SEED" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
    if python3 -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:$PORT/control/ping', timeout=1)" 2>/dev/null; then
        break
    fi
    sleep 0.2
done

OTA_CHAOS_URL="http://127.0.0.1:$PORT" pio test -e native -f "test_ota_*" "$@"
