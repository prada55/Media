# App Store — Étiquettes de confidentialité (App Privacy)

Référence Apple : « Data is considered *collected* when it is transmitted off the device in a way that allows you and/or your third-party partners to access it for a period longer than necessary to service the transmitted request in real time. »

## Verdict — monétisation désactivée (version 1.0, configuration livrée)

### ✅ **Data Not Collected**

Justification : aucune donnée ne quitte l'appareil. L'app ne déclare pas d'accès réseau, n'embarque aucun SDK d'analyse, de publicité, de crash reporting ou de backend. L'export est un partage **initié par l'utilisateur** vers l'app de son choix (non collecté par le développeur).

| Catégorie Apple | Collectée ? | Commentaire |
|---|---|---|
| Contact Info (nom, e-mail, téléphone, adresse, autres) | **Non** | Le numéro n'est utilisé que localement (empreinte) |
| Health & Fitness | Non | |
| Financial Info (paiement, crédit, autres) | **Non** | Montants stockés et chiffrés localement uniquement |
| Location (précise, approximative) | Non | Aucun accès |
| Sensitive Info | Non | |
| Contacts | Non | Aucun accès |
| User Content (e-mails, SMS, photos/vidéos, **audio**, gameplay, support, autres) | **Non** | Audio enregistré et chiffré localement, jamais transmis |
| Browsing History | Non | |
| Search History | Non | Recherche locale |
| Identifiers (User ID, Device ID) | Non | |
| Purchases | Non | |
| Usage Data (interaction, publicité, autres) | Non | |
| Diagnostics (crash, performance, autres) | Non | |
| Other Data | Non | |

**Tracking (ATT)** : Non. Pas d'IDFA, pas de `NSUserTrackingUsageDescription`.

## Verdict — si la monétisation est activée ET l'utilisateur consent

À déclarer **avant** de publier une version où `monetization_enabled = true` (et après ajout de l'accès réseau) :

| Catégorie | Type | Liée à l'identité ? | Utilisée pour le tracking ? | Finalité |
|---|---|---|---|---|
| Diagnostics → **Other Diagnostic Data** | score agrégé, ancienneté, régularité | **Non** (aucun identifiant transmis) | Non | Third-Party Advertising : non ; **App Functionality / Analytics** selon contrat partenaire |
| Usage Data → **Product Interaction** | tranche du nombre d'opérations | Non | Non | Analytics |
| Financial Info → **Other Financial Info** | *à évaluer avec le conseil juridique* : un score de crédit dérivé de l'activité peut être considéré comme information financière | Non | Non | App Functionality (accès au crédit) |

> Point de vigilance : Apple pourrait considérer le score de crédit comme « Other Financial Info ». La déclaration la plus prudente l'inclut. Ne jamais déclarer « Data Not Collected » une fois l'envoi activé.

## Chiffrement — `ITSAppUsesNonExemptEncryption = true`

Yako utilise de la cryptographie standard (AES-256-GCM, SQLCipher, PBKDF2) **en plus** de celle d'iOS. La clé est donc `true`. Conséquences :

1. Répondre « Yes » à la question de conformité à l'export dans App Store Connect.
2. L'usage relève en principe de la catégorie 5 partie 2 (EAR), avec exemption pour la protection de données utilisateur ; préparer l'**auto-classification annuelle** (BIS) et, si demandé, la documentation d'export (ERN/CCATS ne sont généralement pas requis pour ce cas — **à confirmer par un conseil**).
3. Pour la distribution en France : déclaration de fourniture de moyens de cryptologie auprès de l'ANSSI si applicable.
