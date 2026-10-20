#!/usr/bin/env bash
# scripts/audit_security.sh — audit statique de sécurité.
#  1. print / debugPrint / log dans lib/ (aucune donnée sensible en log)
#  2. secrets en dur (clés privées, tokens, mots de passe)
#  3. SDK interdits (Firebase, Supabase, analytics, crash reporting cloud)
#  4. TODO non référencés dans docs/roadmap.md
#  5. dépendances obsolètes (dart pub outdated)
# Journal : build/security-audit-AAAAMMJJ.log ; code 1 si problème bloquant.
set -uo pipefail
cd "$(dirname "$0")/.."

mkdir -p build
LOG="build/security-audit-$(date +%Y%m%d).log"
status=0
exec > >(tee "$LOG") 2>&1

section() { printf '\n== %s ==\n' "$1"; }

section "1. Journaux dans lib/"
LOGS=$(grep -rnE '\b(print|debugPrint)\(' lib --include='*.dart' | grep -v '\.g\.dart' || true)
if [[ -n "$LOGS" ]]; then echo "$LOGS"; echo "✗ print/debugPrint trouvés"; status=1; else echo "✓ aucun print/debugPrint"; fi
DEVLOG=$(grep -rn 'developer.log(' lib --include='*.dart' || true)
echo "${DEVLOG:-✓ aucun developer.log}"
echo "  (seul usage autorisé : « MOCK <opération> » sans payload)"

section "2. Secrets en dur"
SECRETS=$(grep -rnEi '(BEGIN (RSA |EC )?PRIVATE KEY|api[_-]?key\s*[:=]\s*["'"'"'][A-Za-z0-9]{16,}|secret\s*[:=]\s*["'"'"'][A-Za-z0-9]{16,}|password\s*[:=]\s*["'"'"'][^"'"'"']{6,})' \
  lib android/app/src ios/Runner assets --include='*.dart' --include='*.kt' --include='*.swift' --include='*.json' --include='*.xml' --include='*.plist' || true)
if [[ -n "$SECRETS" ]]; then echo "$SECRETS"; echo "✗ secret potentiel"; status=1; else echo "✓ aucun secret détecté"; fi
grep -n "defaultValue: 'yako-dev-config-hmac-key-change-me'" lib/core/config/config_signature.dart >/dev/null \
  && echo "ℹ clé HMAC de DÉVELOPPEMENT par défaut : la production doit passer --dart-define=YAKO_CONFIG_HMAC_KEY"

section "3. SDK interdits"
FORBIDDEN=$(grep -nE '^\s+(firebase_[a-z_]+|cloud_firestore|supabase[a-z_]*|sentry[a-z_]*|google_mobile_ads|amplitude_flutter|mixpanel_flutter|appsflyer_sdk|facebook_app_events|connectivity_plus|http|dio):' pubspec.yaml || true)
if [[ -n "$FORBIDDEN" ]]; then echo "$FORBIDDEN"; echo "✗ dépendance interdite"; status=1; else echo "✓ aucune dépendance interdite"; fi

section "4. TODO non justifiés"
TODOS=$(grep -rnP 'TODO(?!\(roadmap#)' lib android/app/src ios/Runner --include='*.dart' --include='*.kt' --include='*.swift' --include='*.kts' || true)
if [[ -n "$TODOS" ]]; then echo "$TODOS"; echo "✗ TODO sans référence roadmap"; status=1; else echo "✓ aucun TODO orphelin"; fi

section "5. Dépendances"
if command -v flutter >/dev/null 2>&1; then
  flutter pub outdated --no-dev-dependencies --show-all 2>/dev/null | sed -n '1,60p'
else
  echo "flutter introuvable : étape ignorée"
fi
echo "→ Vérifier les CVE : https://osv.dev (écosystème Pub) et les dépôts des paquets."

section "Résultat"
if [[ $status -eq 0 ]]; then echo "OK — aucun problème bloquant."; else echo "ÉCHEC — voir ci-dessus."; fi
echo "Journal : $LOG"
exit $status
