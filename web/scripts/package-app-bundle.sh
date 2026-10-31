#!/usr/bin/env bash
# Builds the app web bundle and writes app-web.zip + app-web.json (live-update manifest) into OUT_DIR.
# Usage: package-app-bundle.sh OUT_DIR RELEASE_TAG   (RELEASE_TAG = the GitHub release the files are attached to)
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$(mkdir -p "$1" && cd "$1" && pwd)"
TAG="$2"
REPO="${GITHUB_REPOSITORY:-jniebuhr/gaggimate}"

cd "$WEB_DIR"
export BUNDLE_VERSION="${BUNDLE_VERSION:-$(git describe --tags --dirty --match "v*")}"
npm run build:app

rm -f "$OUT_DIR/app-web.zip"
(cd dist-app && zip -qr -X "$OUT_DIR/app-web.zip" .)

node -e '
const [out, version, url, minAppVersion] = process.argv.slice(1);
const fs = require("fs");
const checksum = require("crypto").createHash("sha256").update(fs.readFileSync(`${out}/app-web.zip`)).digest("hex");
fs.writeFileSync(`${out}/app-web.json`, JSON.stringify({ version, url, checksum, minAppVersion }, null, 2) + "\n");
' "$OUT_DIR" "$BUNDLE_VERSION" "https://github.com/$REPO/releases/download/$TAG/app-web.zip" \
  "$(node -p "require('./package.json').appMinNativeVersion")"
echo "App bundle $BUNDLE_VERSION -> $OUT_DIR/app-web.zip"
