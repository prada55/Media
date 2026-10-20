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

## Décisions Phase 2

| # | Décision | Raison |
|---|----------|--------|
| D8 | Clé SQLCipher aléatoire en Keychain/Keystore ; **clé de données** (montants, transcriptions) aléatoire, enveloppée par une clé dérivée du PIN (PBKDF2) ; copie biométrique uniquement si l'utilisateur l'active | La base doit s'ouvrir avant la connexion (compteur `auth_attempts`), tandis que les champs sensibles restent illisibles sans PIN/biométrie |
| D9 | `FLAG_SECURE` sur toute l'activité Android (pas de package) ; voile flouté iOS via notifications `UIScene` | Tous les écrans affichent des données financières ; aucun plugin tiers maintenu ne justifie une dépendance de plus |
| D10 | Compte à rebours de verrouillage : une lecture DB puis décompte local | Évite une requête DB par seconde |
| D11 | Empreinte du téléphone = SHA-256(sel + numéro), stockée dans la base chiffrée | Espace des numéros CI ≈ 4×10⁸ : l'empreinte seule ne protège pas contre la force brute, d'où son stockage exclusif dans la base SQLCipher |

## Limites connues (documentées dans docs/security.md en Phase 7)

- **L1** — Le déverrouillage biométrique repose sur `local_auth` (booléen applicatif) + Keychain/Keystore. Sur un appareil rooté/jailbreaké avec extraction du Keystore, la clé biométrique est exposée. Le PIN reste la protection forte.
- **L2** — `changePin` ne peut pas vérifier que le nouveau PIN n'est pas tiré du numéro (seule l'empreinte du numéro est connue).

## Décisions Phase 3

| # | Décision | Raison |
|---|----------|--------|
| D12 | STT : `StubSttEngine` (pas de sherpa_onnx embarqué) ; repli formulaire manuel + audio chiffré réécoutable | Aucun modèle fourni ; embarquer onnxruntime sans modèle ajouterait ~30 Mo inutiles. POC décrit dans `docs/voice-rd.md` |
| D13 | Réécoute via fichier temporaire privé déchiffré puis effacé | La source mémoire de just_audio exige la permission INTERNET (proxy localhost) |
| D14 | `type` et `created_at` en clair (dans la base SQLCipher) pour filtrer/trier en SQL ; montant et transcriptions chiffrés applicativement | Totaux/recherche en mémoire, pagination par pages de 500 |

## Pistes (roadmap)

- **R4** — Intégrer `SherpaOnnxSttEngine` (voir `docs/voice-rd.md`).
- **R5** — Index `transactions(created_at DESC)` déjà présent ; au-delà de 10 000 opérations, envisager une table d'agrégats journaliers chiffrés pour les totaux.

## Décisions Phase 4

| # | Décision | Raison |
|---|----------|--------|
| D15 | Dictionnaires et UI DYU/BCI livrés avec valeurs `null` | Interdiction d'inventer des traductions ; repli français + badge « Non traduit » |
| D16 | Cache de traduction : SHA-256 de la source + texte traduit chiffré (clé de session) | Les transcriptions sont des données sensibles |
| D17 | `StubTranslationEngine` (pas de TFLite) | Aucun modèle < 100 Mo validé ; baoulé absent de NLLB-200 |
| D18 | Localisation : `context.tr()` / `Tr()` + `L10nScope` ; les messages d'erreur du domaine (`userMessageFr`) restent en français | Refactor léger demandé |

- **R6** — Faire compléter `assets/i18n/*` par des locuteurs natifs (procédure dans `docs/translation-rd.md`).
- **R7** — Localiser les `userMessageFr` des Failures via des clés (refactor des couches domaine).
