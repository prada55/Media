// lib/features/translation/domain/services/localization_service.dart
//
// Textes de l'interface par langue (assets/i18n/ui_*.json). Repli : langue
// demandée → français → clé brute. Les fichiers dioula/baoulé contiennent
// des valeurs null tant qu'un locuteur natif ne les a pas renseignées.

import 'package:yako/features/translation/domain/entities/language_code.dart';

/// UI strings lookup with French fallback.
class LocalizationService {
  const LocalizationService(this._strings);

  /// Instance used when no `L10nScope` is in the tree (set in `main`).
  static LocalizationService instance = const LocalizationService({});

  final Map<LanguageCode, Map<String, String>> _strings;

  /// Text for [key] in [language], `{name}` placeholders filled from [args].
  String translate(
    String key,
    LanguageCode language, {
    Map<String, String> args = const {},
  }) {
    var text = _strings[language]?[key] ?? _strings[LanguageCode.fr]?[key];
    if (text == null) return key;
    for (final MapEntry(:key, :value) in args.entries) {
      text = text!.replaceAll('{$key}', value);
    }
    return text!;
  }

  /// Whether [key] has a real (non-fallback) text in [language].
  bool hasTranslation(String key, LanguageCode language) =>
      _strings[language]?.containsKey(key) ?? false;

  /// Share of French keys translated in [language] (0..1).
  double coverage(LanguageCode language) {
    final reference = _strings[LanguageCode.fr];
    if (reference == null || reference.isEmpty) return 0;
    final translated = _strings[language] ?? const {};
    return reference.keys.where(translated.containsKey).length /
        reference.length;
  }

  Set<String> keys(LanguageCode language) =>
      (_strings[language] ?? const {}).keys.toSet();
}
