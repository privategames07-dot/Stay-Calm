#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
dest="$(mktemp -d)"
trap 'rm -rf "$dest"' EXIT
app="$dest/Payload/StayCalm.app"
mkdir -p "$app" dist
sdk="$(xcrun --sdk iphoneos --show-sdk-path)"
xcrun --sdk iphoneos swiftc -swift-version 5 -O -parse-as-library -target arm64-apple-ios16.0 -sdk "$sdk" ios/App.swift -framework UIKit -framework WebKit -framework PhotosUI -framework Vision -o "$app/StayCalm"
cp -R web "$app/web"
for size in 120 180; do
  sips -s format png -z "$size" "$size" web/logo.jpg --out "$app/Icon${size}.png" >/dev/null
done
cp ios/Info.plist "$app/Info.plist"
plutil -lint "$app/Info.plist"
xcrun lipo "$app/StayCalm" -verify_arch arm64
file "$app/StayCalm"
build_number="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app/Info.plist")"
[[ "$build_number" =~ ^[1-9][0-9]*$ ]]
out="$PWD/dist/stay-calm-${build_number}.ipa"
(cd "$dest" && /usr/bin/zip -qr "$dest/stay-calm.ipa" Payload)
mv "$dest/stay-calm.ipa" "$out"
unzip -t "$out"
