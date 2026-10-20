#!/usr/bin/env bash
# scripts/build_android.sh — App Bundle release obfusqué pour Google Play.
# Prérequis : android/key.properties (voir docs/ci-cd.md),
#             YAKO_CONFIG_HMAC_KEY exportée (clé de signature de config).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${YAKO_CONFIG_HMAC_KEY:?Exporter YAKO_CONFIG_HMAC_KEY (clé HMAC de production)}"
[[ -f android/key.properties ]] || { echo "android/key.properties manquant"; exit 1; }

flutter clean
flutter pub get
dart run build_runner build
dart run tool/sign_config.dart "$YAKO_CONFIG_HMAC_KEY"
flutter build appbundle --release \
  --obfuscate --split-debug-info=build/symbols/android \
  --dart-define=YAKO_CONFIG_HMAC_KEY="$YAKO_CONFIG_HMAC_KEY"

echo "AAB : build/app/outputs/bundle/release/app-release.aab"
echo "Symboles (à conserver, NE PAS publier) : build/symbols/android"
