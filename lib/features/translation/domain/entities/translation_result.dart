// lib/features/translation/domain/entities/translation_result.dart
//
// Résultat d'une traduction et sa provenance (pour l'honnêteté de l'UI).

/// Where a translation came from.
enum TranslationOrigin { cache, dictionary, fuzzyDictionary, model }

/// A successful translation.
final class TranslationResult {
  const TranslationResult({required this.text, required this.origin});

  final String text;
  final TranslationOrigin origin;
}
