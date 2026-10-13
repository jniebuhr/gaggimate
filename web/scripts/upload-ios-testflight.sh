#!/usr/bin/env bash
# Archives a Release build and uploads it to App Store Connect / TestFlight (build number is bumped by Xcode).
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$WEB_DIR/ios/App/build/GaggiMate.xcarchive"

xcodebuild -project "$WEB_DIR/ios/App/App.xcodeproj" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates -quiet archive

xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$WEB_DIR/ios/ExportOptions-testflight.plist" \
  -exportPath "$WEB_DIR/ios/App/build/testflight" -allowProvisioningUpdates
echo "Uploaded to App Store Connect; the build shows up in TestFlight after processing."
