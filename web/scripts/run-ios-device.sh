#!/usr/bin/env bash
# Builds, signs, installs and launches the iOS app on a connected iPhone via devicectl.
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DERIVED="$WEB_DIR/ios/App/build"
JSON="$(mktemp)"
trap 'rm -f "$JSON"' EXIT

# Device: first arg (name or UDID), else the first connected physical iPhone.
xcrun devicectl list devices --json-output "$JSON" >/dev/null
DEVICE="$(node -e '
const want = process.argv[2] || "";
const devs = JSON.parse(require("fs").readFileSync(process.argv[1])).result.devices;
const d = devs.find(d => want ? [d.hardwareProperties.udid, d.deviceProperties.name].includes(want)
  : d.hardwareProperties.platform === "iOS" && d.hardwareProperties.reality === "physical" && d.connectionProperties.pairingState === "paired");
process.stdout.write(d ? d.hardwareProperties.udid : "");' "$JSON" "${1:-}")"
[[ -n "$DEVICE" ]] || { echo "No connected iPhone found (is it plugged in, unlocked and paired?)" >&2; exit 1; }

xcodebuild -project "$WEB_DIR/ios/App/App.xcodeproj" -scheme App -configuration Debug \
  -destination "id=$DEVICE" -derivedDataPath "$DERIVED" -allowProvisioningUpdates -quiet build 2>&1 \
  | { grep -v 'IDERunDestination: Supported platforms' || true; }
[[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1

APP="$DERIVED/Build/Products/Debug-iphoneos/App.app"
# iOS uses its own bundle ID (eu.gaggimate.ios), so read it from the build, not capacitor.config.json.
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$APP/Info.plist")"
xcrun devicectl device install app --device "$DEVICE" "$APP" >/dev/null
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE_ID" >/dev/null
echo "Launched $BUNDLE_ID on $DEVICE"
