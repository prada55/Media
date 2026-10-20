// lib/features/translation/data/engines/stub_translation_engine.dart
//
// Aucun modèle NLLB-tiny n'est embarqué (voir docs/translation-rd.md) :
// ce moteur est toujours indisponible.

import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/services/translation_engine.dart';

/// Always-unavailable engine.
class StubTranslationEngine implements TranslationEngine {
  const StubTranslationEngine();

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<Result<String>> translate(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  }) async => const FailureResult(
    TranslationUnavailableFailure(
      technicalMessage: 'No on-device translation model bundled',
    ),
  );
}
