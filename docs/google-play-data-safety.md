# Google Play — Section « Sécurité des données » (Data Safety)

## Verdict — monétisation désactivée (version 1.0)

### ✅ **« Aucune donnée collectée »** · **« Aucune donnée partagée »**

Définition Google : la collecte = transmission hors de l'appareil. Le traitement 100 % local (« on-device ») n'est pas une collecte. Yako ne déclare pas la permission `INTERNET` (retirée explicitement en release, cf. `docs/permissions-audit.md`).

| Type de données Google | Collecté | Partagé | Note |
|---|---|---|---|
| Position | Non | Non | aucun accès |
| Informations personnelles (nom, e-mail, ID utilisateur, adresse, **téléphone**, …) | Non | Non | numéro haché localement |
| Informations financières (paiements, **autres infos financières**) | Non | Non | montants chiffrés localement |
| Santé et remise en forme | Non | Non | |
| Messages | Non | Non | |
| Photos et vidéos | Non | Non | |
| Fichiers audio (enregistrements vocaux, musique, autres) | **Non** | Non | enregistrés et chiffrés sur l'appareil |
| Fichiers et documents | Non | Non | export partagé par l'utilisateur lui-même |
| Agenda, Contacts | Non | Non | |
| Activité dans l'application | Non | Non | |
| Navigation Web | Non | Non | |
| Infos et performances de l'appli (plantages, diagnostics) | Non | Non | aucun crash reporting cloud |
| Identifiants de l'appareil ou autres | Non | Non | pas d'AD_ID (retiré du manifeste) |

### Pratiques de sécurité à déclarer

- **Données chiffrées en transit** : sans objet (aucune transmission) — répondre « Oui » uniquement si la question est obligatoire ; sinon N/A.
- **Possibilité de demander la suppression des données** : **Oui**.
  - In-app : *Réglages → Mes données → Supprimer toutes mes données*.
  - URL web de suppression du compte : `https://yako.ci/supprimer-compte` (page : `docs/account-deletion-webpage.md`).
- **Conforme à la Families Policy** : non applicable (public adulte).
- **Validation indépendante de la sécurité (MASA)** : non à ce stade.

### Note sur la conservation locale
Les données restent sur l'appareil jusqu'à suppression par l'utilisateur ; elles sont exclues de la sauvegarde Google et des transferts d'appareil (`allowBackup=false`, `dataExtractionRules`).

## Verdict — si la monétisation est activée et consentie

| Type | Collecté | Partagé | Facultatif ? | Finalités |
|---|---|---|---|---|
| Informations financières → *Autres infos financières* (score agrégé) | Oui | **Oui** (institutions financières partenaires) | **Oui** (consentement) | Fonctionnalité de l'appli |
| Activité dans l'application → *Autres actions* (tranche du nombre d'opérations, régularité) | Oui | Oui | Oui | Fonctionnalité de l'appli, Analyse |

Données **traitées de façon éphémère** : non. Chiffrement en transit : oui (TLS épinglé).
