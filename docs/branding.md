# Yako — Changer le nom, le logo, les couleurs, la typographie

> ⚠️ Le branding est **compilé dans l'application** : tout changement exige un nouveau build et une nouvelle soumission aux stores. Il n'existe **aucun** changement à distance (et ce serait contraire à la Guideline Apple 2.3/3.3.1).

## 1. Changer le nom (3 endroits)

| Fichier | Clé |
|---|---|
| `ios/Runner/Info.plist` | `CFBundleDisplayName` (et `CFBundleName`) |
| `android/app/src/main/AndroidManifest.xml` | `android:label` de `<application>` |
| `lib/core/constants/app_strings.dart` | `AppStrings.appName` |

## 2. Changer le logo (3 étapes)

1. Remplacer `assets/icons/app_icon.png` (1024×1024, sans transparence pour iOS) et `assets/icons/app_icon_foreground.png` (1024×1024, logo centré dans les 66 % centraux, fond transparent — icône adaptative Android). Couleur de fond adaptative : `icons_launcher.platforms.android.adaptive_background_color` dans `pubspec.yaml`.
2. Régénérer :
   ```bash
   dart run icons_launcher:create
   dart run flutter_native_splash:create   # si assets/icons/splash_logo.png change
   ```
3. Rebuild + resoumission.

> Les icônes actuelles sont des **placeholders** (micro blanc sur vert) à remplacer avant publication.
> `icons_launcher` remplace `flutter_launcher_icons`, non publié depuis plus de 12 mois (règle du projet).

## 3. Changer les couleurs

- `lib/core/theme/app_colors.dart` : `primary`, `secondary`, `sale`, `expense`, surfaces.
- `lib/core/theme/app_theme.dart` : thème clair **et** sombre ; le mode suit le réglage du système (`MaterialApp.theme` / `darkTheme`, équivalent de `MediaQuery.platformBrightness`).
- Splash : `flutter_native_splash.color` / `color_dark` dans `pubspec.yaml`, puis `dart run flutter_native_splash:create`.
- Garder un contraste ≥ 4.5:1 (lecture en plein soleil, utilisateurs peu alphabétisés).

## 4. Changer la typographie

1. Copier les fichiers `.ttf` dans `assets/fonts/`.
2. Décommenter et compléter la section `fonts:` de `pubspec.yaml`.
3. Ajouter `fontFamily: 'Yako'` dans `AppTheme._build` (`lib/core/theme/app_theme.dart`) ou créer `lib/core/theme/app_typography.dart` pour centraliser les styles.
4. `flutter pub get`, rebuild.
