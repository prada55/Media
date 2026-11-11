# Moteur Motion — studio de motion design pour iPhone

Application de **motion design / compositing** inspirée du fonctionnement des logiciels
d'animation professionnels (calques, keyframes, courbes, animateurs de texte), pensée pour
l'écran tactile de l'iPhone. Elle s'installe sur l'écran d'accueil et fonctionne **hors ligne**.

> Ce n'est pas un portage d'Adobe After Effects (logiciel propriétaire) : c'est une application
> originale qui reprend les principes du motion design, écrite en HTML/JS sans dépendance.

## Fonctionnalités

| Domaine | Ce que fait l'app |
|---|---|
| **Compositions** | Formats 9:16 (Reels/TikTok), 1:1, 4:5, 16:9 · 24/25/30/60 i/s · durée jusqu'à 10 min |
| **Calques** | Texte, bulle de texte, rectangle, cercle, fond uni, dégradé, image, vidéo · visibilité, verrou, ordre, dupliquer, scinder |
| **Keyframes** | Position, échelle, largeur, hauteur, rotation, opacité, flou · bouton ◆ par propriété (comme un chronomètre) · navigation ◀◆ ◆▶ · déplacement des keyframes dans la timeline |
| **Interpolation** | Linéaire, accélération, décélération, douce, expo, dépassement, élastique, rebond, maintien |
| **Animateur de texte** | Par lettre / mot / ligne : machine à écrire, fondu montant/descendant, pop, flou → net, révélation par masque, rotation, dispersion, espacement, vague · entrée et sortie |
| **Préréglages** | 14 entrées, 6 sorties, 6 boucles (pulsation, flottement, secousse, néon…) appliqués à la tête de lecture |
| **Effets** | Lueur, ombre portée, flou, 11 modes de fusion, dégradés linéaires/radiaux, contours |
| **Gestes** | Glisser pour déplacer, pincer pour mettre à l'échelle et faire pivoter, magnétisme au centre, double‑tap sur un texte pour l'éditer |
| **Timeline** | Règle de lecture, déplacement/rognage des calques, magnétisme sur la tête de lecture, zoom |
| **Générateur** | Texte cinétique automatique : une phrase devient une séquence animée |
| **Modèles** | Présentation, logo néon, appel à l'action réseaux sociaux, compte à rebours |
| **Polices** | Polices iOS + import de vos propres fichiers .ttf/.otf |
| **Export** | Vidéo MP4 (H.264) pleine qualité ou légère, image PNG · partage direct vers Photos / Instagram / TikTok |
| **Projets** | Sauvegarde automatique (IndexedDB), annuler/rétablir, export/import .json |

## Installer sur iPhone

1. Héberger le dossier `app/` en **HTTPS** (voir ci-dessous).
2. Ouvrir l'adresse dans **Safari** sur l'iPhone.
3. Bouton **Partager** → **Sur l'écran d'accueil**.
4. L'app s'ouvre en plein écran, comme une application native, et fonctionne hors ligne.

### Hébergement gratuit avec GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement `app/` à chaque push sur `main` :

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Fusionner sur `main` (ou lancer le workflow à la main depuis l'onglet **Actions**).
3. L'adresse est du type `https://<utilisateur>.github.io/<dépôt>/`.

### Tester en local

```bash
cd app
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Publier sur l'App Store (optionnel)

L'app étant une PWA autonome, on peut l'emballer dans une app native avec
[Capacitor](https://capacitorjs.com) (nécessite un Mac avec Xcode et un compte Apple Developer) :

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Moteur Motion" com.exemple.moteurmotion --web-dir app
npx cap add ios
npx cap open ios   # puis Product → Archive dans Xcode
```

## Structure

```
app/
├── index.html            Interface
├── manifest.webmanifest  Installation sur l'écran d'accueil
├── sw.js                 Fonctionnement hors ligne
├── css/styles.css        Thème sombre, mise en page iPhone / iPad
├── icons/                Icônes de l'app
└── js/
    ├── engine.js         Moteur : calques, keyframes, courbes, rendu Canvas
    ├── presets.js        Préréglages d'animation
    ├── templates.js      Modèles + générateur de texte cinétique
    ├── storage.js        Sauvegarde locale (IndexedDB)
    └── app.js            Interface tactile, timeline, inspecteur, export
```

## Limites connues

- L'export se fait en temps réel (une vidéo de 10 s prend 10 s) : garder l'écran allumé.
- Le son des calques vidéo n'est pas encore inclus dans l'export.
- Pas encore de parentage de calques, de masques dessinés ni de caméra 3D.
- Les médias importés restent sur l'appareil ; l'export `.json` ne contient que la structure du projet.
