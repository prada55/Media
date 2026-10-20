# Yako — Conformité App Store & Google Play

> Vérification automatisée des permissions : `scripts/audit_permissions.sh` (voir `docs/permissions-audit.md`).

## Apple — App Review Guidelines

| Règle | Exigence | Yako | Preuve |
|---|---|---|---|
| **2.1** Complétude | App complète, sans plantage, sans contenu provisoire visible | ✅ (⚠️ icône provisoire à remplacer avant soumission) | tests `flutter test`, `docs/branding.md` |
| **2.3** Métadonnées exactes | Description fidèle ; ne pas promettre la transcription vocale tant qu'elle n'est pas active | ⚠️ À respecter dans la fiche : la v1.0 enregistre la voix pour réécoute, la saisie du montant est manuelle | `docs/voice-rd.md` |
| **2.5.1** API publiques | Uniquement des API publiques | ✅ Flutter + plugins standards | |
| **4.0** Design | Interface native utilisable, accessible | ✅ grandes cibles (≥ 48 dp), contrastes, Semantics | |
| **5.1.1** Collecte de données | Politique de confidentialité, usage des permissions expliqué, suppression de compte in-app | ✅ | `docs/privacy-policy.md`, Info.plist, *Réglages → Supprimer* |
| **5.1.1(v)** Suppression de compte | Si création de compte : suppression dans l'app | ✅ compte local supprimable in-app | `DeleteAccountScreen` |
| **5.1.2** Utilisation/partage | Pas de partage sans consentement ; pas de tracking | ✅ 3 consentements OFF par défaut, envoi désactivé | `docs/monetization.md` |

## Google Play — Politiques développeur

| Politique | Yako | Preuve |
|---|---|---|
| **User Data** (divulgation, consentement, traitement sécurisé) | ✅ politique publiée, aucune collecte, consentement explicite pour tout partage futur | `docs/google-play-data-safety.md` |
| **Permissions** (minimum nécessaire, usage au premier besoin) | ✅ RECORD_AUDIO demandé au premier appui long sur le micro ; biométrie optionnelle | `RecordController.startRecording` |
| **Account Deletion** (in-app + lien web) | ✅ | `docs/account-deletion-webpage.md` |
| **Target API level** | ✅ targetSdk 36 | `android/app/build.gradle.kts` |
| **Data Safety form** | ✅ « Aucune donnée collectée » | |

## Ce que nous ne faisons pas

- ❌ Pas d'IDFA / GAID (AD_ID retiré du manifeste), pas d'App Tracking Transparency.
- ❌ Pas de publicité tierce, pas de SDK publicitaire.
- ❌ Pas de Firebase, Supabase ni autre BaaS ; pas d'analytics ; pas de crash reporting cloud.
- ❌ Pas de caméra, pas de localisation, pas de contacts, pas de photos.
- ❌ Pas d'accès Internet déclaré (INTERNET retiré en release).
- ❌ Pas de sauvegarde cloud des données (allowBackup=false, data extraction rules).
- ❌ Pas de téléchargement de code ou de modèle à l'exécution.

## Points de vigilance (relecture)

1. **Fonctionnement hors ligne** : un reviewer peut penser que l'app « ne fait rien » côté serveur. Les *Review Notes* l'expliquent (`docs/review-notes.md`).
2. **Pas de compte de démonstration distant** : le compte est créé localement par le reviewer avec les identifiants fournis.
3. **Transcription vocale** : non disponible en 1.0 (repli manuel). Ne pas la mettre en avant dans les captures ni la description.
4. **Langues locales** : interface dioula/baoulé non traduite (repli français) — ne pas annoncer la traduction dans la fiche avant complétion.
5. **Chiffrement** : `ITSAppUsesNonExemptEncryption = true` → répondre à la conformité à l'export (voir `docs/app-store-privacy-labels.md`).
6. **iPad** : orientation portrait + `UIRequiresFullScreen` ; fournir des captures iPad si l'app reste universelle.
7. **Monétisation** : toute activation future impose de mettre à jour les étiquettes de confidentialité et la Data Safety **avant** publication.
