# Moteur — Montage & Motion Studio

Deux applications gratuites, sans abonnement ni filigrane, qui tournent dans le navigateur (PC, Mac, iPhone, Android) :

- **Moteur Montage** — éditeur vidéo multipiste pour TikTok, Reels et YouTube : https://prada55.github.io/Media/montage/
- **Moteur Motion Studio** — motion design avancé (keyframes, courbes, tracking) : https://prada55.github.io/Media/

## Moteur Montage

| Domaine | Fonctions |
|---|---|
| **Piste principale magnétique** | Les clips se suivent automatiquement. Glisser pour réordonner, rogner les bords, couper (S), dupliquer, supprimer sans laisser de trou, remplacer le média. Vignettes de pellicule. |
| **Pistes libres** | Textes, stickers, incrustations (vidéo / photo par-dessus), musique et voix off, sous-titres. Placement automatique sur une piste libre, magnétisme, piste masquée / muette. |
| **Clips** | Cadrage Ajuster / Remplir, position, échelle, rotation, opacité avec **keyframes** (zoom ou déplacement animé), vitesse de 0,1× à 10×, volume jusqu'à 200 %, fondus audio, **extraction de l'audio** sur une piste séparée. |
| **Transitions** | Fondu enchaîné, fondu au noir, glisser (3 directions), pousser, zoom, volet, flou, tourbillon. Durée réglable, application à tous les clips. |
| **Animations** | Entrées, sorties et boucles (pop, glissement, zoom, rebond, pulsation, flottement, Ken Burns…) sur les clips, textes et stickers. |
| **Filtres et réglages** | 12 filtres (Vif, Chaud, Froid, N&B, Vintage, Ciné, VHS…) avec intensité, luminosité, contraste, saturation, température, teinte. |
| **Effets** | Glitch, flou, RGB Split, aberration, vignette, grain, lueur, secousse, pulsation, balancier. |
| **Texte** | 9 styles (contour, encadré, néon, dégradé, relief 3D…), polices importables, animations lettre par lettre ou mot par mot (machine à écrire, pop, fondu…). |
| **Stickers** | Plus de 90 emojis, animés automatiquement. |
| **Sous-titres** | Ajout et édition en liste, style appliqué à tous, **import et export .srt**. |
| **Voix off** | Enregistrement au micro pendant la lecture. |
| **Format et fond** | 9:16, 16:9, 1:1, 4:5, 3:4, avec fond flou automatique ou de couleur. |
| **Export** | MP4 ou WebM, 720p à 4K, 24, 30 ou 60 i/s, avec le son, sans filigrane, rendu image par image. |
| **PC lent** | Aperçu léger (360p) réglable et effets désactivables dans l'aperçu : l'export reste en pleine qualité. Aucune installation nécessaire. |
| **Projets** | Sauvegarde automatique, annuler / rétablir, duplication, renommage. |

**Pas encore disponible :** sous-titres automatiques (reconnaissance vocale), lecture à l'envers, détourage automatique, suppression de fond, bibliothèque en ligne de musiques et d'effets. L'export de longues vidéos peut être plus lent que la durée du film sur une machine modeste.

---

# Moteur Motion Studio

Studio de **motion design** qui fonctionne dans le navigateur, sur iPhone, iPad et ordinateur, et s'installe comme une application. L'ergonomie s'inspire des éditeurs mobiles (outils d'animation, timeline au doigt) et l'organisation des propriétés des logiciels de compositing professionnels (calques, keyframes, éditeur de courbes).

Application originale en HTML/JavaScript, sans framework ni serveur. Toutes les données restent sur l'appareil.

**En ligne :** https://prada55.github.io/Media/ (Safari → Partager → *Sur l'écran d'accueil* pour l'installer)

## Fonctionnalités

