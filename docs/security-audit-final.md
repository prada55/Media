# Yako — Audit de sécurité final

**Date** : 2026-10-20 · **Version** : 1.0.0+1 · **Flutter** 3.47.7 / Dart 3.13.5
**Environnement d'audit** : conteneur Linux sans SDK Android ni Xcode — les contrôles qui exigent un binaire release sont signalés **« à exécuter »**.

## Synthèse

| # | Contrôle | Résultat |
|---|---|---|
| 1 | `scripts/audit_security.sh` (logs, secrets, SDK interdits, TODO, dépendances) | ✅ OK |
| 2 | APK obfusqué sans noms sensibles (`unzip -l` + `strings`) | ⏳ **À exécuter** (pas de SDK Android ici) — procédure ci-dessous |
| 3 | Base SQLite chiffrée sans chaîne lisible (`strings` sur `.sqlite`) | ✅ 0 occurrence |
| 4 | Info.plist + AndroidManifest conformes Phase 6 | ✅ (sources) / ⏳ binaires |
| 5 | Paquets vulnérables / obsolètes | ✅ 0 avis de sécurité, toutes les dépendances directes à jour |
| 6 | Qualité : `flutter analyze --fatal-infos`, `flutter test` | ✅ 0 problème, 157 tests verts |

## 1. Audit statique (`scripts/audit_security.sh`)

```
== 1. Journaux dans lib/ ==            ✓ aucun print/debugPrint
  seul developer.log : credit_score_api_mock.dart — « MOCK <opération> », sans payload
== 2. Secrets en dur ==                ✓ aucun secret détecté
  ℹ clé HMAC de DÉVELOPPEMENT par défaut : la production doit passer --dart-define=YAKO_CONFIG_HMAC_KEY
== 3. SDK interdits ==                 ✓ aucune dépendance interdite (Firebase, Supabase, Sentry, ads, analytics, http, dio, connectivity_plus)
== 4. TODO non justifiés ==            ✓ aucun TODO orphelin
== 5. Dépendances ==                   toutes les dépendances directes en dernière version (dart pub outdated)
Résultat : OK — aucun problème bloquant.
```

## 2. APK obfusqué — procédure (à exécuter)

```bash
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/symbols
APK=build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
unzip -l "$APK" | grep -E 'libapp.so|libsqlcipher|libsqlite'      # bibliothèques attendues
unzip -p "$APK" lib/arm64-v8a/libapp.so | strings | grep -ciE \
  'EncryptionServiceImpl|AuthRepositoryImpl|dataKey|pinHash|phoneHash'   # attendu : 0
unzip -p "$APK" lib/arm64-v8a/libapp.so | strings | grep -c 'yako-dev-config-hmac-key'  # attendu : 0 si --dart-define
scripts/audit_permissions.sh "$APK"
```

Critères : aucun nom de classe/méthode Dart sensible lisible (obfuscation), aucune clé de développement si la clé de production est injectée, taille < 60 Mo par ABI (contrôlée en CI).

## 3. Base SQLite chiffrée — exécuté ✅

Base produite par le vrai pipeline (inscription + 1 opération « MARQUEUR_SECRET piment rouge », 987 654 FCFA), copiée puis analysée :

```
$ strings audit_yako.sqlite | grep -ciE "SQLite format|MARQUEUR|piment|987654|0100000000|users|transactions|CREATE TABLE"
0
$ strings -n 6 audit_yako.sqlite | head -3
#,>kWJ^}
`.GTM
eL0;t#o
```

Ni l'en-tête `SQLite format 3`, ni le schéma, ni le montant, ni la transcription, ni le numéro ne sont lisibles. Également couvert par les tests automatisés : `database_test.dart` (fichier SQLCipher illisible, mauvaise clé refusée) et `transaction_repository_test.dart` (colonnes `amount`/`transcript_*` chiffrées même après ouverture de la base).

## 4. Déclarations plateformes — exécuté sur les sources ✅

`scripts/audit_permissions.sh` :
```
Android : RECORD_AUDIO, USE_BIOMETRIC, USE_FINGERPRINT — aucune permission interdite
iOS     : ✓ NSMicrophoneUsageDescription  ✓ NSFaceIDUsageDescription — aucune clé interdite
OK : permissions conformes.
```
Vérifié aussi : `allowBackup=false`, `fullBackupContent=false`, `dataExtractionRules`, `usesCleartextTraffic=false`, `screenOrientation=portrait`, `ITSAppUsesNonExemptEncryption=true`, `UIRequiredDeviceCapabilities=[arm64]`, portrait uniquement, pas de `UIBackgroundModes`.
⏳ À refaire sur l'APK/IPA release (manifeste fusionné réel).

## 5. Vulnérabilités des dépendances

- `dart pub outdated` : les 18 dépendances directes sont à leur dernière version résoluble.
- Avis de sécurité pub.dev (`/api/packages/<nom>/advisories`, alimenté par GitHub Advisory Database / OSV) : **0 avis** pour crypto, cryptography, drift, drift_flutter, flutter_riverpod, flutter_secure_storage, get_it, injectable, intl, just_audio, local_auth, path, path_provider, permission_handler, record, share_plus, sqlite3, uuid.
- L'API osv.dev directe n'était pas joignable depuis l'environnement d'audit (politique réseau) : la recherche ci-dessus passe par pub.dev.
- **Binaire SQLCipher natif** (fourni par `package:sqlite3` 3.7.1) : suivre les avis Zetetic/SQLite séparément ; mettre à jour `sqlite3` à chaque release de sécurité.

## 6. Points ouverts

| Priorité | Point | Référence |
|---|---|---|
| Haute | Exécuter les audits binaires (APK/IPA) et la recherche `strings` sur `libapp.so` | §2, R9 |
| Haute | Injecter la clé HMAC de production (`--dart-define`) dans les builds release | `scripts/build_*.sh` |
| Moyenne | Brute-force hors ligne du PIN sur appareil compromis (10⁶) — envisager Argon2id / clé liée à l'authentification | `docs/security.md` L3 |
| Moyenne | Biométrie non liée cryptographiquement (MASVS L2 AUTH-8) | L1 |
| Basse | Signature asymétrique (Ed25519) des futurs JSON distants | `docs/ota.md` |
