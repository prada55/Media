# Yako — R&D traduction FR ↔ Dioula / Baoulé (hors ligne)

> Statut au 2026-10-20 : pipeline livré, **contenu linguistique à fournir**.

## Stratégie (par ordre)

1. **Cache Drift** (`translations_cache`) : clé = SHA-256 du texte source normalisé, texte traduit chiffré AES-GCM avec la clé de session.
2. **Dictionnaire exact** : `assets/i18n/phrases_{fr_dyu,fr_bci,dyu_fr,bci_fr}.json`.
3. **Dictionnaire approché** : distance de Levenshtein ≤ 2 sur la phrase normalisée.
4. **Modèle embarqué** (NLLB-tiny TFLite) : *non intégré* → `StubTranslationEngine`.
5. **Échec explicite** : `TranslationUnavailableFailure` → l'UI montre le français + badge « Non traduit ».

Jamais d'appel réseau.

## Contenu livré

- 60 phrases commerciales FR (10 × 6 catégories : salutations, chiffres/montants, produits, actions, temps, politesse), **toutes avec une cible `null`**.
- `ui_dyu.json` / `ui_bci.json` : mêmes clés que `ui_fr.json`, valeurs `null` (repli français).

> Conformément au cahier des charges, **aucune traduction dioula ou baoulé n'a été inventée.** Un test (`dictionary_datasource_test.dart`) vérifie que les cibles livrées sont vides tant qu'elles n'ont pas été renseignées.

## Procédure de complétion (locuteur natif)

1. Remplacer chaque `null` par la traduction validée (`"dyu": "…"`).
2. Garder `id` et `category` inchangés ; ajouter de nouvelles entrées avec un `id` unique.
3. Mettre `meta.status` à `"reviewed"` et incrémenter `meta.version`.
4. Faire relire par un second locuteur ; noter les variantes régionales dans un champ `notes` (ignoré par l'app).
5. Retirer l'assertion « cibles vides » du test `shipped dictionaries` une fois le contenu validé.

## Modèle NLLB-tiny

Voir `assets/models/nllb-tiny/README.md`. Points d'attention :
- le baoulé (`bci`) n'est, à notre connaissance, pas couvert par NLLB-200 ;
- qualité inconnue sur le vocabulaire du marché ivoirien → évaluation humaine obligatoire ;
- taille : viser < 100 Mo, sinon split ABI + livraison séparée consentie.
