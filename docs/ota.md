# Yako — Mises à jour (OTA) et versionnement

## 1. Android — code push auto-hébergé (`flutter_patcher`)

`flutter_patcher` 0.1.4 (pub.dev, 2026-08-20) : code push open-source auto-hébergé pour Flutter Android ; il remplace `libapp.so` (Dart AOT) et les assets au démarrage à froid, avec contrôle d'intégrité et retour arrière en cas de crash.

> ### ⛔ Non retenu pour la distribution Google Play
> 1. **Politique Google Play « Device and Network Abuse »** : une app distribuée par Google Play ne doit pas se modifier, se remplacer ou se mettre à jour par un autre moyen que Google Play, ni télécharger de code exécutable (dex, JAR, **.so**) depuis une autre source. Remplacer `libapp.so` relève de ce cas → **risque de suppression de l'app**.
> 2. Il exige la permission `INTERNET`, que Yako ne déclare pas (contrainte « 100 % hors ligne »).
> 3. Paquet jeune (0.1.x) : maturité à évaluer.
>
> Usage envisageable **uniquement** pour une distribution hors Play (APK direct, MDM d'un partenaire), avec : serveur de patchs signé, vérification de signature avant application, retour arrière automatique, consentement de l'utilisateur au téléchargement.

**Correctifs urgents sur Play** : publier une version via le *staged rollout* (déploiement progressif 1 % → 100 %), avec possibilité d'*halt* immédiat dans la Play Console.

## 2. iOS — App Store uniquement

**Guideline 3.3.1 / 2.5.2** : le code exécutable ne peut pas être téléchargé ni modifié après la revue. **Toutes** les mises à jour passent par l'App Store (revue habituellement 24-72 h ; *Expedited Review* possible pour un correctif critique).

## 3. Mises à jour de DONNÉES (dictionnaires, promotions)

Autorisées sur les deux plateformes (ce ne sont pas du code), **lorsque l'accès réseau sera activé** (aujourd'hui : uniquement via une nouvelle version).

Format : JSON signé HMAC-SHA256, même mécanisme que `assets/config.json` (`lib/core/config/config_signature.dart`) :
1. Le fichier contient un champ `config_signature` = HMAC-SHA256(clé, JSON canonique sans ce champ, clés triées).
2. L'app vérifie la signature en temps constant ; si invalide → fichier ignoré, valeurs embarquées conservées.
3. Signature côté serveur / poste de publication :
   ```bash
   export YAKO_CONFIG_HMAC_KEY='…clé de production…'
   python3 scripts/sign_json.py assets/i18n/phrases_fr_dyu.json
   python3 scripts/sign_json.py --verify assets/i18n/phrases_fr_dyu.json
   # ou côté Dart :
   dart run tool/sign_config.dart "$YAKO_CONFIG_HMAC_KEY"   # (config.json)
   ```
   `scripts/sign_json.py` produit exactement la même signature que l'app (vérifié sur `assets/config.json`).
4. Évolution recommandée avant toute distribution réseau : passer à une **signature asymétrique (Ed25519)** — l'app n'embarque que la clé publique (une clé HMAC embarquée peut être extraite par rétro-ingénierie).

## 4. Versionnement sémantique

`pubspec.yaml` → `version: X.Y.Z+N` (`N` = build number, toujours croissant pour les stores).

| Exemple | Quand |
|---|---|
| 1.0.0 → **1.0.1** | correctif (bug, texte, sécurité) sans changement de données |
| 1.0.1 → **1.1.0** | nouvelle fonctionnalité compatible (ex. moteur STT, dictionnaires complétés) |
| 1.1.0 → **2.0.0** | rupture : migration de schéma non rétro-compatible, activation de la monétisation (nouvelles déclarations stores) |

Toute migration Drift incrémente `schemaVersion` et ajoute `drift_schemas/drift_schema_vN.json` + un test de migration.
