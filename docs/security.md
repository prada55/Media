# Yako — Sécurité

## 1. Architecture de protection des données

```
                       ┌──────────────── Keychain iOS (this-device-only) / Keystore Android ───────────────┐
                       │  yako.db_key            clé SQLCipher 256 bits (aléatoire)                        │
                       │  yako.data_key.pin      clé de données ENVELOPPÉE par KEK = PBKDF2(PIN, sel)      │
                       │  yako.data_key.biometric clé de données (présente seulement si biométrie activée) │
                       │  yako.phone_hint        « 01••••••45 » chiffré par la clé de données              │
                       └───────────────────────────────────────────────────────────────────────────────────┘
yako.sqlite (SQLCipher AES-256) ── users (empreinte téléphone, vérificateur PIN PBKDF2 100k)
                                 ── transactions (montant + transcriptions chiffrés AES-256-GCM, clé de données)
                                 ── translations_cache (SHA-256 source, texte chiffré)
                                 ── consent / sync_queue (payload chiffré) / audit_log (types d'événements) / auth_attempts
documents/audio/{uuid}.enc ────── audio chiffré AES-256-GCM (clé de données)
```

- **Deux couches** : SQLCipher protège le fichier ; la **clé de données** protège les champs sensibles et n'existe en mémoire que pendant une session déverrouillée (PIN ou biométrie).
- Séparation des clés (MASVS CRYPTO-5) : clé SQLCipher ≠ clé de données ≠ KEK dérivée du PIN ≠ vérificateur du PIN (séparation de domaine PBKDF2) ≠ clé d'export (PBKDF2 du mot de passe utilisateur).

## 2. Modèle de menaces

