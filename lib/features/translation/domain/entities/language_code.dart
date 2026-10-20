// lib/features/translation/domain/entities/language_code.dart
//
// Langues supportées : français, dioula, baoulé (codes ISO 639-3 pour les
// langues locales).

/// Supported languages.
enum LanguageCode {
  fr('fr', 'Français'),
  dyu('dyu', 'Dioula'),
  bci('bci', 'Baoulé');

  LanguageCode(this.code, this.nativeName);

  /// Code stocké en base (users.language).
  final String code;

  /// Nom affiché dans le sélecteur de langue.
  final String nativeName;

  /// Parses [code], falling back to French.
  static LanguageCode fromCode(String? code) => LanguageCode.values.firstWhere(
    (l) => l.code == code,
    orElse: () => LanguageCode.fr,
  );
}
