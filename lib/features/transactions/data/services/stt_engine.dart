// lib/features/transactions/data/services/stt_engine.dart
//
// Moteur de reconnaissance vocale hors ligne.
// État actuel (voir docs/voice-rd.md) : aucun modèle whisper-tiny-fr n'est
// embarqué et le moteur sherpa-onnx n'est pas encore intégré. StubSttEngine
// renvoie donc FeatureNotAvailableFailure ; l'UI bascule sur la saisie
// manuelle avec audio réécoutable. AUCUN téléchargement à l'exécution.

import 'package:flutter/services.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';

/// Offline speech-to-text engine.
abstract interface class SttEngine {
  Future<bool> isAvailable();

  Future<Result<String>> transcribe(String audioPath);
}

/// Placeholder engine until the sherpa-onnx POC is validated.
class StubSttEngine implements SttEngine {
  StubSttEngine({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  /// Expected location of the user-provided model.
  static const String modelAsset =
      'assets/models/stt/whisper-tiny-fr/tiny-encoder.int8.onnx';

  final AssetBundle _bundle;

  /// Whether the model file is bundled (informational only).
  Future<bool> isModelBundled() async {
    try {
      await _bundle.load(modelAsset);
      return true;
    } on Object {
      return false;
    }
  }

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<Result<String>> transcribe(String audioPath) async {
    final bundled = await isModelBundled();
    return FailureResult(
      FeatureNotAvailableFailure(
        technicalMessage: bundled
            ? 'STT model bundled but sherpa-onnx runtime not integrated'
            : 'STT model not bundled (assets/models/stt/whisper-tiny-fr)',
        userMessageFr:
            'La transcription n’est pas encore disponible. Tapez le montant, '
            'votre voix est gardée pour la réécoute.',
      ),
    );
  }
}
