#!/usr/bin/env bash
set -euo pipefail

# Build the web UI and embed it into the display firmware (GM-106).
#
# The bundle no longer ships in the LittleFS image (/w). It is gzipped and packed
# into a single blob that scripts/embed_webui.py turns into firmware-embedded,
# memory-mapped flash. LittleFS now holds only profiles (/p) and shot history
# (/h), so OTA never touches user data. data/p (seed profiles) is still staged
# for the fresh-install filesystem image.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Seed profiles still go into the filesystem image used for fresh USB installs.
mkdir -p "$ROOT/data/p"

# Build the web application.
cd "$ROOT/web"
npm ci
npm run build

# Gzip the compressible assets in place (served with Content-Encoding: gzip).
gzip -f dist/assets/*.js
gzip -f dist/assets/*.css
gzip -f dist/*.html

# Pack the built bundle into firmware-embeddable flash artifacts.
python3 "$ROOT/scripts/embed_webui.py" --src "$ROOT/web/dist" --out "$ROOT/src/display/webassets"