| Domaine | Ce qui est réellement implémenté |
|---|---|
| **Interface** | Thème sombre violet / cyan. Sur grand écran : panneau gauche (médias, ajout, modèles), aperçu central, inspecteur à droite (Propriétés, Animer, Effets, Suivi) et timeline en bas, tous redimensionnables. Sur iPhone : aperçu, timeline redimensionnable et 6 onglets. Mode focus. |
| **Calques** | Texte, bulle, rectangle, ellipse, fond uni ou dégradé, image ou logo (PNG, JPG, SVG), vidéo, audio, groupe (calque nul), calque d'effets. Visibilité, verrou, renommage (double-clic ou double appui), duplication, découpe, suppression, réordonnancement. |
| **Groupes et parentage** | Grouper / dissocier (Ctrl+G), parent au choix pour chaque calque. La position à l'écran est conservée au moment du lien, et les groupes sont repliables dans la timeline. |
| **Timeline** | Une piste par calque, quel que soit son type (vidéo, audio, texte, image, forme). Déplacement, rognage des bords (avec décalage du média), zoom (boutons ou Ctrl + molette), magnétisme (tête de lecture, bords, keyframes). Multi-sélection, sous-pistes par propriété animée avec keyframes déplaçables individuellement, formes d'onde audio. |
| **Keyframes** | Toutes les propriétés : position, échelle, largeur et hauteur, rotation, opacité, flou, ancrage, dimensions, arrondi, taille et espacement du texte, **couleurs** (interpolées), masques, et **paramètres de chaque effet**. |
| **Courbes** | Linéaire, Ease In, Ease Out, Ease In-Out, Expo, dépassement, élastique, rebond, maintien, **Bézier personnalisée**. Éditeur de courbes avec poignées Bézier et vue « vitesse ». Réglage de la vitesse d'une animation (étirement des keyframes). |
| **Texte** | Polices iOS et import de polices (TTF, OTF, WOFF). Taille, graisse, italique, espacement, interligne, alignement, dégradé, contour, bulle de fond, **texte 3D par extrusion**. Animateur par lettre, mot ou ligne : machine à écrire, apparition, fondu montant ou descendant, pop, flou → net, révélation par masque, rotation, dispersion, espacement, bascule 3D, vague. Entrée et sortie. |
| **Effets** (WebGL) | Flou gaussien, **flou de mouvement** (multi-échantillonnage temporel), lueur, ombre portée, correction colorimétrique (luminosité, contraste, saturation, teinte, température), RGB Split, aberration chromatique, glitch, vignette, grain. Pile ordonnable, chaque paramètre est animable. Le **calque d'effets** s'applique à tout ce qui est en dessous. |
| **Transitions** | Fondu, zoom, glissements (4 directions), rotation, flou, volets (masque animé), en entrée et/ou en sortie. Elles créent de vraies keyframes, modifiables ensuite. 26 animations prêtes à l'emploi (entrées, sorties, boucles). |
| **Suivi de mouvement** | Suivi image par image d'**1 point** (position) ou de **2 points** (position, rotation, échelle), par corrélation croisée normalisée avec affinage sous-pixel, vers l'avant ou vers l'arrière. Indice de confiance par image, trajectoire affichée, **correction manuelle** du point puis relance du suivi. Attache n'importe quel calque au suivi en conservant son décalage. |
| **Suivi de texte** | Un geste : vous touchez le sujet et lancez « Suivre ». Un titre est créé, suit le sujet et reçoit une animation d'apparition et de disparition. |
| **Suivi de caméra 2D** | Détection de points caractéristiques (Shi-Tomasi), suivi de chaque point, estimation robuste du mouvement global (RANSAC + moindres carrés) en translation, rotation et zoom. La grille de scène et les points suivis sont affichés. Sert à attacher des éléments à la scène et à **stabiliser** la vidéo. |
| **Médiathèque** | Import de vidéos, images, SVG et fichiers audio (bouton ou glisser-déposer), vignettes, durée, nombre d'utilisations. Ajout à la timeline, remplacement du média d'un calque, renommage, suppression. |
| **Export** | MP4 (H.264) et WebM (VP9), en 720p, 1080p, 2K ou 4K, à 24, 30 ou 60 i/s, en qualité standard ou élevée. Rendu **image par image via WebCodecs**, sans aucune image perdue. Son mixé hors ligne (AAC ou Opus). Barre de progression, temps restant, annulation, export PNG, sans filigrane. Seules les combinaisons réellement prises en charge par l'appareil sont proposées. |
| **Projets** | Sauvegarde automatique (IndexedDB), annuler / rétablir (100 niveaux), duplication, renommage, import / export `.json`, migration automatique des projets de la version précédente. |
| **Ergonomie** | Gestes tactiles (glisser, pincer pour l'échelle et la rotation, double appui), raccourcis clavier (touche `?`), messages d'erreur explicites, indicateurs de chargement, fonctionnement hors ligne. |

## Limites connues (dites clairement)

- **Pas de vrai suivi de caméra 3D.** Le suivi de caméra estime un mouvement 2D : translation, rotation et zoom de l'image. Il ne reconstruit ni la position 3D de la caméra ni la perspective, et ne gère pas la parallaxe. Sur une scène avec beaucoup de profondeur, les éléments attachés peuvent « glisser ».
- **Pas de reconnaissance d'objets.** Le suivi part de points choisis par l'utilisateur. L'option « aimanter » place le point sur le détail le plus contrasté à proximité, mais aucun modèle d'IA (MediaPipe, OpenCV.js) n'est embarqué. L'architecture (Web Worker dédié) permet d'en ajouter un plus tard.
- **Le suivi échoue sur les zones uniformes, floues ou masquées.** L'indice de confiance l'indique et le suivi s'arrête quand il est perdu. Il faut alors corriger le point et relancer.
- **Son à l'export :** si l'appareil n'a pas d'encodeur audio WebCodecs pour le format choisi, l'app bascule sur un enregistrement en temps réel (limité au 1080p) pour inclure le son, et le dit avant l'export.
- **Sans WebCodecs** (navigateurs anciens), seul l'export en temps réel jusqu'au 1080p est possible.
- **Export avec vidéo :** chaque image de la vidéo source est positionnée avec précision avant le rendu. Selon l'appareil, l'export peut alors être plus lent que la durée du film (environ 0,1 s par image mesuré en test).
- **Les effets demandent WebGL.** S'il manque, les effets concernés sont signalés et ne s'affichent pas.
- Il n'y a pas de masques dessinés à la plume (seulement des masques rectangulaires animables) ni de caméra ou de calques 3D.
- Les médias restent sur l'appareil : le fichier `.json` d'un projet n'emporte pas les vidéos et images.

## Installation

### iPhone / iPad
1. Ouvrir https://prada55.github.io/Media/ dans **Safari**.
2. **Partager → Sur l'écran d'accueil**.

### Publication (GitHub Pages)
Le workflow `.github/workflows/pages.yml` publie le dossier `app/` à chaque push sur `main` (Settings → Pages → Source : **GitHub Actions**).

### En local
```bash
cd app && python3 -m http.server 8000   # puis http://localhost:8000
```
Pour tester l'import de vidéos, utilisez de préférence un serveur qui gère les requêtes « Range ». Dans l'app, les médias sont chargés en mémoire, donc ce point ne concerne que le chargement direct de fichiers par URL.

## Architecture

```
app/
├── index.html · css/styles.css · manifest.webmanifest · sw.js (hors ligne)
└── js/
    ├── engine.js          Moteur : calques, keyframes (chemins props / style / effets), Bézier,
    │                      couleurs, parentage, masques, texte, flou de mouvement, rendu Canvas 2D
    ├── fx.js              Effets WebGL (passes de shaders, alpha prémultiplié)
    ├── audio.js           Mixage WebAudio, formes d'onde, mixage hors ligne pour l'export
    ├── export.js          WebCodecs + muxers MP4/WebM, repli MediaRecorder, détection des capacités
    ├── tracking.js        Extraction image par image, application des suivis, stabilisation
    ├── tracker.worker.js  Vision par ordinateur (NCC, Shi-Tomasi, RANSAC) dans un Web Worker
    ├── presets.js · templates.js · storage.js (IndexedDB) · state.js
    ├── app.js             Mise en page, lecture, gestes, historique, médias, raccourcis
    ├── ui/                timeline + éditeur de courbes, inspecteur, médiathèque, suivi, fenêtres
    └── vendor/            mp4-muxer, webm-muxer (licence MIT)
```

## Tests effectués

Navigateur Chromium sans interface, avec un profil iPhone 14 Pro et un profil ordinateur 1440×900 :
- **Suivi de point** sur une vidéo dont la trajectoire est connue : erreur de l'ordre de 1 à 2 px avec un motif de taille adaptée.
- **Suivi de caméra** sur un panoramique avec zoom tiré d'une vraie image : écart d'environ 1 px avec le suivi de point indépendant, échelle estimée à 0,5 % près.
- **Export** MP4 H.264 1080p (150 images exactes pour 5 s) et WebM VP9 + Opus avec son vérifié.
- Parcours complets : sélection, keyframes, courbes Bézier, effets, groupes, parentage, médias, suivi de texte, stabilisation, annuler / rétablir, import d'un projet v1.

**Pas encore testé sur un vrai iPhone.** Points à vérifier en priorité : la vitesse de l'export image par image avec des vidéos, et la présence d'un encodeur audio AAC selon la version d'iOS.