| Menace | Scénario | Contre-mesures | Risque résiduel |
|---|---|---|---|
| **Vol du téléphone** (verrouillé) | Le voleur ouvre Yako | Écran de verrouillage Yako, PIN 6 chiffres non trivial, blocage progressif 30 s → 30 min après 5 échecs, auto-verrouillage 2 min / 30 s en arrière-plan | Faible |
| **Accès physique** (téléphone déverrouillé, app en arrière-plan) | Un proche regarde le sélecteur d'apps | FLAG_SECURE (Android), voile flouté (iOS), verrouillage après 30 s en arrière-plan | Faible |
| **Extraction de la base via sauvegarde** | adb backup, sauvegarde cloud, transfert d'appareil | `allowBackup=false`, `dataExtractionRules` excluant tout, Keychain `*_this_device_only` ; base illisible sans clé | Très faible |
| **Extraction de clé sur appareil rooté/jailbreaké** | Attaquant lit le Keystore / la mémoire | Les champs sensibles restent chiffrés par la clé de données, enveloppée par le PIN ; brute-force du PIN hors ligne coûteux (PBKDF2 100k) mais **possible** (10⁶ PIN) | **Moyen** — limite documentée (L1) ; si la biométrie est activée, la clé de données est dans le Keystore |
| **Fuite réseau** | Interception, exfiltration | Aucune permission INTERNET en release ; client B2B futur avec épinglage TLS sans racines système | Nul en v1.0 |
| **Fuite via journaux** | logcat / Console | Aucun `print`/`debugPrint` dans `lib/` (vérifié par `scripts/audit_security.sh`) ; seul log : « MOCK <opération> » | Très faible |
| **Brute-force du PIN** (en ligne) | Essais successifs dans l'app | Compteur persistant `auth_attempts` dans la base chiffrée, verrouillage progressif, PIN triviaux refusés | Faible |
| **Brute-force du PIN** (hors ligne, base + Keystore extraits) | 10⁶ combinaisons | PBKDF2-HMAC-SHA256 100k ≈ 10⁶ × 100k HMAC ≈ heures sur GPU | **Moyen** — piste : passer à Argon2id / clé matérielle liée à l'authentification (roadmap) |
| **Falsification de la configuration** | Activer la monétisation en modifiant `config.json` | Signature HMAC-SHA256, repli sûr (tout OFF) si invalide | Faible (la clé HMAC est dans le binaire : protège contre l'édition naïve, pas contre la rétro-ingénierie) |
| **Injection de formules** (export CSV ouvert dans un tableur) | Transcription commençant par `=` | Préfixe `'` sur `= + - @` | Très faible |

## 3. Correspondance OWASP MASVS L1 (référentiel MSTG v1.5, équivalents MASVS v2 entre parenthèses)

### STORAGE

| ID | Exigence | Statut | Implémentation |
|---|---|---|---|
| STORAGE-1 | Stockage d'identifiants via les services système | ✅ | `flutter_secure_storage` 11 (Keychain / Keystore AES-GCM) — `KeyVault`, `EncryptionServiceImpl` (MASVS-STORAGE-1) |
| STORAGE-2 | Pas de données sensibles hors conteneur / stockage sécurisé | ✅ | Base, audio et exports temporaires dans les répertoires privés ; audio temporaire en clair effacé après chiffrement (MASVS-STORAGE-1) |
| STORAGE-3 | Pas de données sensibles dans les journaux | ✅ | Aucun print ; `toString()` des sessions/failures sans PII (MASVS-STORAGE-2) |
| STORAGE-4 | Pas de partage avec des tiers sauf nécessité | ✅ | Aucun SDK tiers ; payload B2B à liste blanche, consentement requis, désactivé (MASVS-PRIVACY) |
| STORAGE-5 | Cache clavier désactivé sur les saisies sensibles | ✅ | PIN via pavé interne ; mots de passe `obscureText` ; numéro `enableSuggestions/autocorrect: false` |
| STORAGE-6 | Pas d'exposition via IPC | ✅ | Pas de ContentProvider/Service exporté ; partage d'export uniquement à l'initiative de l'utilisateur, fichier chiffré |
| STORAGE-7 | Pas d'exposition via l'UI | ⚠️ | PIN masqué ; le dernier chiffre est visible 500 ms (exigence UX du cahier des charges) ; numéro affiché masqué |
| STORAGE-8 *(L2)* | Pas de données dans les sauvegardes | ✅ | `allowBackup=false`, `dataExtractionRules`, Keychain this-device-only |
| STORAGE-9 *(L2)* | Masquage en arrière-plan | ✅ | FLAG_SECURE, voile iOS |
| STORAGE-10 *(L2)* | Données sensibles en mémoire le moins longtemps possible | ◑ | Clé de données effacée au verrouillage ; les chaînes Dart ne peuvent pas être écrasées (limite de la plateforme) |
| STORAGE-12 | Information de l'utilisateur sur les données traitées | ✅ | Politique in-app, aperçu exact du payload (« Mon score ») |
| STORAGE-14 *(L2)* | Chiffrement avec clé matérielle exigeant l'authentification | ◑ | Clé de données enveloppée par le PIN ; la clé SQLCipher est en Keystore sans authentification requise (nécessaire au compteur de tentatives) |

### CRYPTO

| ID | Exigence | Statut | Implémentation |
|---|---|---|---|
| CRYPTO-1 | Pas de clé symétrique codée en dur comme seule protection | ✅ | Toutes les clés de données sont aléatoires (`Random.secure`). La clé HMAC de configuration n'est pas une protection de données (voir menaces) |
| CRYPTO-2 | Implémentations éprouvées | ✅ | SQLCipher, `package:cryptography` (AES-GCM, PBKDF2), `package:crypto` (SHA-256/HMAC) |
| CRYPTO-3 | Primitives adaptées, bons paramètres | ✅ | AES-256-GCM (nonce 96 bits aléatoire, tag 128), PBKDF2-HMAC-SHA256 100k, sels 256 bits |
| CRYPTO-4 | Pas d'algorithmes obsolètes | ✅ | Aucun MD5/SHA-1/ECB/CBC |
| CRYPTO-5 | Pas de réutilisation de clé | ✅ | Séparation des clés (§1) |
| CRYPTO-6 | Aléa cryptographique | ✅ | `Random.secure()` ; nonces `AesGcm.newNonce()` |

### AUTH (application hors ligne : équivalents locaux des exigences « endpoint distant »)

| ID | Exigence | Statut | Implémentation locale |
|---|---|---|---|
| AUTH-1 | Authentification avant accès | ✅ | PIN / biométrie avant toute lecture des données chiffrées |
| AUTH-2 | Sessions à identifiant aléatoire | ✅ (local) | Session = clé de données en mémoire, jamais persistée |
| AUTH-3 | Jetons signés (sans état) | N/A | Pas de serveur |
| AUTH-4 | Fin de session à la déconnexion | ✅ | `SessionManager.clear()` efface la clé |
| AUTH-5 | Politique de mot de passe | ✅ | 6 chiffres, refus des suites, chiffres identiques, PIN contenu dans le numéro |
| AUTH-6 | Protection contre les essais excessifs | ✅ | 5 essais puis 30 s, 1, 5, 15, 30 min (persistant) |
| AUTH-7 | Expiration après inactivité | ✅ | 2 min d'inactivité, 30 s en arrière-plan |

## 4. Limites connues (honnêteté)

- **L1** Biométrie : `local_auth` renvoie un booléen ; la clé de données biométrique est stockée dans le Keystore/Keychain sans liaison cryptographique à l'événement biométrique (MASVS L2 AUTH-8 non couvert).
- **L2** `changePin` ne peut pas vérifier que le nouveau PIN n'est pas extrait du numéro (seule l'empreinte est connue).
- **L3** Brute-force hors ligne du PIN possible sur appareil compromis (espace 10⁶).
- **L4** Clé HMAC de configuration embarquée dans le binaire (rétro-ingénierie possible) ; elle ne protège que contre l'édition naïve d'un asset.
- **L5** Les audits binaires (APK obfusqué, IPA) restent à exécuter sur une machine disposant des SDK (voir `docs/security-audit-final.md`).

## 5. Divulgation responsable

Signalez toute vulnérabilité à **security@yako.ci** (adresse à créer avant publication) :
1. Description, version, étapes de reproduction. N'incluez **aucune donnée réelle** d'utilisateur.
2. Accusé de réception sous 72 h, évaluation sous 14 jours, correctif visé sous 90 jours.
3. Merci de ne pas divulguer publiquement avant le correctif ; crédit public proposé.
4. Hors périmètre : attaques nécessitant un appareil déjà rooté **et** le PIN, ingénierie sociale, déni de service local.
