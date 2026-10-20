# Yako — Roadmap et dette suivie

Tout `TODO` du code doit pointer vers une entrée de ce fichier (`TODO(roadmap#N)`).

## Décisions Phase 1 (validées le 2026-10-20)

| # | Décision | Raison |
|---|----------|--------|
| D0 | Plancher Flutter 3.47 / Dart 3.13 (au lieu de 3.24 / 3.5) | Les versions maintenues de very_good_analysis, Riverpod, path_provider l'exigent |
| D1 | Riverpod 3.4.3, `Notifier` au lieu de `StateProvider` | Riverpod 2.6.1 publié le 2024-10-22 (> 12 mois) |
| D2 | `sqlite3` 3.x + hooks `source: sqlcipher` | `sqlcipher_flutter_libs` / `sqlite3_flutter_libs` en EOL (0.7.0+eol / 0.6.0+eol) |
| D3 | flutter_secure_storage 11 : `first_unlock_this_device`, `storageNamespace: yako` ; minSdk Android 24 | `encryptedSharedPreferences` supprimé en v11 ; Flutter ≥ 3.35 exige API 24 |
| D4 | Exception règle des 12 mois pour `path` 1.9.1 ; `convert` retiré (`dart:convert` suffit) | `path` est un package officiel Dart, figé par le SDK Flutter |
| D5 | `cryptography` 2.9.0 au lieu de `pointycastle` | pointycastle 4.0.0 publié le 2025-02-19 (> 12 mois) |
| D6 | `hashPin` = PBKDF2-HMAC-SHA256 100k (séparé par domaine de la clé dérivée) | SHA-256(pin+sel) se casse en < 1 s (10⁶ PIN possibles) |
| D7 | `build_runner` figé en 2.16.1 | 2.16.2+ exige analyzer 14.3, incompatible avec injectable_generator 3.1.3 (lean_builder) |

## Points de surveillance

- **R1** — `cryptography` 2.9.0 publié le 2025-11-21 : atteint 12 mois le 2026-11-21. Réévaluer (alternative : `cryptography_flutter` / API natives).
- **R2** — `build_runner` : lever le gel dès qu'injectable_generator supporte analyzer ≥ 14.3.
- **R3** — Clé de config HMAC : la valeur par défaut est une clé de développement ; la clé de production est injectée via `--dart-define=YAKO_CONFIG_HMAC_KEY` (CI, Phase 7).
