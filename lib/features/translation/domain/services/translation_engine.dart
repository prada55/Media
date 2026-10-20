// lib/features/translation/domain/services/translation_engine.dart
//
// Moteur de traduction automatique embarqué (NLLB-tiny TFLite, optionnel).

import 'package:yako/core/error/result.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// On-device machine translation engine.
abstract interface class TranslationEngine {
  Future<bool> isAvailable();

  Future<Result<String>> translate(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  });
}
