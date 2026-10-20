# Yako — CI/CD (GitHub Actions)

## Workflows

| Fichier | Déclencheur | Étapes |
|---|---|---|
| `.github/workflows/ci.yml` | chaque push | `analyze-and-test` : pub get, build_runner, format, `flutter analyze --fatal-infos`, `flutter test --coverage`, audit permissions (sources), audit sécurité. Sur `main` : `build-android` (APK release obfusqué, split ABI, contrôle < 60 Mo, audit permissions binaire via `aapt`). `build-ios` préparé (commenté). |
| `.github/workflows/pr_check.yml` | pull request | analyze + tests |

Les tests d'intégration (`integration_test/`) nécessitent un appareil ou émulateur : à lancer manuellement ou via un service de fermes d'appareils (Firebase Test Lab est exclu par le cahier des charges ; alternatives : émulateur Android dans un job dédié `reactivecircus/android-emulator-runner`).

## Secrets à configurer (Settings → Secrets and variables → Actions)

| Secret | Usage |
|---|---|
| `YAKO_CONFIG_HMAC_KEY` | Clé HMAC de production pour `assets/config.json` (`--dart-define`) |
| `ANDROID_KEYSTORE_BASE64` | Keystore de signature release encodé en base64 (`base64 -w0 release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clé |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |
| `IOS_P12_BASE64` / `IOS_P12_PASSWORD` | Certificat de distribution Apple (job iOS) |
| `IOS_PROVISIONING_PROFILE_BASE64` | Profil de provisionnement App Store |
| `APP_STORE_CONNECT_API_KEY` (optionnel) | Upload automatisé (fastlane / altool) |

Sans keystore, l'APK de CI est signé avec la clé debug : **il ne doit jamais être publié**.

## Signature Android en local

`android/key.properties` (ignoré par git) :
```properties
storeFile=release.jks
storePassword=…
keyAlias=yako
keyPassword=…
```
Créer le keystore : `keytool -genkey -v -keystore android/app/release.jks -keyalg RSA -keysize 4096 -validity 10000 -alias yako`. Activer **Play App Signing** (Google conserve la clé de signature finale ; vous gardez la clé d'upload).

## Symboles d'obfuscation

`--split-debug-info` produit `build/symbols/` : à **archiver en privé** (nécessaires pour symboliser une trace), jamais publiés. Les traces se symbolisent avec `flutter symbolize -i trace.txt -d build/symbols/app.android-arm64.symbols`.
