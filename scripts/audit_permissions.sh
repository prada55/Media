#!/usr/bin/env bash
# scripts/audit_permissions.sh
#
# Compare les permissions RÉELLES des binaires (ou, à défaut, des sources)
# avec la liste attendue de Yako. Code de sortie 1 si un écart est trouvé.
#
#   iOS     : plutil (macOS) ou python3 plistlib sur Info.plist / l'.ipa
#   Android : aapt dump permissions sur l'APK release, sinon manifeste source
#
# Usage : scripts/audit_permissions.sh [chemin.apk] [chemin.ipa]

set -euo pipefail
cd "$(dirname "$0")/.."

APK="${1:-build/app/outputs/flutter-apk/app-release.apk}"
IPA="${2:-}"
status=0

EXPECTED_ANDROID=(
  "android.permission.RECORD_AUDIO"
  "android.permission.USE_BIOMETRIC"
  "android.permission.USE_FINGERPRINT"
)
FORBIDDEN_ANDROID=(
  "android.permission.INTERNET"
  "android.permission.ACCESS_NETWORK_STATE"
  "android.permission.CAMERA"
  "android.permission.READ_EXTERNAL_STORAGE"
  "android.permission.WRITE_EXTERNAL_STORAGE"
  "android.permission.ACCESS_FINE_LOCATION"
  "android.permission.ACCESS_COARSE_LOCATION"
  "android.permission.READ_PHONE_STATE"
  "com.google.android.gms.permission.AD_ID"
)
EXPECTED_IOS_KEYS=("NSMicrophoneUsageDescription" "NSFaceIDUsageDescription")
FORBIDDEN_IOS_KEYS=(
  "NSCameraUsageDescription"
  "NSLocationWhenInUseUsageDescription"
  "NSLocationAlwaysAndWhenInUseUsageDescription"
  "NSContactsUsageDescription"
  "NSPhotoLibraryUsageDescription"
  "NSUserTrackingUsageDescription"
  "UIBackgroundModes"
)

echo "== Android =="
if [[ -f "$APK" ]] && command -v aapt >/dev/null 2>&1; then
  echo "Source : $APK (aapt dump permissions)"
  ANDROID_PERMS=$(aapt dump permissions "$APK" | sed -n "s/.*name='\([^']*\)'.*/\1/p")
else
  echo "Source : android/app/src/main/AndroidManifest.xml (APK release absent ou aapt manquant)"
  ANDROID_PERMS=$(python3 - <<'PY'
import xml.etree.ElementTree as ET
ns = '{http://schemas.android.com/apk/res/android}'
tools = '{http://schemas.android.com/tools}'
root = ET.parse('android/app/src/main/AndroidManifest.xml').getroot()
for p in root.findall('uses-permission'):
    if p.get(tools + 'node') != 'remove':
        print(p.get(ns + 'name'))
PY
)
fi
echo "$ANDROID_PERMS" | sed 's/^/  - /'
for perm in "${EXPECTED_ANDROID[@]}"; do
  grep -qx "$perm" <<<"$ANDROID_PERMS" || { echo "  ✗ manquante : $perm"; status=1; }
done
for perm in "${FORBIDDEN_ANDROID[@]}"; do
  if grep -qx "$perm" <<<"$ANDROID_PERMS"; then
    echo "  ✗ INTERDITE : $perm (ajouter tools:node=\"remove\")"; status=1
  fi
done
while read -r perm; do
  [[ -z "$perm" ]] && continue
  printf '%s\n' "${EXPECTED_ANDROID[@]}" | grep -qx "$perm" ||
    { echo "  ✗ inattendue : $perm"; status=1; }
done <<<"$ANDROID_PERMS"

echo "== iOS =="
PLIST="ios/Runner/Info.plist"
if [[ -n "$IPA" && -f "$IPA" ]]; then
  TMP=$(mktemp -d)
  unzip -q "$IPA" 'Payload/*.app/Info.plist' -d "$TMP"
  PLIST=$(find "$TMP" -name Info.plist | head -1)
fi
echo "Source : $PLIST"
if command -v plutil >/dev/null 2>&1; then
  IOS_KEYS=$(plutil -convert json -o - "$PLIST" | python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin).keys()))')
else
  IOS_KEYS=$(python3 -c 'import plistlib,sys; print("\n".join(plistlib.load(open(sys.argv[1],"rb")).keys()))' "$PLIST")
fi
for key in "${EXPECTED_IOS_KEYS[@]}"; do
  grep -qx "$key" <<<"$IOS_KEYS" && echo "  ✓ $key" || { echo "  ✗ manquante : $key"; status=1; }
done
for key in "${FORBIDDEN_IOS_KEYS[@]}"; do
  if grep -qx "$key" <<<"$IOS_KEYS"; then echo "  ✗ INTERDITE : $key"; status=1; fi
done

if [[ $status -eq 0 ]]; then echo "OK : permissions conformes."; else echo "ÉCART détecté."; fi
exit $status
