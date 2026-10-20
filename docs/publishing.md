# Yako — Publication sur l'App Store et Google Play

## 1. Comptes

| Store | Coût | Procédure |
|---|---|---|
| **Apple Developer Program** | 99 USD / an | developer.apple.com/programs → compte **Organisation** (numéro D-U-N-S requis, gratuit, 1-2 semaines) → validation juridique → accès App Store Connect |
| **Google Play Console** | 25 USD (une fois) | play.google.com/console → compte **Organisation** (D-U-N-S) → vérification d'identité → pour un nouveau compte personnel : test fermé obligatoire (12 testeurs, 14 jours) avant la production |

## 2. Préparer App Store Connect

- Nouvelle app : nom **Yako**, bundle `com.yako.app`, SKU `yako-ios`, langue principale **Français**.
- Catégorie : **Productivité** (secondaire : Finance). Classification : **4+**.
- Captures (PNG, sans cadre ou avec cadre fidèle) :
  - iPhone 6,9" / 6,7" (1290 × 2796) — obligatoire
  - iPhone 6,5" (1284 × 2778 / 1242 × 2688)
  - iPhone 5,5" (1242 × 2208) — si demandé
  - iPad 13" (2064 × 2752) — si l'app reste universelle
- Description FR + EN (sans promettre la transcription automatique ni les langues locales tant qu'elles ne sont pas livrées), mots-clés (100 caractères), URL d'assistance, **URL de politique de confidentialité** (`https://yako.ci/confidentialite`).
- App Privacy : **Data Not Collected** (`docs/app-store-privacy-labels.md`).
- Conformité à l'export : *Uses encryption = Yes* (`ITSAppUsesNonExemptEncryption = true`).
- Informations de revue : texte de `docs/review-notes.md`, compte de démonstration (créé localement : +225 01 00 00 00 00 / 814725), coordonnées.

## 3. Préparer Google Play Console

- Fiche : mêmes textes, icône 512 × 512, bannière 1024 × 500, captures téléphone (≥ 2, 16:9 ou 9:16), tablette optionnelle.
- **Contenu de l'application** : politique de confidentialité (URL), accès à l'app (instructions de `docs/review-notes.md`), annonces : *Non*, classification du contenu (questionnaire IARC), public cible : **18 ans et +**, **Sécurité des données** : « Aucune donnée collectée » (`docs/google-play-data-safety.md`), **URL de suppression de compte** (`https://yako.ci/supprimer-compte`), applications financières : déclarer « aucune fonctionnalité de prêt » (la fonctionnalité de score est désactivée).
- Activer **Play App Signing** ; téléverser l'AAB (`scripts/build_android.sh`).

## 4. Procédure de soumission

1. `flutter analyze --fatal-infos && flutter test` → vert.
2. `scripts/audit_security.sh` et `scripts/audit_permissions.sh <apk> <ipa>` → OK.
3. Incrémenter `version:` dans `pubspec.yaml` (ex. `1.0.0+1`).
4. Android : `scripts/build_android.sh` → Play Console → *Test interne* → *Test fermé* → *Production* (déploiement progressif 10 % → 100 %).
5. iOS : `scripts/build_ios.sh` → Transporter / Xcode Organizer → TestFlight (test interne) → *Soumettre pour vérification*.
6. Archiver `build/symbols/` (privé).

## 5. Gérer un rejet

| Motif probable | Réponse |
|---|---|
| « L'app ne fonctionne pas / pas de contenu » (offline) | Renvoyer les Review Notes : app 100 % locale, compte à créer avec les identifiants fournis |
| 2.1 Performance — fonctionnalité annoncée absente | Vérifier que la fiche ne promet pas la transcription automatique |
| 5.1.1 — usage du micro peu clair | Le texte de `NSMicrophoneUsageDescription` précise quand et pourquoi ; rappeler que l'audio ne quitte pas l'appareil |
| 5.1.1(v) — suppression de compte | Indiquer le chemin Réglages → Mes données → Supprimer |
| Google — Data Safety incohérente | Comparer avec `scripts/audit_permissions.sh` sur l'AAB ; aucune permission réseau |
| Google — politique financière | Préciser qu'aucun prêt n'est proposé dans l'app |

Répondre dans le *Resolution Center* (Apple) ou via le formulaire d'appel (Google), corriger, re-soumettre.

## 6. Calendrier indicatif

| Étape | Durée |
|---|---|
| Création des comptes (D-U-N-S, vérifications) | 1-3 semaines |
| Captures, textes, hébergement politique + page de suppression | 2-3 jours |
| Builds signés + audits binaires | 1 jour |
| Test fermé Google (si compte personnel récent) | 14 jours |
| 1ʳᵉ revue Apple / Google | 24-72 h (jusqu'à 7 jours pour un premier envoi Google) |
| Corrections éventuelles + nouvelle revue | 2-5 jours |
| **Publication** | **≈ 3 à 6 semaines** après le démarrage, selon les comptes |
