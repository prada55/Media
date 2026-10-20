# Yako — R&D reconnaissance vocale hors ligne (STT)

> Statut au 2026-10-20 : **transcription non disponible dans ce build.**
> Repli validé : formulaire manuel + audio chiffré réécoutable.

## Ce qui est livré (Phase 3)

| Brique | État |
|---|---|
| Capture micro (`record` 7.1.2) | ✅ AAC-LC, 16 kHz, mono, 32 kbit/s, dans le cache privé de l'app |
| Chiffrement audio | ✅ AES-256-GCM avec la clé de données de session, `<documents>/audio/{uuid}.enc`, fichier temporaire écrasé puis supprimé |
| Réécoute (`just_audio` 0.10.6) | ✅ Déchiffrement vers un fichier temporaire privé, effacé après lecture |
| Transcription | ⛔ `StubSttEngine` → `FeatureNotAvailableFailure` ; l'UI propose la saisie manuelle |

Pourquoi pas de source audio en mémoire : `StreamAudioSource` de just_audio passe par un proxy HTTP local, ce qui exigerait la permission `INTERNET` sur Android (interdite, cf. Phase 6).

## POC sherpa-onnx à mener séparément

Objectif : transcrire 5 s d'audio FR en < 3 s sur Tecno Spark / Infinix Hot, 100 % hors ligne.

1. **Modèle** : `sherpa-onnx-whisper-tiny` (encoder/decoder int8, ≈ 100 Mo au total) ou un modèle zipformer FR plus léger. À déposer par l'utilisateur dans `assets/models/stt/whisper-tiny-fr/` (fichiers `tiny-encoder.int8.onnx`, `tiny-decoder.int8.onnx`, `tiny-tokens.txt`). **Aucun téléchargement à l'exécution.**
2. **Paquet** : `sherpa_onnx` 1.13.8 (pub.dev, 2026-09-11) embarque déjà onnxruntime — `flutter_onnxruntime` n'est pas nécessaire en plus.
3. **Décodage** : sherpa-onnx attend du PCM 16 kHz mono. Deux options :
   - enregistrer directement en `AudioEncoder.pcm16bits` / WAV pour la transcription, puis compresser en AAC pour le stockage ;
   - ou décoder l'AAC (plus coûteux).
4. **Intégration** : implémenter `SttEngine` (`lib/features/transactions/data/services/stt_engine.dart`) dans un `SherpaOnnxSttEngine`, exécuté dans un isolate, et le brancher dans `TransactionsModule` à la place de `StubSttEngine` quand le modèle est présent.
5. **Critères d'acceptation** : WER < 25 % sur 50 phrases commerciales enregistrées en marché (accent ivoirien), latence < 3 s, APK < 60 Mo par ABI (split ABI obligatoire).

## Risques

- Taille : whisper-tiny int8 + onnxruntime ≈ +110 Mo par ABI → dépasse l'objectif de 60 Mo ; envisager le téléchargement **unique, consenti et vérifié (HMAC)** du modèle, ou un modèle zipformer < 30 Mo.
- Qualité : whisper-tiny est faible sur les montants dictés (« vingt-cinq mille ») et sur le français ivoirien ; prévoir un post-traitement des nombres.
- Dioula / Baoulé : aucun modèle STT ouvert de qualité connu à ce jour.
