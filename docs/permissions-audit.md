# Audit des permissions

## Liste attendue

| Plateforme | Permission / clé | Raison | Demandée quand |
|---|---|---|---|
| Android | `RECORD_AUDIO` | Dictée des opérations | Premier appui long sur le micro |
| Android | `USE_BIOMETRIC` | Déverrouillage par empreinte (optionnel) | Activation par l'utilisateur |
| Android | `USE_FINGERPRINT` (`maxSdkVersion=28`) | Idem, Android ≤ 9 | Idem |
| iOS | `NSMicrophoneUsageDescription` | Dictée | Premier appui long |
| iOS | `NSFaceIDUsageDescription` | Face ID (optionnel) | Activation |

## Interdites (vérifiées absentes)

Android : `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CAMERA`, `READ/WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_AUDIO`, `ACCESS_FINE/COARSE_LOCATION`, `READ_PHONE_STATE`, `FOREGROUND_SERVICE`, `WAKE_LOCK`, `AD_ID`.
iOS : `NSCameraUsageDescription`, localisation, contacts, photos, `NSUserTrackingUsageDescription`, `UIBackgroundModes`.

## Procédure

```bash
flutter build apk --release        # puis :
scripts/audit_permissions.sh build/app/outputs/flutter-apk/app-release.apk
flutter build ipa --release        # puis :
scripts/audit_permissions.sh "" build/ios/ipa/Yako.ipa
```

- Android : `aapt dump permissions <apk>` (Android SDK build-tools) lit le manifeste **fusionné** réel.
- iOS : `plutil -convert json` (macOS) sur l'`Info.plist` de l'`.ipa`.
- Sans artefact (CI d'analyse, ce dépôt), le script audite les sources.

### État au 2026-10-20
Audit des **sources** : ✅ conforme (`scripts/audit_permissions.sh`). Audit des **binaires** : à exécuter sur une machine disposant du SDK Android et de Xcode (non disponibles dans l'environnement de développement utilisé).

## Si un plugin ajoute une permission non voulue

1. Identifier le plugin : `./gradlew :app:processReleaseManifest` puis lire `build/app/outputs/logs/manifest-merger-release-report.txt`.
2. Ajouter dans `android/app/src/main/AndroidManifest.xml` :
   ```xml
   <uses-permission android:name="android.permission.XXX" tools:node="remove"/>
   ```
   (le namespace `xmlns:tools` est déjà déclaré).
3. Vérifier que la fonctionnalité du plugin n'en dépend pas (sinon, retirer le plugin).
4. Relancer `scripts/audit_permissions.sh`.

iOS : `permission_handler` ne compile que `PERMISSION_MICROPHONE=1` (Podfile, `post_install`), afin qu'aucune API sensible non utilisée ne soit liée.
