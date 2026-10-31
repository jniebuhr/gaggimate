#!/usr/bin/env bash
# Builds the web UI in app mode and copies it into a native project; called from Xcode/Gradle builds.
set -euo pipefail

PLATFORM="${1:?usage: build-app-web.sh <ios|android>}"
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${CAP_SKIP_WEB_BUILD:-}" == "1" ]]; then
  echo "CAP_SKIP_WEB_BUILD=1, skipping web build"
  exit 0
fi

# IDE builds don't inherit the shell profile, so load nvm and the repo's pinned Node.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
  (cd "$WEB_DIR/.." && nvm use >/dev/null) || true
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$WEB_DIR"
[[ -d node_modules ]] || npm ci
npm run build:app
npx cap copy "$PLATFORM"
