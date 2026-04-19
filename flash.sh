#!/usr/bin/env bash
# Build and flash the display firmware and SPIFFS to ESP32
#
# Usage: ./flash.sh <upload_port>
# Example: ./flash.sh COM4
#
# Note: <upload_port> is required. Find it in Device Manager (Windows)
#       or via: ls /dev/tty.* (macOS) or ls /dev/ttyUSB* (Linux)

set -e

if [ -z "$1" ]; then
  echo "Error: upload_port required"
  echo "Usage: ./flash.sh <upload_port>"
  echo "Example: ./flash.sh COM4"
  exit 1
fi

PORT=$1

echo "=== Step 1: Build web UI ==="
cd web
npm run build
cd ..

echo "=== Step 2: Sync web dist to data/w (SPIFFS source) ==="
rm -rf data/w
mkdir -p data/w
cp -R web/dist/* data/w/
gzip -f data/w/assets/*.js
gzip -f data/w/assets/*.css
gzip -f data/w/*.html

echo "=== Step 3: Build firmware ==="
pio run -e display

echo "=== Step 4: Upload firmware ==="
pio run -e display -t upload --upload-port $PORT

echo "=== Step 5: Build SPIFFS ==="
pio run -e display -t buildfs

echo "=== Step 6: Upload SPIFFS ==="
pio run -e display -t uploadfs --upload-port $PORT

echo "=== Done! ==="