# Yako

**Parlez, Yako compte pour vous.** Comptabilité vocale 100 % hors ligne pour les commerçants du secteur informel en Côte d'Ivoire — ventes, dépenses et totaux du jour, chiffrés sur le téléphone, en français (dioula et baoulé en préparation).

| Accueil | Enregistrement | Réglages |
|---|---|---|
| *capture à venir* | *capture à venir* | *capture à venir* |

## Prérequis

- Flutter **3.47.x** (Dart 3.13) — `flutter --version`
- Android : Android SDK 36, JDK 17 · iOS : macOS + Xcode récent, CocoaPods, iOS 15+
- Python 3 (scripts de déchiffrement / signature, facultatif)

## Installation locale

```bash
git clone https://github.com/prada55/Media.git yako && cd yako
flutter pub get
dart run build_runner build          # Drift, injectable
flutter run                          # appareil ou émulateur
```

Le premier build télécharge les binaires SQLCipher (build hooks de `package:sqlite3`, empreintes sha256 vérifiées) ; aucun téléchargement n'a lieu à l'exécution.

## Architecture

Clean Architecture par feature (`data` / `domain` / `presentation`), Riverpod 3 pour l'état, get_it + injectable pour l'injection, `Result<T>` pour toutes les erreurs.

```
lib/
├── core/        config signée HMAC, Result/Failure, sécurité (AES-GCM, PBKDF2, Keychain), thème, l10n
├── data/local/  base Drift + SQLCipher, migrations (v1 → v2)
└── features/
    ├── auth/          inscription, PIN, biométrie, verrouillage auto, suppression de compte
    ├── transactions/  voix, audio chiffré, opérations chiffrées, accueil, journal
    ├── translation/   dictionnaires FR ↔ DYU/BCI, cache, localisation de l'UI
    ├── consent/       3 consentements indépendants (OFF par défaut)
    ├── monetization/  score local, payload à liste blanche, API mock, synchronisation
    └── settings/      réglages, export CSV chiffré
```

### Paquets (versions vérifiées sur pub.dev le 2026-10-20)

| Paquet | Rôle | Justification |
|---|---|---|
| flutter_riverpod 3.4.3 | état | imposé ; 2.x non maintenu (> 12 mois) |
| drift 2.35.2 / drift_flutter 0.3.1 | ORM SQLite, migrations testées | imposé |
| sqlite3 3.7.1 (hook `sqlcipher`) | SQLCipher AES-256 | remplace `sqlcipher_flutter_libs` (EOL) |
| flutter_secure_storage 11.2.0 | Keychain / Keystore | imposé |
| cryptography 2.9.0 | AES-256-GCM, PBKDF2 | pointycastle > 12 mois |
| crypto 3.0.7 | SHA-256, HMAC | officiel Dart |
| local_auth 3.0.2 | biométrie | imposé |
| record 7.1.2 / just_audio 0.10.6 / permission_handler 13.0.2 | capture, réécoute, permission micro | imposés |
| share_plus 13.3.1 | partage de l'export chiffré | seul moyen de remettre le fichier à l'utilisateur |
| get_it 9.3.0 / injectable 3.0.0 | injection | imposés |
| path_provider, path, uuid, intl | utilitaires | `path` : exception documentée (D4) |
| *dev* very_good_analysis 11, mocktail, build_runner, drift_dev, injectable_generator, icons_launcher, flutter_native_splash | qualité, tests, génération | |

Aucun Firebase, BaaS, analytics ou crash reporting cloud. Décisions détaillées : [`docs/roadmap.md`](docs/roadmap.md).

## Tests

```bash
flutter analyze --fatal-infos
flutter test                                   # 157 tests unitaires / widgets
flutter test integration_test -d <appareil>   # parcours e2e + test de charge
scripts/audit_permissions.sh                   # permissions réelles vs attendues
scripts/audit_security.sh                      # logs, secrets, SDK interdits, TODO, dépendances
```

## Build

```bash
export YAKO_CONFIG_HMAC_KEY='…'     # clé de production (jamais versionnée)
scripts/build_android.sh            # AAB obfusqué
scripts/build_ios.sh                # IPA obfusquée (macOS)
```

## Contribuer

- Branches courtes, PR vers `main` ; la CI (`pr_check.yml`) doit être verte.
- Messages **Conventional Commits** : `feat(transactions): …`, `fix(auth): …`, `docs: …`, `chore: …`, `test: …`.
- Tout `TODO` doit référencer `docs/roadmap.md` : `TODO(roadmap#R4)`.
- Aucune donnée sensible dans les logs ; aucune traduction dioula/baoulé inventée.

## Documentation

- Sécurité : [`docs/security.md`](docs/security.md) · audit : [`docs/security-audit-final.md`](docs/security-audit-final.md)
- Conformité stores : [`docs/compliance.md`](docs/compliance.md) · [`docs/publishing.md`](docs/publishing.md)
- Monétisation et contrat de données : [`docs/monetization.md`](docs/monetization.md)
- Mises à jour : [`docs/ota.md`](docs/ota.md)
- Voix : [`docs/voice-rd.md`](docs/voice-rd.md) · Traduction : [`docs/translation-rd.md`](docs/translation-rd.md)
- Performance : [`docs/performance.md`](docs/performance.md) · CI/CD : [`docs/ci-cd.md`](docs/ci-cd.md) · Branding : [`docs/branding.md`](docs/branding.md)
