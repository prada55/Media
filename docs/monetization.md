# Yako — Monétisation : contrat de données et engagements

> **État : désactivée.** `monetization_enabled = false` et `feature_flags.sync = false` dans `assets/config.json` (signé HMAC). Seuls des *hooks* existent : interfaces, implémentation **MOCK** sans réseau, client HTTP épinglé **non branché**. L'application ne déclare pas la permission `INTERNET`.

## 1. Principes

1. Trois consentements **indépendants**, **désactivés par défaut** : partage du score de crédit, promotions, diagnostics.
2. Révocation **en un geste** (« Tout désactiver » dans Réglages → Confidentialité) ; chaque changement est tracé localement dans `audit_log` (type d'événement seulement).
3. **Liste blanche stricte** : seuls les 5 champs ci-dessous peuvent sortir de l'appareil, et seulement si le consentement « Partager mon score » est actif.
4. **Aucune vente de données personnelles, jamais.**

## 2. Contrat de données — payload agrégé

Classe : `lib/features/monetization/domain/entities/aggregated_credit_payload.dart` (la sérialisation lève une erreur si un champ hors liste blanche apparaît).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://yako.ci/schemas/aggregated-credit-payload-v1.json",
  "title": "AggregatedCreditPayload v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["score", "business_category", "months_active", "regularity_pct", "tx_count_bucket"],
  "properties": {
    "score":             { "type": "integer", "minimum": 0, "maximum": 100, "description": "Score local 0-100 (90 jours glissants)" },
    "business_category": { "type": "string", "enum": ["goods", "drinks", "food", "other"], "description": "Catégorie de vente dominante" },
    "months_active":     { "type": "integer", "minimum": 0, "maximum": 600, "description": "Mois depuis la première opération" },
    "regularity_pct":    { "type": "integer", "minimum": 0, "maximum": 100, "multipleOf": 5, "description": "Jours actifs / jours observés, arrondi à 5 %" },
    "tx_count_bucket":   { "type": "string", "enum": ["0-9", "10-49", "50-199", "200+"], "description": "Tranche du nombre d'opérations sur 90 jours" }
  }
}
```

### Calcul du score (sur l'appareil)

| Composante | Poids | Définition |
|---|---|---|
| Régularité | 40 % | jours avec ≥ 1 opération / jours observés (≤ 90) |
| Maîtrise des dépenses | 35 % | `1 − dépenses/ventes`, borné à [0, 1] ; 0 sans vente |
| Fréquence | 25 % | opérations par jour / 2, borné à [0, 1] |

Les montants servent au calcul **en mémoire** et ne sont jamais transmis.

## 3. Engagements de non-collecte (liste exhaustive)

Ne quittent **jamais** l'appareil, même avec consentement :

- nom, prénom, surnom ;
- numéro de téléphone (ni en clair, ni haché) ;
- code PIN, son empreinte, toute clé de chiffrement ;
- montant d'une opération, total, solde, ou toute valeur monétaire exacte ;
- transcriptions (français ou langue locale), enregistrements audio ;
- dates et heures précises des opérations ;
- localisation (l'app n'y a pas accès) ;
- contacts, photos, caméra (aucun accès) ;
- identifiants publicitaires (IDFA/GAID) ou d'appareil ;
- journal d'audit local.

Le consentement « diagnostics » est enregistré mais **aucun diagnostic n'est produit** dans cette version.

## 4. Flux technique

```
Consentement ON + monetization_enabled + feature_flags.sync
        │
        ▼
CreditScoreService.computeFromRepository()  (déchiffrement en mémoire)
        │
        ▼
buildAggregatedPayload()  ──►  sync_queue (payload chiffré AES-GCM, clé de session)
        │
        ▼  connectivité ? (OfflineConnectivityChecker = toujours non dans ce build)
CreditScoreApi.submitScore()
   • CreditScoreApiMock (par défaut) : aucun réseau, journal « MOCK submitScore »
   • CreditScoreApiHttp (non branché) : HTTPS, épinglage par certificats de confiance exclusifs
        │
        ▼
Échec → nouvel essai après 30 s, 2 min, 10 min, 1 h ; abandon après 5 tentatives
```

## 5. Modèle économique (B2B)

| Offre | Client | Données utilisées |
|---|---|---|
| Abonnement « score alternatif » | Banques, IMF, fintechs de crédit | Payload agrégé ci-dessus, uniquement pour les commerçants ayant consenti |
| Promotions contextuelles | Fournisseurs, grossistes | Aucune donnée personnelle : l'app demande les promotions par `business_category` et les affiche localement |
| Services à valeur ajoutée | Assureurs, épargne | Mise en relation à l'initiative du commerçant |

## 6. Conformité

- **Loi ivoirienne n°2013-450** relative à la protection des données à caractère personnel : consentement préalable, explicite et révocable ; finalité déterminée ; minimisation ; droit d'accès (export) et d'effacement (suppression in-app) ; déclaration/autorisation préalable auprès de l'**ARTCI** avant toute activation de la monétisation.
- **RGPD** (si traitement depuis l'UE ou d'utilisateurs dans l'UE) : base légale = consentement (art. 6.1.a) ; analyse d'impact (AIPD) recommandée avant activation ; contrat de sous-traitance avec chaque partenaire.
- Les partenaires s'engagent contractuellement à ne pas tenter de ré-identifier les commerçants.

## 7. Procédure de révocation

1. Réglages → Confidentialité et consentement → basculer l'interrupteur, ou « Tout désactiver ».
2. Effet immédiat : aucun nouvel envoi ; la file `sync_queue` n'est plus traitée.
3. Suppression complète : Réglages → Mes données → Supprimer toutes mes données (base, clés, audio effacés).
4. Côté partenaire (après activation) : une demande d'effacement est relayée dans les 30 jours.

## 8. Activer la monétisation (checklist)

- [ ] Autorisation ARTCI obtenue.
- [ ] Contrats partenaires signés (non ré-identification, sécurité, effacement).
- [ ] Certificats épinglés fournis (PEM) et `api_base_url` en HTTPS.
- [ ] Ajout de la permission `INTERNET` + mise à jour des déclarations App Store / Google Play (Phase 6).
- [ ] `ConnectivityChecker` réel + `CreditScoreApiHttp` branché dans la DI.
- [ ] `monetization_enabled` et `sync` à `true` dans `assets/config.json`, re-signé (`dart run tool/sign_config.dart`).

## Annexe — Déchiffrer un export CSV (`.yako`)

Format : `"YAKO1" | sel (32 o) | 0x01 | nonce (12 o) | chiffré | tag (16 o)` ; clé = PBKDF2-HMAC-SHA256(mot de passe, sel, 100 000 itérations, 32 o) ; AES-256-GCM.

Script fourni : [`scripts/decrypt_export.py`](../scripts/decrypt_export.py) (vérifié contre un export réel de l'application).

```bash
pip install cryptography
python3 scripts/decrypt_export.py yako_export_20261020.yako mes_operations.csv
```
