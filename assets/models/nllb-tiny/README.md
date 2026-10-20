# Modèle NLLB-tiny (optionnel) — procédure

> **Non embarqué dans ce build.** Yako fonctionne avec le dictionnaire local
> et affiche « Non traduit » sinon. Voir `docs/translation-rd.md`.

Conditions pour l'intégrer :

1. Modèle **TFLite quantifié int8**, taille totale **< 100 Mo** (encodeur + décodeur + tokenizer SentencePiece).
2. Paires supportées : `fra_Latn` ↔ `dyu_Latn`, `fra_Latn` ↔ `bci_Latn` (NLLB-200 couvre le dioula `dyu_Latn` ; le baoulé n'y figure pas à ce jour — à vérifier).
3. Fichiers à déposer ici :
   - `encoder.int8.tflite`
   - `decoder.int8.tflite`
   - `sentencepiece.bpe.model`
4. Déclarer le dossier dans `pubspec.yaml` (`flutter: assets: - assets/models/nllb-tiny/`).
5. Implémenter `TFLiteTranslationEngine` (interface `TranslationEngine`) et le brancher dans `TranslationModule` à la place de `StubTranslationEngine`.

**Aucun téléchargement à l'exécution.** Toute traduction automatique doit être relue par un locuteur natif avant d'être proposée comme fiable.
