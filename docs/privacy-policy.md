# Politique de confidentialité — Yako

**Dernière mise à jour : 20 octobre 2026** · Version 1.0
URL publique (à héberger) : `https://yako.ci/confidentialite`

---

## Français

### 1. Qui sommes-nous ?
Yako est une application de comptabilité vocale pour commerçants, éditée par **[Raison sociale à compléter]**, [adresse à compléter], Côte d'Ivoire (le « responsable du traitement »).
Délégué à la protection des données (DPO) : **dpo@yako.ci**.

### 2. Principe fondamental : vos données restent sur votre téléphone
Yako fonctionne **entièrement hors ligne**. Nous n'exploitons **aucun serveur** qui reçoit vos opérations. L'application ne demande même pas l'accès à Internet.

### 3. Données traitées sur l'appareil
| Donnée | Usage | Stockage |
|---|---|---|
| Numéro de téléphone | Identifier votre compte local | **Jamais en clair** : empreinte SHA-256 salée, dans la base chiffrée |
| Code secret (PIN) | Déverrouiller l'app | **Jamais stocké** : seul un vérificateur PBKDF2 (100 000 itérations) |
| Ventes, dépenses, montants, catégories | Votre comptabilité | Base SQLCipher (AES-256) + montants chiffrés une seconde fois (AES-256-GCM) |
| Enregistrements vocaux | Réécoute de vos dictées | Fichiers chiffrés AES-256-GCM dans l'espace privé de l'app |
| Transcriptions et traductions | Affichage | Chiffrées AES-256-GCM |
| Langue, préférence biométrie | Réglages | Base chiffrée |
| Journal d'événements de sécurité | Détecter les tentatives d'intrusion | Base chiffrée — types d'événements uniquement, sans contenu |

Biométrie (empreinte, Face ID) : gérée exclusivement par le système. Yako ne reçoit qu'un « oui / non » et n'accède jamais à vos données biométriques.

### 4. Ce qui peut sortir de l'appareil — seulement avec votre accord
Trois options **indépendantes**, **désactivées par défaut**, modifiables à tout moment dans *Réglages → Confidentialité* :

1. **Partager mon score de crédit** : si activé (et si la fonctionnalité est ouverte dans votre version), seuls ces 5 éléments anonymes peuvent être transmis à des institutions financières partenaires : score (0-100), type d'activité (marchandises / boissons / alimentaire / autre), ancienneté en mois, régularité (% arrondi à 5), tranche du nombre d'opérations (0-9, 10-49, 50-199, 200+).
2. **Promotions** : affichage d'offres de fournisseurs selon votre type d'activité.
3. **Diagnostics** : réservé ; aucune donnée de diagnostic n'est produite dans la version actuelle.

> Dans la version 1.0, ces partages sont **techniquement désactivés** : aucune donnée ne quitte l'appareil, même si vous activez une option.

### 5. Ce qui ne sort JAMAIS
Nom, numéro de téléphone (même haché), code secret, montants exacts, transcriptions, enregistrements audio, dates précises, localisation, contacts, photos, identifiant publicitaire ou d'appareil. Aucune publicité tierce, aucun outil d'analyse ou de suivi, aucun service cloud (Firebase, etc.).

### 6. Export à votre initiative
Vous pouvez exporter vos opérations dans un fichier chiffré par un mot de passe que vous choisissez, et le partager avec l'application de votre choix. Ce partage est fait par vous ; Yako ne reçoit pas le fichier.

### 7. Durée de conservation
Vos données restent sur votre téléphone tant que vous ne les supprimez pas. Elles ne sont **pas** incluses dans les sauvegardes cloud ni les transferts d'appareil (elles sont liées à ce téléphone). Si vous désinstallez Yako, elles sont effacées par le système.

### 8. Vos droits
Conformément à la **loi ivoirienne n°2013-450 du 19 juin 2013** relative à la protection des données à caractère personnel (et au **RGPD** si vous êtes dans l'Union européenne) :
- **accès et portabilité** : *Réglages → Mes données → Exporter* ;
- **rectification** : modifiez chaque opération dans l'app ;
- **effacement** : *Réglages → Mes données → Supprimer toutes mes données* (base, clés et enregistrements effacés) ou page web : `https://yako.ci/supprimer-compte` ;
- **retrait du consentement** : un geste dans *Réglages → Confidentialité* ;
- **réclamation** : auprès de l'ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire) ou de l'autorité de votre pays.

### 9. Base légale
Exécution du service demandé (comptabilité locale) ; **consentement** explicite et révocable pour tout partage (art. 6.1.a RGPD ; loi 2013-450).

### 10. Sécurité
Chiffrement AES-256 (SQLCipher + AES-GCM), clés dans le Keychain iOS / Keystore Android, verrouillage automatique après 2 minutes, blocage progressif après 5 codes erronés, captures d'écran bloquées sur Android.

### 11. Enfants
Yako s'adresse aux commerçants adultes et ne collecte sciemment aucune donnée d'enfant.

### 12. Contact
DPO : dpo@yako.ci · Support : support@yako.ci · Sécurité : security@yako.ci

---

## English

### 1. Who we are
Yako is a voice bookkeeping app for small merchants, published by **[Company name — to be completed]**, Côte d'Ivoire (the "controller"). Data Protection Officer: **dpo@yako.ci**.

### 2. Core principle: your data stays on your phone
Yako works **fully offline**. We run **no server** receiving your records; the app does not even request Internet access.

### 3. Data processed on the device
Phone number (stored only as a salted SHA-256 hash inside the encrypted database), PIN (never stored; PBKDF2 verifier only), sales/expenses/amounts (SQLCipher AES-256 database, amounts additionally AES-256-GCM encrypted), voice recordings, transcripts and translations (AES-256-GCM), language and biometric preference, security event log (event types only). Biometrics are handled by the operating system; Yako only receives a yes/no answer.

### 4. What may leave the device — only with your consent
Three independent options, **off by default**, revocable at any time: (1) share an anonymous credit score — exactly 5 fields: score 0-100, business category, months active, regularity (% rounded to 5), transaction-count bucket; (2) supplier promotions; (3) diagnostics (reserved, nothing is produced in this version).
> In version 1.0 sharing is **technically disabled**: no data leaves the device even if an option is turned on.

### 5. What NEVER leaves the device
Name, phone number (even hashed), PIN, exact amounts, transcripts, audio, precise dates, location, contacts, photos, advertising or device identifiers. No third-party ads, analytics, tracking or cloud services.

### 6. User-initiated export
You may export your records as a password-encrypted file and share it with any app you choose. Yako does not receive it.

### 7. Retention
Data stays on your phone until you delete it. It is excluded from cloud backups and device-to-device transfers. Uninstalling the app erases it.

### 8. Your rights
Under Ivorian Law No. 2013-450 and, where applicable, the EU GDPR: access/portability (in-app export), rectification (edit records), erasure (in-app *Delete all my data*, or `https://yako.ci/delete-account`), withdrawal of consent (one tap), complaint to ARTCI or your local authority.

### 9. Legal basis
Performance of the requested service (local bookkeeping); explicit, revocable **consent** for any sharing.

### 10. Security
AES-256 encryption, keys in iOS Keychain / Android Keystore, 2-minute auto-lock, progressive lockout after 5 wrong PINs, screenshots blocked on Android.

### 11. Contact
DPO: dpo@yako.ci · Support: support@yako.ci · Security: security@yako.ci
