# Review Notes (texte prêt à coller)

## English (App Store Connect / Google Play Console)

```
Yako is an offline-first voice bookkeeping app for small informal merchants in Côte d'Ivoire.

IMPORTANT – THE APP IS 100% OFFLINE BY DESIGN
• There is no backend server and no network access: all data (sales, expenses, voice recordings) is stored only on the device, encrypted with AES-256 (SQLCipher + AES-GCM).
• The app does not request Internet access. This is intentional for privacy and for merchants with poor connectivity.

DEMO ACCOUNT (created locally on the review device)
1. Launch the app → choose a language → tap "Commencer".
2. Phone number: +225 01 00 00 00 00  (type 0100000000)
3. PIN: 814725 (enter it twice)
4. On the biometric screen, tap "Plus tard" (Later) or "Activer".
To log in again later: same phone number and PIN.

WHAT TO TEST
• Tap the large microphone button → hold the round button to record, release to stop. The microphone permission is requested only at that moment.
• Fill in the amount and tap "Enregistrer". The record appears on the home screen with today's totals.
• The voice recording is kept (encrypted) for playback in the record details ("Écouter").
• Automatic speech-to-text is not available in this version; the amount is typed manually.

ACCOUNT DELETION (Guideline 5.1.1(v))
Menu (⋮) → Réglages → Mes données → "Supprimer toutes mes données" → enter PIN → confirm twice.
This erases the encrypted database, keys and recordings.

PRIVACY
• No analytics, no ads, no tracking, no third-party SDK collecting data.
• Optional data sharing (anonymous credit score) is OFF by default, requires explicit consent, and is technically disabled in this version.
• Privacy policy: https://yako.ci/confidentialite

The interface is in French (Dioula and Baoulé translations are in progress).
```

## Français

```
Yako est une application de comptabilité vocale 100 % hors ligne pour les commerçants du secteur informel en Côte d'Ivoire. Aucune donnée ne quitte l'appareil : pas de serveur, pas d'accès Internet, chiffrement AES-256.

Compte de démonstration (créé localement) : numéro +225 01 00 00 00 00 (taper 0100000000), code secret 814725 (à saisir deux fois), puis « Plus tard » sur l'écran biométrique.

Suppression du compte : Menu ⋮ → Réglages → Mes données → Supprimer toutes mes données.
```
