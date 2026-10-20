#!/usr/bin/env bash
# Builds an unsigned Release .ipa for sideloading (Sideloadly/AltStore re-sign it with the tester's Apple ID).
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DERIVED="$WEB_DIR/ios/App/build"
OUT="$DERIVED/GaggiMate.ipa"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

xcodebuild -project "$WEB_DIR/ios/App/App.xcodeproj" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath "$DERIVED" -quiet \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' build

mkdir -p "$STAGE/Payload"
cp -R "$DERIVED/Build/Products/Release-iphoneos/App.app" "$STAGE/Payload/"
rm -f "$OUT"
(cd "$STAGE" && zip -qry "$OUT" Payload)
echo "Unsigned IPA: $OUT"
