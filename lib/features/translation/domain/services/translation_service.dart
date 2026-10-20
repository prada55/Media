// lib/features/translation/domain/services/translation_service.dart
//
// Traduction hors ligne FR ↔ Dioula / Baoulé. Ordre : cache → dictionnaire
// exact → dictionnaire approché → modèle embarqué → échec explicite.
// Jamais d'appel réseau.

import 'package:yako/core/error/result.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';
import 'package:yako/features/translation/domain/entities/translation_result.dart';

/// Offline translation.
abstract interface class TranslationService {
  Future<Result<TranslationResult>> translate(
    String text, {
    required LanguageCode from,
    required LanguageCode to,
  });

  /// Languages [from] can be translated into in this build.
  List<LanguageCode> getAvailableTargetLanguages(LanguageCode from);

  /// Whether dictionaries are loaded.
  Future<bool> isReady();
}
