#!/usr/bin/env bash
# Builds and launches the iOS app on a simulator via simctl (Xcode 27 replaced Simulator.app with DeviceHub, which breaks `cap run`).
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DERIVED="$WEB_DIR/ios/App/build"

# Device: first arg (name or UDID), else the first booted iPhone, else the newest available iPhone.
DEVICE="${1:-}"
if [[ -z "$DEVICE" ]]; then
  DEVICE="$(xcrun simctl list devices booted -j | node -e 'const d=JSON.parse(require("fs").readFileSync(0)).devices;const b=Object.values(d).flat().find(x=>x.name.startsWith("iPhone"));process.stdout.write(b?b.udid:"")')"
fi
if [[ -z "$DEVICE" ]]; then
  DEVICE="$(xcrun simctl list devices available -j | node -e 'const d=JSON.parse(require("fs").readFileSync(0)).devices;const k=Object.keys(d).filter(r=>r.includes("iOS")&&d[r].some(x=>x.name.startsWith("iPhone"))).sort().pop();process.stdout.write(k?d[k].find(x=>x.name.startsWith("iPhone")).udid:"")')"
fi
[[ -n "$DEVICE" ]] || { echo "No iPhone simulator found" >&2; exit 1; }

xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE" -b >/dev/null

xcodebuild -project "$WEB_DIR/ios/App/App.xcodeproj" -scheme App -configuration Debug \
  -destination "id=$(xcrun simctl list devices -j | node -e "const d=JSON.parse(require('fs').readFileSync(0)).devices;const x=Object.values(d).flat().find(x=>x.udid==='$DEVICE'||x.name==='$DEVICE');process.stdout.write(x.udid)")" \
  -derivedDataPath "$DERIVED" -quiet build 2>&1 | { grep -v 'IDERunDestination: Supported platforms' || true; }
[[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1

APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
# iOS uses its own bundle ID (eu.gaggimate.ios), so read it from the build, not capacitor.config.json.
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$APP/Info.plist")"
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$DEVICE" "$BUNDLE_ID" >/dev/null
echo "Launched $BUNDLE_ID on $(xcrun simctl list devices -j | node -e "const d=JSON.parse(require('fs').readFileSync(0)).devices;const x=Object.values(d).flat().find(x=>x.udid==='$DEVICE'||x.name==='$DEVICE');process.stdout.write(x.name+' ('+x.udid+')')")"

# Show the simulator: Simulator.app up to Xcode 26, DeviceHub from Xcode 27.
open -a Simulator --args -CurrentDeviceUDID "$DEVICE" 2>/dev/null || open -b com.apple.dt.Devices 2>/dev/null || true
