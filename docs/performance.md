# Yako — Performance

## Objectifs (appareils de référence : Tecno Spark, Infinix Hot — Android Go / 2-3 Go RAM)

| Mesure | Objectif | Statut |
|---|---|---|
| Démarrage à froid → écran de connexion | < 3 s | À mesurer sur appareil (`flutter run --profile`, DevTools) |
| Déverrouillage (PIN → accueil) | < 500 ms | ⚠️ PBKDF2 100k en Dart pur, dans un isolate : ≈ 0,3-1,5 s estimés sur ces appareils (2 dérivations : vérificateur + KEK). Voir pistes |
| Transcription de 5 s d'audio | < 3 s | Sans objet en 1.0 (STT non intégré, `docs/voice-rd.md`) |
| Fil d'accueil | 60 fps | Liste paresseuse (`SliverList.builder`), 50 éléments max |
| Création d'une opération | < 1 s | ✅ 100 opérations chiffrées < 5 s (test `integration_test/e2e_offline_stress_test.dart`, mesuré en CI/VM ; à confirmer sur appareil) |
| Taille de base pour 100 opérations | < 50 Mo | ✅ assertion du test de stress ; une base à 1 opération pèse 76 Ko |

## Optimisations en place

- **Pagination** : fil limité à 50 ; journal à 200 ; analyses (totaux, recherche, score) par pages de 500 lignes déchiffrées.
- **Chiffrement à la volée** : seuls montant et transcriptions sont chiffrés applicativement ; tri et filtres (`type`, `created_at`) restent en SQL indexé.
- **Index** : `transactions(created_at DESC)`, `transactions(type)`, `translations_cache(source_text_hash)`, `auth_attempts(phone_hash)`.
- **Cache des traductions** : évite de recalculer les correspondances approchées (Levenshtein) et les sorties de modèle.
- **Isolates** : PBKDF2 hors du thread UI ; Drift via `drift_flutter` (isolat d'arrière-plan).
- **Audio** : AAC 32 kbit/s (~240 Ko/min) ; un seul `AudioPlayer` réutilisé (singleton DI) ; fichier temporaire de lecture supprimé après usage.

## Points de vigilance

- **> 1 000 opérations** : les totaux déchiffrent toutes les lignes de la période. Au-delà de ~10 000, introduire des agrégats journaliers chiffrés (roadmap R5).
- **PBKDF2 sur appareils lents** : si le déverrouillage dépasse 1 s, options : `cryptography_flutter` (implémentation native), mise en cache de la KEK pendant la session, ou Argon2id natif.
- **Taille APK** : SQLCipher lie OpenSSL sur Android ; utiliser `--split-per-abi` (CI) ou l'App Bundle. Objectif < 60 Mo par ABI (vérifié en CI).

## Mesurer

```bash
flutter run --profile -d <appareil>          # DevTools > Performance / CPU
flutter test integration_test/e2e_offline_stress_test.dart -d <appareil>
flutter build apk --release --split-per-abi --analyze-size --target-platform android-arm64
```
