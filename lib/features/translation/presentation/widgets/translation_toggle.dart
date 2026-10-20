// lib/features/translation/presentation/widgets/translation_toggle.dart
//
// Bascule de langue d'affichage d'un texte : Français / Dioula / Baoulé.

import 'package:flutter/material.dart';
import 'package:yako/features/translation/domain/entities/language_code.dart';

/// Language switch for a piece of text.
class TranslationToggle extends StatelessWidget {
  const TranslationToggle({
    required this.selected,
    required this.onChanged,
    this.languages = LanguageCode.values,
    super.key,
  });

  final LanguageCode selected;
  final ValueChanged<LanguageCode> onChanged;
  final List<LanguageCode> languages;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<LanguageCode>(
      key: const ValueKey('translation-toggle'),
      showSelectedIcon: false,
      segments: [
        for (final language in languages)
          ButtonSegment(value: language, label: Text(language.nativeName)),
      ],
      selected: {selected},
      onSelectionChanged: (s) => onChanged(s.first),
    );
  }
}
