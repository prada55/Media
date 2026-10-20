#!/usr/bin/env bash
# scripts/build_ios.sh — IPA release obfusquée pour l'App Store (macOS + Xcode).
# Prérequis : certificats/profils de distribution installés,
#             ios/ExportOptions.plist, YAKO_CONFIG_HMAC_KEY exportée.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${YAKO_CONFIG_HMAC_KEY:?Exporter YAKO_CONFIG_HMAC_KEY (clé HMAC de production)}"

flutter clean
flutter pub get
dart run build_runner build
dart run tool/sign_config.dart "$YAKO_CONFIG_HMAC_KEY"
(cd ios && pod install --repo-update)
EXPORT_ARGS=()
[[ -f ios/ExportOptions.plist ]] && EXPORT_ARGS=(--export-options-plist=ios/ExportOptions.plist)
flutter build ipa --release \
  --obfuscate --split-debug-info=build/symbols/ios \
  --dart-define=YAKO_CONFIG_HMAC_KEY="$YAKO_CONFIG_HMAC_KEY" \
  "${EXPORT_ARGS[@]}"

echo "IPA : build/ios/ipa/"
echo "Symboles (à conserver, NE PAS publier) : build/symbols/ios"
